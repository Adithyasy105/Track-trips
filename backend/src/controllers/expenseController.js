// src/controllers/expenseController.js
import { supabase } from '../services/supabaseClient.js';
import { syncPendingPaymentsForTrip } from './paymentsController.js';
import { invalidateTripCaches } from '../services/redisClient.js';
import { emitToTrip } from '../services/socketService.js';
import { resolveExpenseAllocations, normalizeParticipants, toPaise } from '../utils/splitEngine.js';

const normalizeSplitData = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
};

const insertExpenseRecord = async ({ trip_id, payer_username, amount, description, category, participants, splitType, splitData, includeSplitMetadata = true }) => {
  const baseInsert = {
    trip_id,
    payer_username,
    amount,
    description,
    category,
    participants,
  };

  if (includeSplitMetadata) {
    return supabase
      .from('expenses')
      .insert([
        {
          ...baseInsert,
          split_type: splitType,
          split_data: splitData,
        },
      ])
      .select();
  }

  return supabase
    .from('expenses')
    .insert([baseInsert])
    .select();
};

export const addExpense = async (req, res, next) => {
  try {
    const {
      trip_id,
      amount,
      description,
      category,
      participants,
      payer_username: incomingPayer,
      split_type,
      split_data,
    } = req.body;

    const payer_username = incomingPayer || req.user.username;
    const normalizedParticipants = normalizeParticipants(participants || []);
    const splitType = String(split_type || 'EQUAL').toUpperCase();
    const splitData = normalizeSplitData(split_data);

    if (!trip_id) {
      return res.status(400).json({ error: 'Trip ID is required.' });
    }

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Expense amount must be greater than zero.' });
    }

    if (!normalizedParticipants.length) {
      return res.status(400).json({ error: 'Select at least one person.' });
    }

    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', payer_username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    const { data: tripMembers } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);

    const memberUsernames = new Set((tripMembers || []).map((member) => member.username));
    const invalidParticipants = normalizedParticipants.filter((participant) => !memberUsernames.has(participant));

    if (invalidParticipants.length > 0) {
      return res.status(400).json({
        error: `One or more participants are no longer members of this trip: ${invalidParticipants.join(', ')}`,
      });
    }

    if (!memberUsernames.has(payer_username)) {
      return res.status(400).json({ error: 'The payer must be a current trip member.' });
    }

    const totalPaise = toPaise(amount);
    const expenseCandidate = {
      amount,
      participants: normalizedParticipants,
      payer_username,
      split_type: splitType,
      split_data: splitData,
    };

    try {
      const allocations = resolveExpenseAllocations(expenseCandidate, memberUsernames);
      const totalAllocated = allocations.reduce((sum, entry) => sum + Number(entry.amountPaise || 0), 0);

      if (totalAllocated !== totalPaise) {
        return res.status(400).json({
          error: 'The split values do not match the total expense amount.',
        });
      }

      if (allocations.some((entry) => (entry.amountPaise || 0) < 0)) {
        return res.status(400).json({ error: 'No participant can owe a negative amount.' });
      }
    } catch (validationError) {
      return res.status(400).json({
        error: validationError.message || 'Invalid split configuration.',
      });
    }

    let newExpenseRecord = null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_expense_with_outbox', {
      p_trip_id: trip_id,
      p_payer_username: payer_username,
      p_amount: amount,
      p_description: description,
      p_category: category,
      p_participants: normalizedParticipants,
      p_split_type: splitType,
      p_split_data: splitData,
    });

    if (!rpcError && rpcData) {
      newExpenseRecord = rpcData;
    } else {
      const fallbackCandidate = {
        trip_id,
        payer_username,
        amount,
        description,
        category,
        participants: normalizedParticipants,
      };

      let insertResponse;
      let insertError = null;

      try {
        insertResponse = await insertExpenseRecord({
          trip_id,
          payer_username,
          amount,
          description,
          category,
          participants: normalizedParticipants,
          splitType,
          splitData,
          includeSplitMetadata: true,
        });
      } catch (error) {
        insertError = error;
      }

      if (insertError || insertResponse?.error) {
        const retryResponse = await insertExpenseRecord({
          trip_id,
          payer_username,
          amount,
          description,
          category,
          participants: normalizedParticipants,
          splitType,
          splitData,
          includeSplitMetadata: false,
        });

        if (retryResponse?.error) {
          throw retryResponse.error;
        }

        newExpenseRecord = retryResponse?.data?.[0] || {
          ...fallbackCandidate,
          split_type: splitType,
          split_data: splitData,
        };
      } else {
        newExpenseRecord = insertResponse?.data?.[0] || {
          ...fallbackCandidate,
          split_type: splitType,
          split_data: splitData,
        };
      }
    }

    try {
      await syncPendingPaymentsForTrip(trip_id, payer_username);
      await invalidateTripCaches(trip_id);
      emitToTrip(trip_id, 'expense:added', newExpenseRecord);
    } catch (syncErr) {
      console.error('Failed to sync payments / invalidate cache / emit event after adding expense:', syncErr);
    }

    res.status(201).json({ message: 'Expense added', expense: newExpenseRecord });
  } catch (err) {
    next(err);
  }
};

export const getTripExpenses = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Verify access to trip
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Get trip members to filter expenses
    const { data: tripMembers, error: tripMemError } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);

    if (tripMemError) throw tripMemError;
    const tripMemberUsernames = new Set((tripMembers || []).map(m => m.username));

    // Get expenses
    const { data: allExpenses, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', trip_id)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    // Filter expenses to only include those where payer and all participants are trip members
    const filteredExpenses = (allExpenses || []).filter(expense => {
      // Check if payer is a trip member
      if (!tripMemberUsernames.has(expense.payer_username)) {
        return false;
      }
      // Check if all participants are trip members
      if (expense.participants && expense.participants.length > 0) {
        return expense.participants.every(p => tripMemberUsernames.has(p));
      }
      return true;
    });

    res.json(filteredExpenses);
  } catch (err) {
    next(err);
  }
};

export const deleteExpense = async (req, res, next) => {
  try {
    const { expense_id } = req.params;
    const username = req.user.username;

    // Get expense
    const { data: expense, error: expError } = await supabase
      .from('expenses')
      .select('trip_id, payer_username')
      .eq('id', expense_id)
      .maybeSingle();

    if (expError) throw expError;
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Get trip to verify membership
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', expense.trip_id)
      .maybeSingle();

    if (tripError) throw tripError;

    // Verify user is a member of the group
    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    // Check if trip already has completed settlements
    const { data: completedPayment, error: completedErr } = await supabase
      .from('payments')
      .select('id')
      .eq('trip_id', expense.trip_id)
      .eq('status', 'completed')
      .limit(1)
      .maybeSingle();
    if (completedErr && completedErr.code !== 'PGRST116') throw completedErr;
    if (completedPayment) {
      return res.status(400).json({
        error: 'Cannot delete this expense because completed settlements exist for the trip. Undo settlements before deleting.',
      });
    }

    // Only payer can delete
    if (expense.payer_username !== username) {
      return res.status(403).json({ error: 'Only the payer can delete this expense' });
    }

    const { error } = await supabase.from('expenses').delete().eq('id', expense_id);
    if (error) throw error;

    try {
      await syncPendingPaymentsForTrip(expense.trip_id, username);
      await invalidateTripCaches(expense.trip_id);
      emitToTrip(expense.trip_id, 'expense:deleted', { id: expense_id, deleted_by: username });
    } catch (syncErr) {
      console.error('Failed to sync payments / invalidate cache / emit event after expense delete:', syncErr);
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    next(err);
  }
};
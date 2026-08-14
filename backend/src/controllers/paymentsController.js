// src/controllers/paymentsController.js
import { supabase } from '../services/supabaseClient.js';
import { buildSettlementSnapshot } from '../utils/settlementAlgo.js';
import { emitToTrip } from '../services/socketService.js';
import { invalidateTripCaches } from '../services/redisClient.js';

// Internal helper: runs the full settlement algorithm for a trip and returns settlements array.
// Used only by syncPendingPaymentsForTrip (called on mutations, not on GET).
const calculateSettlements = async (trip_id) => {
  const [membersResult, expensesResult, completedResult] = await Promise.all([
    supabase.from('trip_members').select('username').eq('trip_id', trip_id),
    supabase.from('expenses').select('*').eq('trip_id', trip_id),
    supabase.from('payments').select('from_username, to_username, amount').eq('trip_id', trip_id).eq('status', 'completed'),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (expensesResult.error) throw expensesResult.error;
  if (completedResult.error) throw completedResult.error;

  const memberSet = new Set((membersResult.data || []).map((m) => m.username));
  if (memberSet.size === 0) return [];

  const snapshot = buildSettlementSnapshot(
    expensesResult.data || [],
    memberSet,
    completedResult.data || []
  );
  return snapshot.settlements;
};

export const syncPendingPaymentsForTrip = async (trip_id, actorUsername, options = {}) => {
  const { resetCompleted = false } = options;
  const settlements = await calculateSettlements(trip_id);

  let deleteBuilder = supabase
    .from('payments')
    .delete()
    .eq('trip_id', trip_id);

  if (!resetCompleted) {
    deleteBuilder = deleteBuilder.eq('status', 'pending');
  }

  const { error: deleteErr } = await deleteBuilder;
  if (deleteErr) throw deleteErr;

  if (!settlements.length) {
    return { created: 0 };
  }

  const insertPayload = settlements.map(settlement => ({
    trip_id,
    from_username: settlement.from,
    to_username: settlement.to,
    amount: settlement.amount,
    status: 'pending',
    created_by: actorUsername || settlement.from,
  }));

  const { data, error: insertErr } = await supabase
    .from('payments')
    .insert(insertPayload)
    .select('id');
  if (insertErr) throw insertErr;

  return { created: data?.length || 0 };
};

// List payments for a trip - auto-creates payment records from settlements
export const listTripPayments = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Verify access to trip via group
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();
    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    // NOTE: sync is intentionally NOT called here (BUG 3 fix).
    // Pending payments are only recalculated on mutations (add/delete expense, complete payment).
    // GET simply reads existing rows — no delete-and-recreate on every request.
    const { data: allPayments, error: finalError } = await supabase
      .from('payments')
      .select('*')
      .eq('trip_id', trip_id)
      .order('created_at', { ascending: false });
    if (finalError) throw finalError;

    res.json(allPayments || []);
  } catch (err) {
    next(err);
  }
};

// Create a payment record (from settlement instructions). Anyone can request; only receiver can mark done.
export const createPayment = async (req, res, next) => {
  try {
    const { trip_id, from_username, to_username, amount } = req.body;
    const requester = req.user.username;

    if (!trip_id || !from_username || !to_username || !amount) {
      return res.status(400).json({ error: 'trip_id, from_username, to_username, amount are required' });
    }

    // Access checks
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', requester)
      .maybeSingle();
    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    // Ensure both parties are trip members
    const { data: members } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);
    const set = new Set((members || []).map(m => m.username));
    if (!set.has(from_username) || !set.has(to_username)) {
      return res.status(400).json({ error: 'Both users must be trip members' });
    }

    const { data, error } = await supabase
      .from('payments')
      .insert([{ trip_id, from_username, to_username, amount: parseFloat(amount), status: 'pending', created_by: requester }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    next(err);
  }
};

// Mark payment as completed - only receiver can complete
export const completePayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const username = req.user.username;

    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if ((payment.to_username || '').trim().toLowerCase() !== (username || '').trim().toLowerCase()) {
      return res.status(403).json({ error: 'Only the receiver can mark as completed' });
    }

    const { data, error } = await supabase
      .from('payments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;

    try {
      await syncPendingPaymentsForTrip(payment.trip_id, username);
      await invalidateTripCaches(payment.trip_id);
      emitToTrip(payment.trip_id, 'settlement:updated', data[0]);
    } catch (syncErr) {
      console.error('Failed to sync payments after completion:', syncErr);
    }

    res.json(data[0]);
  } catch (err) {
    next(err);
  }
};

export const resetTripPayments = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;
    const mode = (req.body?.mode || 'soft').toLowerCase();
    const resetCompleted = mode === 'hard';

    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { data: membership } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();
    if (!membership) return res.status(403).json({ error: 'Forbidden' });

    const result = await syncPendingPaymentsForTrip(trip_id, username, { resetCompleted });
    res.json({
      message: resetCompleted
        ? 'Hard reset: pending payments rebuilt and completed payments cleared'
        : 'Soft reset: pending payments rebuilt and completed payments preserved',
      ...result,
    });
  } catch (err) {
    next(err);
  }
};




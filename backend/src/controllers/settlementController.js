// src/controllers/settlementController.js
import { supabase } from '../services/supabaseClient.js';

export const getTripSettlements = async (req, res, next) => {
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

    // Get all expenses for the trip
    const { data: expenses, error: expError } = await supabase
      .from('expenses')
      .select('*')
      .eq('trip_id', trip_id);

    if (expError) throw expError;

    // Get all trip members
    const { data: members, error: memError } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id);

    if (memError) throw memError;
    // Ensure we have a valid array and create Set of trip member usernames
    const memberUsernames = new Set((members || []).map(m => m.username));
    
    // If no trip members, return empty response
    if (memberUsernames.size === 0) {
      return res.json({
        balances: {},
        settlements: [],
        summary: {
          total_expenses: 0,
          total_expenses_count: 0
        }
      });
    }

    // Filter expenses to only include those where payer and all participants are trip members
    const validExpenses = expenses.filter(expense => {
      // Check if payer is a trip member
      if (!memberUsernames.has(expense.payer_username)) {
        return false;
      }
      // Check if all participants are trip members
      if (expense.participants && expense.participants.length > 0) {
        return expense.participants.every(p => memberUsernames.has(p));
      }
      return true;
    });

    // Calculate balances: how much each person owes/paid (only trip members)
    const balances = {};
    Array.from(memberUsernames).forEach(username => {
      balances[username] = { paid: 0, owes: 0, net: 0 };
    });

    // Process each valid expense
    validExpenses.forEach(expense => {
      const { payer_username, amount, participants } = expense;
      if (!participants || participants.length === 0) return;
      
      const sharePerPerson = amount / participants.length;

      // Add to paid amount - only if payer is a trip member
      if (balances[payer_username]) {
        balances[payer_username].paid += amount;
      }

      // Add to owes amount for each participant - only if participant is a trip member
      participants.forEach(participant => {
        if (balances[participant]) {
          balances[participant].owes += sharePerPerson;
        }
      });
    });

    // Calculate net balance (positive = others owe them, negative = they owe others)
    Object.keys(balances).forEach(username => {
      balances[username].net = balances[username].paid - balances[username].owes;
    });

    // Filter balances to ONLY include trip members (remove any non-trip members)
    // This is a critical safety check - ensure ONLY trip members are in the response
    const filteredBalances = {};
    memberUsernames.forEach(username => {
      // Only add if username exists in balances AND is a trip member
      if (balances.hasOwnProperty(username)) {
        filteredBalances[username] = {
          paid: balances[username].paid || 0,
          owes: balances[username].owes || 0,
          net: balances[username].net || 0
        };
      }
    });
    
    // Double-check: Remove any keys that aren't in trip members (safety net)
    Object.keys(filteredBalances).forEach(key => {
      if (!memberUsernames.has(key)) {
        delete filteredBalances[key];
      }
    });

    // Calculate settlements (who owes whom) - only from trip members
    const settlements = [];
    const creditors = [];
    const debtors = [];

    // Separate creditors and debtors (only trip members)
    Object.keys(filteredBalances).forEach(username => {
      const net = filteredBalances[username].net;
      if (net > 0.01) {
        creditors.push({ username, amount: net });
      } else if (net < -0.01) {
        debtors.push({ username, amount: Math.abs(net) });
      }
    });

    // Sort by amount (largest first)
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // Calculate optimal settlements
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      const settleAmount = Math.min(creditor.amount, debtor.amount);

      if (settleAmount > 0.01) {
        settlements.push({
          from: debtor.username,
          to: creditor.username,
          amount: parseFloat(settleAmount.toFixed(2))
        });
      }

      creditor.amount -= settleAmount;
      debtor.amount -= settleAmount;

      if (creditor.amount < 0.01) creditorIndex++;
      if (debtor.amount < 0.01) debtorIndex++;
    }

    // Final safety check: Ensure response only contains trip members
    // Create a clean response object with ONLY trip members
    const finalBalances = {};
    memberUsernames.forEach(username => {
      if (filteredBalances[username]) {
        finalBalances[username] = filteredBalances[username];
      }
    });

    res.json({
      balances: finalBalances, // Only trip members - guaranteed
      settlements,
      summary: {
        total_expenses: validExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0),
        total_expenses_count: validExpenses.length
      }
    });
  } catch (err) {
    next(err);
  }
};

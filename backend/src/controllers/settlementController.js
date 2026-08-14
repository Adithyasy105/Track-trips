// src/controllers/settlementController.js
import { supabase } from '../services/supabaseClient.js';
import { buildSettlementSnapshot } from '../utils/settlementAlgo.js';

export const getTripSettlements = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Settlement data is calculated from live expenses/payments below. Do not
    // serve a stale cached snapshot after a mutation or payment completion.

    // Verify trip exists — use maybeSingle() so missing trip returns null (not a 406 crash)
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Verify requester is a group member
    const { data: membership } = await supabase
      .from('group_members')
      .select('username')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) return res.status(403).json({ error: 'You are not a member of this group' });

    // Fetch trip members, expenses, and completed payments in parallel
    const [membersResult, expensesResult, completedResult] = await Promise.all([
      supabase.from('trip_members').select('username').eq('trip_id', trip_id),
      supabase.from('expenses').select('*').eq('trip_id', trip_id),
      supabase.from('payments').select('from_username, to_username, amount').eq('trip_id', trip_id).eq('status', 'completed'),
    ]);

    if (membersResult.error)   throw membersResult.error;
    if (expensesResult.error)  throw expensesResult.error;
    if (completedResult.error) throw completedResult.error;

    const memberSet = new Set((membersResult.data || []).map(m => m.username));

    if (memberSet.size === 0) {
      return res.json({
        balances: {},
        settlements: [],
        summary: { total_expenses: 0, total_expenses_count: 0 },
      });
    }

    const snapshot = buildSettlementSnapshot(
      expensesResult.data || [],
      memberSet,
      completedResult.data || []
    );

    const responsePayload = {
      balances: snapshot.balances,
      settlements: snapshot.settlements,
      summary: snapshot.summary,
    };

    res.json(responsePayload);
  } catch (err) {
    next(err);
  }
};



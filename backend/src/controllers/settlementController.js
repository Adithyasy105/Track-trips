// src/controllers/settlementController.js
import { supabase } from '../services/supabaseClient.js';
import { buildSettlementSnapshot } from '../utils/settlementAlgo.js';
import { getCache, setCache } from '../services/redisClient.js';

export const getTripSettlements = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    const cacheKey = `settlements:trip:${trip_id}`;
    // Authorize before reading a cache entry so cached trip data cannot bypass membership checks.
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (tripError) throw tripError;
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Verify requester is a group member
    const { data: membership } = await supabase
      .from('trip_members')
      .select('username')
      .eq('trip_id', trip_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) return res.status(403).json({ error: 'You are not a member of this trip' });

    const cachedSettlements = await getCache(cacheKey);
    if (cachedSettlements) {
      console.log(`[Redis HIT] Returned cached settlements for trip ${trip_id}`);
      return res.json(cachedSettlements);
    }

    // Fetch trip members, expenses, and completed payments in parallel
    const [membersResult, expensesResult, completedResult] = await Promise.all([
      supabase.from('trip_members').select('username').eq('trip_id', trip_id),
      supabase.from('expenses').select('*').eq('trip_id', trip_id),
      supabase.from('payments').select('from_username, to_username, amount, amount_paise').eq('trip_id', trip_id).eq('status', 'completed'),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (expensesResult.error) throw expensesResult.error;
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

    const receiverUsernames = [...new Set(snapshot.settlements.map((settlement) => settlement.to))];
    const { data: receivers, error: receiversError } = receiverUsernames.length
      ? await supabase.from('users').select('username, upi_id').in('username', receiverUsernames)
      : { data: [], error: null };
    if (receiversError) throw receiversError;
    const upiByUsername = new Map((receivers || []).map((user) => [user.username, user.upi_id]));
    const { data: activePayments, error: activePaymentsError } = await supabase.from('payments')
      .select('id, from_username, to_username, amount, amount_paise, status, settlement_key')
      .eq('trip_id', trip_id).in('status', ['payment_initiated', 'awaiting_receiver_confirmation']);
    if (activePaymentsError) throw activePaymentsError;
    const activeByPair = new Map((activePayments || []).map((payment) => [`${payment.from_username}:${payment.to_username}`, payment]));
    const responsePayload = {
      balances: snapshot.balances,
      settlements: snapshot.settlements.map((settlement) => {
        const amountPaise = Number.isSafeInteger(settlement.amountPaise)
          ? settlement.amountPaise
          : Math.round(Number(settlement.amount) * 100);
        const pairKey = `${settlement.from}:${settlement.to}`;
        return { ...settlement, amountPaise, receiverUpiId: upiByUsername.get(settlement.to) || null, activePayment: activeByPair.get(pairKey) || null };
      }),
      activePaymentHolds: activePayments || [],
      summary: snapshot.summary,
    };

    // Cache for 300 seconds (5 minutes) — settlements change when expenses are added
    await setCache(cacheKey, responsePayload, 300);
    res.json(responsePayload);
  } catch (err) {
    next(err);
  }
};



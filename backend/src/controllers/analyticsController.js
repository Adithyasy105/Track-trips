import { supabase } from '../services/supabaseClient.js';
import { filterValidExpenses } from '../utils/settlementAlgo.js';
import { getCache, setCache } from '../services/redisClient.js';

const getTripAnalyticsCacheKey = (tripId) => `analytics:trip:${tripId}`;
const getTripSpendingSummaryCacheKey = (tripId) => `spending:summary:trip:${tripId}`;

export const getTripAnalytics = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Check Redis cache first
    const cacheKey = getTripAnalyticsCacheKey(trip_id);
    const summaryCacheKey = getTripSpendingSummaryCacheKey(trip_id);
    const cachedAnalytics = await getCache(cacheKey);
    if (cachedAnalytics) {
      console.log(`[Redis HIT] Returned cached analytics for trip ${trip_id}`);
      return res.json(cachedAnalytics);
    }

    const cachedSummary = await getCache(summaryCacheKey);
    if (cachedSummary) {
      console.log(`[Redis HIT] Returned cached spending summary for trip ${trip_id}`);
      return res.json({ summary: cachedSummary });
    }

    // Verify access to trip (BUG 4 fix: maybeSingle to prevent crash on non-existent trip)
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

    // Get all expenses & trip members in parallel
    const [expensesResult, membersResult] = await Promise.all([
      supabase.from('expenses').select('*').eq('trip_id', trip_id),
      supabase.from('trip_members').select('username').eq('trip_id', trip_id),
    ]);

    if (expensesResult.error) throw expensesResult.error;
    if (membersResult.error) throw membersResult.error;

    const memberSet = new Set((membersResult.data || []).map((m) => m.username));

    if (memberSet.size === 0) {
      return res.json({
        summary: {
          total_expenses: 0,
          total_expenses_count: 0,
          average_expense: 0,
        },
        spending_per_user: {},
        spending_by_category: {},
        chart_data: {
          users: [],
          categories: [],
        },
      });
    }

    const validExpenses = filterValidExpenses(expensesResult.data, memberSet);

    // Calculate total spent per user (only trip members)
    const spendingPerUser = {};
    for (const u of memberSet) {
      spendingPerUser[u] = 0;
    }

    validExpenses.forEach((expense) => {
      if (memberSet.has(expense.payer_username)) {
        spendingPerUser[expense.payer_username] += parseFloat(expense.amount);
      }
    });

    // Round user spending (BUG 5 fix)
    const finalSpendingPerUser = {};
    for (const u of memberSet) {
      finalSpendingPerUser[u] = parseFloat((spendingPerUser[u] || 0).toFixed(2));
    }

    // Calculate spending by category (rounded)
    const spendingByCategoryRaw = {};
    validExpenses.forEach((expense) => {
      const category = expense.category || 'Uncategorized';
      spendingByCategoryRaw[category] = (spendingByCategoryRaw[category] || 0) + parseFloat(expense.amount);
    });

    const spendingByCategory = {};
    Object.keys(spendingByCategoryRaw).forEach((category) => {
      spendingByCategory[category] = parseFloat(spendingByCategoryRaw[category].toFixed(2));
    });

    const categoryChartData = Object.keys(spendingByCategory).map((category) => ({
      name: category,
      value: spendingByCategory[category],
    }));

    const totalSpent = validExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const userChartData = Object.keys(finalSpendingPerUser)
      .filter((u) => finalSpendingPerUser[u] > 0)
      .map((u) => ({
        name: u,
        value: finalSpendingPerUser[u],
      }));

    const responsePayload = {
      summary: {
        total_expenses: parseFloat(totalSpent.toFixed(2)),
        total_expenses_count: validExpenses.length,
        average_expense:
          validExpenses.length > 0 ? parseFloat((totalSpent / validExpenses.length).toFixed(2)) : 0,
      },
      spending_per_user: finalSpendingPerUser,
      spending_by_category: spendingByCategory,
      chart_data: {
        users: userChartData,
        categories: categoryChartData,
      },
    };

    await setCache(cacheKey, responsePayload, 300);
    await setCache(summaryCacheKey, responsePayload.summary, 300);
    res.json(responsePayload);
  } catch (err) {
    next(err);
  }
};


// src/controllers/aiController.js
import { supabase } from '../services/supabaseClient.js';
import { suggestCategory, explainSettlements, copilotAnswer } from '../services/geminiService.js';
import { buildSettlementSnapshot } from '../utils/settlementAlgo.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/ai/suggest-category?description=Dinner+at+Empire
 * Non-blocking optional suggestion endpoint
 */
export const getSuggestedCategory = async (req, res, next) => {
  try {
    const description = req.query.description || req.body?.description || '';
    if (!description || !description.trim()) {
      return res.json({ category: 'Other', confidence: 0.5, ai_suggested: false });
    }

    const suggestion = await suggestCategory(description, { requestId: req.id });
    res.json(suggestion);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/ai/trips/:trip_id/settlement-explain
 * Generates plain-language explanation of settlements for a trip
 */
export const getSettlementExplanation = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const username = req.user.username;

    // Verify membership
    const { data: trip } = await supabase
      .from('trips')
      .select('group_id')
      .eq('id', trip_id)
      .maybeSingle();

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { data: membership } = await supabase
      .from('group_members')
      .select('username')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();

    if (!membership) return res.status(403).json({ error: 'You are not a member of this group' });

    // Fetch trip data
    const [membersResult, expensesResult, completedResult] = await Promise.all([
      supabase.from('trip_members').select('username').eq('trip_id', trip_id),
      supabase.from('expenses').select('*').eq('trip_id', trip_id),
      supabase.from('payments').select('from_username, to_username, amount').eq('trip_id', trip_id).eq('status', 'completed'),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (expensesResult.error) throw expensesResult.error;
    if (completedResult.error) throw completedResult.error;

    const memberSet = new Set((membersResult.data || []).map(m => m.username));
    const snapshot = buildSettlementSnapshot(
      expensesResult.data || [],
      memberSet,
      completedResult.data || []
    );

    const settlementPayload = {
      summary: snapshot.summary,
      balances: snapshot.balances,
      settlements: snapshot.settlements,
    };

    const explanationResult = await explainSettlements(settlementPayload, username, { requestId: req.id });
    const explanation = typeof explanationResult === 'string' ? explanationResult : explanationResult?.data || '';
    const errorId = typeof explanationResult === 'string' ? null : explanationResult?.errorId || null;

    res.json({
      explanation,
      settlementData: settlementPayload,
      ...(errorId ? { errorId, success: false } : { success: true }),
    });
  } catch (err) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.error('Settlement explanation failed', { requestId: req.id, errorId, path: req.originalUrl, method: req.method, stack: err.stack });
    res.status(200).json({
      explanation: '✨ AI Insights are currently unavailable. Please try again in a moment.',
      settlementData: null,
      errorId,
      success: false,
    });
  }
};
/**
 * POST /api/ai/trips/:trip_id/copilot
 * AI Financial Copilot: answers natural-language questions about a trip using
 * real structured expense, settlement, and analytics data.
 *
 * Body: { question: string, history?: [{role, text}] }
 */
export const copilotChat = async (req, res, next) => {
  try {
    const { trip_id } = req.params;
    const { question, history = [] } = req.body;
    const username = req.user.username;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    // Verify trip membership
    const { data: trip } = await supabase
      .from('trips')
      .select('id, name, group_id')
      .eq('id', trip_id)
      .maybeSingle();
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const { data: membership } = await supabase
      .from('group_members')
      .select('username')
      .eq('group_id', trip.group_id)
      .eq('username', username)
      .maybeSingle();
    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    // Fetch all trip data in parallel
    const [membersResult, expensesResult, paymentsResult] = await Promise.all([
      supabase.from('trip_members').select('username').eq('trip_id', trip_id),
      supabase.from('expenses').select('*').eq('trip_id', trip_id).order('timestamp', { ascending: true }),
      supabase.from('payments').select('from_username, to_username, amount').eq('trip_id', trip_id).eq('status', 'completed'),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (expensesResult.error) throw expensesResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const memberSet = new Set((membersResult.data || []).map(m => m.username));
    const snapshot = buildSettlementSnapshot(
      expensesResult.data || [],
      memberSet,
      paymentsResult.data || []
    );

    // AI receives an explicit rupee-based contract to avoid any unit ambiguity.
    const expensesForContext = snapshot.validExpenses.map(e => ({
      date: e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 10) : 'unknown',
      description: e.description,
      amountRupees: Number(Number(e.amount || 0).toFixed(2)),
      paid_by: e.payer_username || 'unknown',
      category: e.category || 'Other',
      participants: Array.isArray(e.participants) ? e.participants : [],
    }));

    // Spending by category is also kept in rupees for the AI contract.
    const spendingByCategory = {};
    for (const e of expensesForContext) {
      spendingByCategory[e.category] = Number(
        ((spendingByCategory[e.category] || 0) + e.amountRupees).toFixed(2)
      );
    }

    const tripContext = {
      tripName: trip.name,
      members: [...memberSet],
      totalSpentRupees: snapshot.summary.total_expenses,
      expenseCount: snapshot.summary.total_expenses_count,
      expenses: expensesForContext,
      balances: snapshot.balances,
      settlements: snapshot.settlements,
      spendingByCategory,
    };

    const answerResult = await copilotAnswer(tripContext, question.trim(), history, { requestId: req.id });
    const answer = typeof answerResult === 'string' ? answerResult : answerResult?.data || '';
    const errorId = typeof answerResult === 'string' ? null : answerResult?.errorId || null;

    res.json({
      answer,
      ...(errorId ? { errorId, success: false } : { success: true }),
    });
  } catch (err) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.error('Copilot chat failed', { requestId: req.id, errorId, path: req.originalUrl, method: req.method, stack: err.stack });
    res.status(200).json({
      answer: '🤖 I encountered a temporary issue while analyzing your trip data. Please try again in a moment.',
      errorId,
      success: false,
    });
  }
};

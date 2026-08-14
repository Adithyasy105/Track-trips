// src/services/geminiService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { metrics } from '../utils/metrics.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Active valid models tested against Google API: 'gemini-flash-latest' & 'gemini-pro'
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const FALLBACK_MODEL = 'gemini-pro';
const REQUEST_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '10000', 10);
const MAX_RETRIES = 2;

let genAI = null;
let primaryModel = null;
let fallbackModel = null;

if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    primaryModel = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
    fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
    logger.info(`[Gemini] ✅ Gemini AI client initialized (primary: ${PRIMARY_MODEL}, fallback: ${FALLBACK_MODEL})`);
  } catch (err) {
    logger.warn(`[Gemini] ⚠️ Failed to initialize Gemini AI: ${err.message}`);
  }
} else {
  logger.warn('[Gemini] ⚠️ GEMINI_API_KEY not set. AI features will run in fallback mode.');
}

const ALLOWED_CATEGORIES = ['Food', 'Transport', 'Accommodation', 'Entertainment', 'Shopping', 'Utilities', 'Other'];

/**
 * Execute a promise with a timeout limit
 */
const withTimeoutAndRetry = async (operation, meta = {}, { timeoutMs = REQUEST_TIMEOUT_MS, maxRetries = MAX_RETRIES, modelName = PRIMARY_MODEL } = {}) => {
  const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        logger.info(`[Gemini] Retry attempt ${attempt}/${maxRetries} for ${modelName} after ${delay}ms`, { ...meta, errorId });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const result = await Promise.race([
        operation(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)),
      ]);

      return { success: true, data: result, errorId };
    } catch (err) {
      lastError = err;
      logger.warn(`[Gemini] Attempt ${attempt + 1} failed for ${modelName}: ${err.message}`, { ...meta, errorId });
    }
  }

  return {
    success: false,
    errorId,
    message: lastError?.message || 'Gemini request failed',
  };
};

/**
 * Helper to generate content with timeout, exponential backoff retries, and fallback model
 */
const generateContentWithFallback = async (prompt, meta = {}) => {
  if (!genAI || !primaryModel) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return { success: false, errorId, message: 'Gemini client is unavailable' };
  }

  metrics.inc('ai_request_total');
  const startTime = Date.now();

  const primaryResult = await withTimeoutAndRetry(() => primaryModel.generateContent(prompt), meta, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
    modelName: PRIMARY_MODEL,
  });

  if (primaryResult.success) {
    try {
      const text = primaryResult.data?.response?.text?.().trim() || '';
      const duration = Date.now() - startTime;
      metrics.inc('ai_request_success_total');
      metrics.observeLatency('ai_latency_ms', duration);
      logger.info(`[Gemini] Request succeeded using ${PRIMARY_MODEL} in ${duration}ms`, { ...meta, errorId: primaryResult.errorId });
      return { success: true, data: text, errorId: primaryResult.errorId };
    } catch (err) {
      logger.warn(`[Gemini] Failed to parse primary response: ${err.message}`, { ...meta, errorId: primaryResult.errorId });
    }
  }

  logger.warn(`[Gemini] Primary model (${PRIMARY_MODEL}) failed completely. Fallback to ${FALLBACK_MODEL}`, { ...meta, errorId: primaryResult.errorId });

  const fallbackResult = await withTimeoutAndRetry(() => fallbackModel.generateContent(prompt), meta, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
    modelName: FALLBACK_MODEL,
  });

  if (fallbackResult.success) {
    try {
      const text = fallbackResult.data?.response?.text?.().trim() || '';
      const duration = Date.now() - startTime;
      metrics.inc('ai_request_success_total');
      metrics.observeLatency('ai_latency_ms', duration);
      logger.info(`[Gemini] Request succeeded using ${FALLBACK_MODEL} in ${duration}ms`, { ...meta, errorId: fallbackResult.errorId });
      return { success: true, data: text, errorId: fallbackResult.errorId };
    } catch (err) {
      logger.warn(`[Gemini] Failed to parse fallback response: ${err.message}`, { ...meta, errorId: fallbackResult.errorId });
    }
  }

  metrics.inc('ai_request_error_total');
  logger.error(`[Gemini] Fallback model (${FALLBACK_MODEL}) failed: ${fallbackResult.message}`, { ...meta, errorId: fallbackResult.errorId || primaryResult.errorId });
  return {
    success: false,
    errorId: fallbackResult.errorId || primaryResult.errorId,
    message: fallbackResult.message || 'Gemini request failed',
  };
};

const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const buildDeterministicCopilotSummary = (tripContext) => {
  const totalSpentRupees = Number(tripContext.totalSpentRupees || 0);
  const settlements = Array.isArray(tripContext.settlements) ? tripContext.settlements : [];
  const balances = Object.entries(tripContext.balances || {});

  const topBalance = balances
    .map(([username, balance]) => ({ username, amount: Number(balance?.net || 0) }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  if (settlements.length > 0) {
    const primary = settlements[0];
    const restCount = settlements.length - 1;
    return [
      `Trip total spent: ${formatINR(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses.`,
      `To settle up, ${primary.from} needs to pay ${primary.to} ${formatINR(primary.amount)}.`,
      restCount > 0
        ? `There ${restCount === 1 ? 'is' : 'are'} ${restCount} more settlement ${restCount === 1 ? 'payment' : 'payments'} in the trip summary.`
        : 'Once that payment is made, everyone will be fully settled.',
    ].join(' ');
  }

  if (topBalance) {
    if (topBalance.amount > 0) {
      return `Trip total spent: ${formatINR(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses. ${topBalance.username} is owed ${formatINR(topBalance.amount)}.`;
    }
    if (topBalance.amount < 0) {
      return `Trip total spent: ${formatINR(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses. ${topBalance.username} owes ${formatINR(Math.abs(topBalance.amount))}.`;
    }
  }

  return `Trip total spent: ${formatINR(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses. All balances are settled.`;
};

const extractCurrencyAmounts = (text = '') => {
  const matches = [...String(text).matchAll(/₹\s*([\d,]+(?:\.\d{1,2})?)/g)];
  return matches
    .map((match) => Number(String(match[1]).replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value >= 0);
};

const looksSuspicious = (text, tripContext) => {
  const amounts = extractRupeeAmounts(text);
  if (!amounts.length) return false;

  const totalSpentRupees = Number(tripContext.totalSpentRupees || 0);
  const settlementMax = Math.max(
    0,
    ...Object.values(tripContext.balances || {}).map((value) => Math.abs(Number(value || 0))),
    ...(Array.isArray(tripContext.settlements) ? tripContext.settlements.map((s) => Math.abs(Number(s.amount || 0))) : []),
  );
  const maxReasonable = Math.max(totalSpentRupees, settlementMax, 1) * 10;

  return amounts.some((amount) => amount > maxReasonable);
};

// ─── Rule-based Fast Keyword Classifier (Tier 1: 0ms, 0 API Calls) ───────────
const extractRupeeAmounts = (text = '') => {
  const matches = [...String(text).matchAll(/[₹â‚¹]\s*([\d,]+(?:\.\d{1,2})?)/g)];
  return matches
    .map((match) => Number(String(match[1]).replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value >= 0);
};

const collectAuthoritativeAmounts = (source = {}) => {
  const amounts = new Set();
  const push = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    amounts.add(numeric.toFixed(2));
  };

  push(source?.summary?.total_expenses);
  push(source?.totalSpentRupees);

  for (const expense of source?.expenses || []) {
    push(expense?.amountRupees);
  }

  for (const balance of Object.values(source?.balances || {})) {
    push(balance?.paid);
    push(balance?.owes);
    push(balance?.net);
  }

  for (const settlement of source?.settlements || []) {
    push(settlement?.amount);
  }

  for (const amount of Object.values(source?.spendingByCategory || {})) {
    push(amount);
  }

  return amounts;
};

const hasMismatchedAmounts = (text, source) => {
  const amounts = extractRupeeAmounts(text);
  if (!amounts.length) return false;

  const authoritative = collectAuthoritativeAmounts(source);
  return amounts.some((amount) => !authoritative.has(Number(amount).toFixed(2)));
};

const RUPEE_SYMBOL_SAFE = '\u20B9';

const formatINRSafe = (value) =>
  `${RUPEE_SYMBOL_SAFE}${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const buildDeterministicSettlementExplanationSafe = (settlementData = {}, username = '') => {
  const settlements = Array.isArray(settlementData.settlements) ? settlementData.settlements : [];
  const balances = settlementData.balances || {};
  const summary = settlementData.summary || {};
  const focusName = username ? `@${username}` : 'this user';
  const total = Number(summary.total_expenses || 0);

  if (settlements.length > 0) {
    const primary = settlements[0];
    const restCount = settlements.length - 1;
    return [
      `${focusName} should settle the trip by paying ${primary.to} ${formatINRSafe(primary.amount)}.`,
      `That comes from a total trip spend of ${formatINRSafe(total)} across ${Number(summary.total_expenses_count || 0)} expenses.`,
      restCount > 0
        ? `There ${restCount === 1 ? 'is' : 'are'} ${restCount} more settlement ${restCount === 1 ? 'payment' : 'payments'} in the group summary.`
        : 'Once that payment is made, the trip is fully settled.',
    ].join(' ');
  }

  const balanceEntries = Object.entries(balances).map(([name, balance]) => ({
    name,
    amount: Number(balance?.net || 0),
  }));
  const topBalance = balanceEntries.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  if (topBalance) {
    if (topBalance.amount > 0) {
      return `${focusName} is owed ${formatINRSafe(topBalance.amount)} from a total trip spend of ${formatINRSafe(total)} across ${Number(summary.total_expenses_count || 0)} expenses.`;
    }
    if (topBalance.amount < 0) {
      return `${focusName} owes ${formatINRSafe(Math.abs(topBalance.amount))} from a total trip spend of ${formatINRSafe(total)} across ${Number(summary.total_expenses_count || 0)} expenses.`;
    }
  }

  return `The trip is fully settled. Total spend: ${formatINRSafe(total)} across ${Number(summary.total_expenses_count || 0)} expenses.`;
};

const buildDeterministicCopilotSummarySafe = (tripContext) => {
  const totalSpentRupees = Number(tripContext.totalSpentRupees || 0);
  const settlements = Array.isArray(tripContext.settlements) ? tripContext.settlements : [];
  const balances = Object.entries(tripContext.balances || {});

  const topBalance = balances
    .map(([username, balance]) => ({ username, amount: Number(balance?.net || 0) }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  if (settlements.length > 0) {
    const primary = settlements[0];
    const restCount = settlements.length - 1;
    return [
      `Trip total spent: ${formatINRSafe(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses.`,
      `To settle up, ${primary.from} needs to pay ${primary.to} ${formatINRSafe(primary.amount)}.`,
      restCount > 0
        ? `There ${restCount === 1 ? 'is' : 'are'} ${restCount} more settlement ${restCount === 1 ? 'payment' : 'payments'} in the trip summary.`
        : 'Once that payment is made, everyone will be fully settled.',
    ].join(' ');
  }

  if (topBalance) {
    if (topBalance.amount > 0) {
      return `Trip total spent: ${formatINRSafe(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses. ${topBalance.username} is owed ${formatINRSafe(topBalance.amount)}.`;
    }
    if (topBalance.amount < 0) {
      return `Trip total spent: ${formatINRSafe(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses. ${topBalance.username} owes ${formatINRSafe(Math.abs(topBalance.amount))}.`;
    }
  }

  return `Trip total spent: ${formatINRSafe(totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses. All balances are settled.`;
};

const extractRupeeAmountsSafe = (text = '') => {
  const matches = [...String(text).matchAll(/\u20B9\s*([\d,]+(?:\.\d{1,2})?)/g)];
  return matches
    .map((match) => Number(String(match[1]).replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value >= 0);
};

const collectAuthoritativeAmountsSafe = (source = {}) => {
  const amounts = new Set();
  const push = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    amounts.add(numeric.toFixed(2));
  };

  push(source?.summary?.total_expenses);
  push(source?.totalSpentRupees);

  for (const expense of source?.expenses || []) {
    push(expense?.amountRupees);
  }

  for (const balance of Object.values(source?.balances || {})) {
    push(balance?.paid);
    push(balance?.owes);
    push(balance?.net);
  }

  for (const settlement of source?.settlements || []) {
    push(settlement?.amount);
  }

  for (const amount of Object.values(source?.spendingByCategory || {})) {
    push(amount);
  }

  return amounts;
};

const hasMismatchedAmountsSafe = (text, source) => {
  const amounts = extractRupeeAmountsSafe(text);
  if (!amounts.length) return false;

  const authoritative = collectAuthoritativeAmountsSafe(source);
  return amounts.some((amount) => !authoritative.has(Number(amount).toFixed(2)));
};

const looksSuspiciousSafe = (text, tripContext) => {
  const amounts = extractRupeeAmountsSafe(text);
  if (!amounts.length) return false;

  const totalSpentRupees = Number(tripContext.totalSpentRupees || 0);
  const settlementMax = Math.max(
    0,
    ...Object.values(tripContext.balances || {}).map((value) => Math.abs(Number(value?.net ?? value ?? 0))),
    ...(Array.isArray(tripContext.settlements) ? tripContext.settlements.map((s) => Math.abs(Number(s.amount || 0))) : []),
  );
  const maxReasonable = Math.max(totalSpentRupees, settlementMax, 1) * 10;

  return amounts.some((amount) => amount > maxReasonable);
};

const KEYWORD_MAP = [
  { keywords: ['flight', 'fly', 'indigo', 'airasia', 'vistara', 'uber', 'ola', 'cab', 'taxi', 'petrol', 'diesel', 'fuel', 'bus', 'train', 'irctc', 'toll', 'auto', 'metro', 'driver', 'parking'], category: 'Transport' },
  { keywords: ['hotel', 'resort', 'stay', 'airbnb', 'room', 'hostel', 'villa', 'lodge', 'booking', 'checkin', 'checkout'], category: 'Accommodation' },
  { keywords: ['dinner', 'lunch', 'breakfast', 'food', 'restaurant', 'cafe', 'coffee', 'zomato', 'swiggy', 'starbucks', 'mcdonald', 'kfc', 'pizza', 'burger', 'tea', 'snack', 'drinks', 'bar', 'dhaba', 'biryani'], category: 'Food' },
  { keywords: ['movie', 'cinema', 'pvr', 'ticket', 'netflix', 'game', 'park', 'bowling', 'pub', 'club', 'party', 'entry', 'concert', 'museum'], category: 'Entertainment' },
  { keywords: ['shopping', 'mall', 'clothes', 'zara', 'h&m', 'nike', 'amazon', 'flipkart', 'dress', 'shoes', 'souvenir', 'market'], category: 'Shopping' },
  { keywords: ['electricity', 'water', 'recharge', 'wifi', 'internet', 'gas', 'bill', 'mobile', 'sim'], category: 'Utilities' },
];

/**
 * Fast Rule-Based Local Classifier
 */
const classifyLocally = (desc) => {
  const normalized = desc.toLowerCase().trim();
  for (const rule of KEYWORD_MAP) {
    if (rule.keywords.some(kw => normalized.includes(kw))) {
      return rule.category;
    }
  }
  return null;
};

/**
 * Infer category from expense description using Tiered Classifier:
 * - Tier 1: Instant Local Rule Classifier (0ms)
 * - Tier 2: Redis Cache (1ms)
 * - Tier 3: Hardened Gemini Flash API with timeout/retry
 */
export const suggestCategory = async (description, meta = {}) => {
  if (!description || !description.trim()) {
    return { category: 'Other', confidence: 0.5, ai_suggested: false, source: 'default' };
  }

  const cleanDesc = description.trim();

  // Tier 1: Local Rule Engine
  const localMatch = classifyLocally(cleanDesc);
  if (localMatch) {
    return { category: localMatch, confidence: 0.95, ai_suggested: true, source: 'rule_engine' };
  }

  // Tier 2: Redis Cache Check
  try {
    const { getCache, setCache } = await import('./redisClient.js');
    const cacheKey = `cat_cache:${cleanDesc.toLowerCase()}`;
    const cachedCat = await getCache(cacheKey);
    if (cachedCat) {
      return { category: cachedCat, confidence: 0.9, ai_suggested: true, source: 'redis_cache' };
    }

    // Tier 3: Gemini API
    if (!genAI) {
      return { category: 'Other', confidence: 0.5, ai_suggested: false, source: 'fallback' };
    }

    const prompt = `Classify this expense description into EXACTLY ONE of the following categories: ${ALLOWED_CATEGORIES.join(', ')}.
Expense Description: "${cleanDesc}"
Respond with ONLY a JSON object: {"category": "<category_name>", "confidence": <0.0_to_1.0>}`;

    const aiResult = await generateContentWithFallback(prompt, meta);
    if (aiResult.success && aiResult.data) {
      const jsonMatch = aiResult.data.match(/{[\s\S]*}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (ALLOWED_CATEGORIES.includes(parsed.category)) {
          await setCache(cacheKey, parsed.category, 604800); // 7 day TTL
          return {
            category: parsed.category,
            confidence: parseFloat(parsed.confidence) || 0.9,
            ai_suggested: true,
            source: 'gemini_api',
          };
        }
      }
    }
  } catch (err) {
    logger.warn(`[Gemini] Category inference failed: ${err.message}`, meta);
  }

  return { category: 'Other', confidence: 0.5, ai_suggested: false, source: 'fallback' };
};

/**
 * Generate human-readable explanation for trip debt settlements.
 */
export const explainSettlements = async (settlementData, username = '', meta = {}) => {
  if (!genAI) {
    return buildDeterministicSettlementExplanationSafe(settlementData, username);
  }

  try {
    const prompt = `You are a helpful financial assistant for a group trip expense management app called TripSync.
Analyze the following trip settlement data and produce a clear, friendly, personalized financial breakdown.

Target Logged-In User: @${username || 'user'}

Settlement Data:
${JSON.stringify(settlementData, null, 2)}

STRICT RULES & FORMATTING:
1. ALWAYS use the Indian Rupee symbol (${RUPEE_SYMBOL_SAFE}) for all currency amounts (e.g., ${RUPEE_SYMBOL_SAFE}1,500). NEVER use Dollar ($) or any other currency symbol under any circumstances.
2. Address the breakdown directly to @${username || 'user'}. Explain specifically:
   - How much @${username || 'user'} paid in total vs their calculated share.
   - Exactly how much @${username || 'user'} needs to GIVE to others or TAKE from others to settle up, and WHY.
3. The settlement array is authoritative. Do not recalculate, divide, multiply, estimate, or change any settlement amount.
4. If there are other member settlements, summarize them in 1 short sentence at the end.
5. Keep the explanation under 3 short, friendly paragraphs. Avoid repeating raw JSON code.`;

    const aiResult = await generateContentWithFallback(prompt, meta);
    if (aiResult.success) {
      const explanation = aiResult.data || '';
      if (!explanation || hasMismatchedAmountsSafe(explanation, settlementData)) {
        logger.warn('[Gemini] Settlement explanation looked inconsistent; using deterministic fallback', meta);
        return buildDeterministicSettlementExplanationSafe(settlementData, username);
      }
      return explanation;
    }

    logger.warn(`[Gemini] Settlement explanation failed: ${aiResult.message}`, { ...meta, errorId: aiResult.errorId });
    return buildDeterministicSettlementExplanationSafe(settlementData, username);
  } catch (err) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.error(`[Gemini] Settlement explanation failed: ${err.message}`, { ...meta, errorId });
    return buildDeterministicSettlementExplanationSafe(settlementData, username);
  }
};

export const copilotAnswer = async (tripContext, userQuestion, chatHistory = [], meta = {}) => {
  if (!genAI) {
    return buildDeterministicCopilotSummarySafe(tripContext);
  }

  const contextBlock = [
    `== TRIP: ${tripContext.tripName || 'Unknown Trip'} ==`,
    `Members: ${(tripContext.members || []).join(', ')}`,
    `Total Spent: ${formatINRSafe(tripContext.totalSpentRupees)} across ${tripContext.expenseCount || 0} expenses`,
    '',
    '-- EXPENSES --',
    (tripContext.expenses || []).map((e) =>
      `  [${e.date}] ${e.description} — ${formatINRSafe(e.amountRupees)} paid by ${e.paid_by} | Category: ${e.category} | Split among: ${(e.participants || []).join(', ')}`
    ).join('\n'),
    '',
    '-- NET BALANCES (positive = owed money, negative = owes) --',
    Object.entries(tripContext.balances || {}).map(([u, b]) =>
      `  ${u}: ${formatINRSafe(Number(b?.net || 0))}`
    ).join('\n'),
    '',
    '-- SETTLEMENTS NEEDED --',
    (tripContext.settlements || []).length > 0
      ? (tripContext.settlements || []).map((s) =>
          `  ${s.from} pays ${s.to} ${formatINRSafe(s.amount)}`
        ).join('\n')
      : '  All settled!',
    '',
    '-- SPENDING BY CATEGORY --',
    Object.entries(tripContext.spendingByCategory || {}).map(([cat, amt]) =>
      `  ${cat}: ${formatINRSafe(amt)}`
    ).join('\n'),
  ].join('\n');

  const historyBlock = chatHistory.length > 0
    ? '\n\n== PREVIOUS CONVERSATION ==\n' +
      chatHistory.map((h) => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`).join('\n')
    : '';

  const prompt = `You are TripSync's AI Financial Copilot — a friendly, smart assistant that answers questions about group trip expenses with precision.

You have access to the following real trip data:
${contextBlock}${historyBlock}

== USER QUESTION ==
${userQuestion}

STRICT INSTRUCTIONS:
- ALWAYS use the Indian Rupee symbol (${RUPEE_SYMBOL_SAFE}) for all currency amounts (e.g. ${RUPEE_SYMBOL_SAFE}500, ${RUPEE_SYMBOL_SAFE}2,500). NEVER use Dollar ($) or any other currency symbol under any circumstances.
- The trip context below is authoritative. Do not recalculate settlement amounts, and do not divide or multiply rupee values unless a field is explicitly labeled as paise.
- Copy settlement amounts exactly from the settlements array if you mention them.
- Answer concisely and accurately using ONLY the trip data above.
- Mention specific amounts in ${RUPEE_SYMBOL_SAFE} and member names.
- Keep answers under 150 words unless the question genuinely requires more detail.
- Be conversational, helpful, and friendly.`;

  try {
    const aiResult = await generateContentWithFallback(prompt, meta);
    if (aiResult.success) {
      const answer = aiResult.data || '';
      if (looksSuspiciousSafe(answer, tripContext) || hasMismatchedAmountsSafe(answer, tripContext)) {
        logger.warn('[Gemini] Copilot output looked inconsistent; using deterministic fallback', meta);
        return buildDeterministicCopilotSummarySafe(tripContext);
      }
      return answer || buildDeterministicCopilotSummarySafe(tripContext);
    }

    const errorId = aiResult.errorId || `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.warn(`[Gemini] Copilot answer failed: ${aiResult.message}`, { ...meta, errorId });
    return buildDeterministicCopilotSummarySafe(tripContext);
  } catch (err) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.error(`[Gemini] Copilot answer failed: ${err.message}`, { ...meta, errorId });
    return buildDeterministicCopilotSummarySafe(tripContext);
  }
};
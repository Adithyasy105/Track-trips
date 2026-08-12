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

// ─── Rule-based Fast Keyword Classifier (Tier 1: 0ms, 0 API Calls) ───────────
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
    return '✨ AI Insights are currently unavailable. You can review the exact debt breakdown and balances in the summary cards below!';
  }

  try {
    const prompt = `You are a helpful financial assistant for a group trip expense management app called TripSync.
Analyze the following trip settlement data and produce a clear, friendly, personalized financial breakdown.

Target Logged-In User: @${username || 'user'}

Settlement Data:
${JSON.stringify(settlementData, null, 2)}

STRICT RULES & FORMATTING:
1. ALWAYS use the Indian Rupee symbol (₹) for all currency amounts (e.g., ₹1,500). NEVER use Dollar ($) or any other currency symbol under any circumstances.
2. Address the breakdown directly to @${username || 'user'}. Explain specifically:
   - How much @${username || 'user'} paid in total vs their calculated share.
   - Exactly how much @${username || 'user'} needs to GIVE to others or TAKE from others to settle up, and WHY.
3. If there are other member settlements, summarize them in 1 short sentence at the end.
4. Keep the explanation under 3 short, friendly paragraphs. Avoid repeating raw JSON code.`;

    const aiResult = await generateContentWithFallback(prompt, meta);
    if (aiResult.success) {
      return aiResult.data || '✨ AI Insights are currently unavailable. You can review the exact debt breakdown and balances in the summary cards below!';
    }

    logger.warn(`[Gemini] Settlement explanation failed: ${aiResult.message}`, { ...meta, errorId: aiResult.errorId });
    return '✨ AI Insights are currently unavailable. You can review the exact debt breakdown and balances in the summary cards below!';
  } catch (err) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.error(`[Gemini] Settlement explanation failed: ${err.message}`, { ...meta, errorId });
    return '✨ AI Insights are currently unavailable. You can review the exact debt breakdown and balances in the summary cards below!';
  }
};

/**
 * AI Financial Copilot — answers natural-language questions about a trip.
 */
export const copilotAnswer = async (tripContext, userQuestion, chatHistory = [], meta = {}) => {
  if (!genAI) {
    return "🤖 AI Financial Copilot is currently offline. You can view all trip balances, expenses, and settlements directly in the trip tabs!";
  }

  const contextBlock = [
    `== TRIP: ${tripContext.tripName || 'Unknown Trip'} ==`,
    `Members: ${tripContext.members.join(', ')}`,
    `Total Spent: ₹${(tripContext.totalSpent / 100).toFixed(2)} across ${tripContext.expenseCount} expenses`,
    '',
    '-- EXPENSES --',
    tripContext.expenses.map(e =>
      `  [${e.date}] ${e.description} — ₹${(e.amount_paise / 100).toFixed(2)} paid by ${e.paid_by} | Category: ${e.category} | Split among: ${e.participants.join(', ')}`
    ).join('\n'),
    '',
    '-- NET BALANCES (positive = owed money, negative = owes) --',
    Object.entries(tripContext.balances).map(([u, b]) =>
      `  ${u}: ₹${(b / 100).toFixed(2)}`
    ).join('\n'),
    '',
    '-- SETTLEMENTS NEEDED --',
    tripContext.settlements.length > 0
      ? tripContext.settlements.map(s =>
          `  ${s.from} pays ${s.to} ₹${(s.amount / 100).toFixed(2)}`
        ).join('\n')
      : '  All settled!',
    '',
    '-- SPENDING BY CATEGORY --',
    Object.entries(tripContext.spendingByCategory || {}).map(([cat, amt]) =>
      `  ${cat}: ₹${(amt / 100).toFixed(2)}`
    ).join('\n'),
  ].join('\n');

  const historyBlock = chatHistory.length > 0
    ? '\n\n== PREVIOUS CONVERSATION ==\n' +
      chatHistory.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.text}`).join('\n')
    : '';

  const prompt = `You are TripSync's AI Financial Copilot — a friendly, smart assistant that answers questions about group trip expenses with precision.

You have access to the following real trip data:
${contextBlock}${historyBlock}

== USER QUESTION ==
${userQuestion}

STRICT INSTRUCTIONS:
- ALWAYS use the Indian Rupee symbol (₹) for all currency amounts (e.g. ₹500, ₹2,500). NEVER use Dollar ($) or any other currency symbol under any circumstances.
- Answer concisely and accurately using ONLY the trip data above.
- Mention specific amounts in ₹ and member names.
- Keep answers under 150 words unless the question genuinely requires more detail.
- Be conversational, helpful, and friendly.`;

  try {
    const aiResult = await generateContentWithFallback(prompt, meta);
    if (aiResult.success) {
      return aiResult.data || "🤖 AI Financial Copilot is currently offline. You can view all trip balances, expenses, and settlements directly in the trip tabs!";
    }

    const errorId = aiResult.errorId || `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.warn(`[Gemini] Copilot answer failed: ${aiResult.message}`, { ...meta, errorId });
    return "🤖 I encountered a temporary issue analyzing your trip data. Please try asking again!";
  } catch (err) {
    const errorId = `err_ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    logger.error(`[Gemini] Copilot answer failed: ${err.message}`, { ...meta, errorId });
    return "🤖 I encountered a temporary issue analyzing your trip data. Please try asking again!";
  }
};

// src/utils/settlementAlgo.js
// Single source of truth for the Greedy Debt Simplification Algorithm.
// Uses integer paise (1 rupee = 100 paise) for all arithmetic to eliminate
// floating-point accumulation errors. Converts to rupees only at output.
//
// Interview talking point:
//   "₹100 / 6 people = ₹16.666... — rounding each share independently
//    gives ₹16.67 × 6 = ₹100.02, creating ₹0.02 from nothing. Instead,
//    we distribute the remainder (4 paise) to the first 4 participants
//    deterministically. Total is always guaranteed to equal the expense amount."

/**
 * Filter expenses to only include those where payer AND all participants
 * are current trip members. Prevents removed members from affecting balances.
 *
 * @param {Array} expenses - Raw expense rows from DB
 * @param {Set<string>} memberSet - Set of valid trip member usernames
 * @returns {Array} validExpenses
 */
export function filterValidExpenses(expenses, memberSet) {
  return (expenses || []).filter(expense => {
    if (!memberSet.has(expense.payer_username)) return false;
    if (expense.participants && expense.participants.length > 0) {
      return expense.participants.every(p => memberSet.has(p));
    }
    return true;
  });
}

/**
 * Greedy Debt Simplification Algorithm.
 * Minimizes the number of transactions needed to settle all debts for a trip.
 *
 * @param {Array}       validExpenses      - Expenses pre-filtered to trip members only
 * @param {Set<string>} memberSet          - Set of valid trip member usernames
 * @param {Array}       completedPayments  - Payments with status='completed'
 * @returns {{
 *   balances:    { [username]: { paid: number, owes: number, net: number } },
 *   settlements: Array<{ from: string, to: string, amount: number }>
 * }}
 */
export function computeSettlements(validExpenses, memberSet, completedPayments = []) {
  // ── Step 1: Initialize integer-paise accumulators for all trip members ──
  const paidPaise = {};
  const owesPaise = {};
  for (const u of memberSet) {
    paidPaise[u] = 0;
    owesPaise[u] = 0;
  }

  // ── Step 2: Process each expense with integer paise arithmetic ──
  for (const expense of validExpenses) {
    const { payer_username, amount, participants } = expense;
    if (!participants || participants.length === 0) continue;

    const totalPaise = Math.round(parseFloat(amount) * 100);
    const n = participants.length;
    const basePaise = Math.floor(totalPaise / n);
    const remainder = totalPaise % n;
    // Proof: basePaise*n + remainder = totalPaise always ✓

    // Credit the payer in full
    if (paidPaise[payer_username] !== undefined) {
      paidPaise[payer_username] += totalPaise;
    }

    // Debit each participant their share (first `remainder` get 1 extra paisa)
    participants.forEach((participant, i) => {
      if (owesPaise[participant] !== undefined) {
        owesPaise[participant] += basePaise + (i < remainder ? 1 : 0);
      }
    });
  }

  // ── Step 3: Compute net balance in paise ──
  const netPaise = {};
  for (const u of memberSet) {
    netPaise[u] = paidPaise[u] - owesPaise[u];
  }

  // ── Step 4: Factor in completed payments ──
  for (const p of completedPayments) {
    const paise = Math.round(parseFloat(p.amount) * 100);
    if (netPaise[p.from_username] !== undefined) netPaise[p.from_username] += paise;
    if (netPaise[p.to_username]   !== undefined) netPaise[p.to_username]   -= paise;
  }

  // ── Step 5: Build rupee balances for API response ──
  const balances = {};
  for (const u of memberSet) {
    balances[u] = {
      paid: parseFloat((paidPaise[u]  / 100).toFixed(2)),
      owes: parseFloat((owesPaise[u]  / 100).toFixed(2)),
      net:  parseFloat((netPaise[u]   / 100).toFixed(2)),
    };
  }

  // ── Step 6: Partition into creditors and debtors ──
  // 1 paisa threshold — anything smaller is floating-point noise, not a real debt
  const THRESHOLD = 1; // paise

  const creditors = [];
  const debtors   = [];

  for (const u of memberSet) {
    const net = netPaise[u];
    if (net >  THRESHOLD) creditors.push({ username: u, amountPaise: net });
    if (net < -THRESHOLD) debtors.push({   username: u, amountPaise: Math.abs(net) });
  }

  // ── Step 7: Sort largest-first (greedy optimal) ──
  creditors.sort((a, b) => b.amountPaise - a.amountPaise);
  debtors.sort(  (a, b) => b.amountPaise - a.amountPaise);

  // ── Step 8: Two-pointer greedy matching ──
  const settlements = [];
  let ci = 0, di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor   = debtors[di];
    const settlePaise = Math.min(creditor.amountPaise, debtor.amountPaise);

    if (settlePaise >= THRESHOLD) {
      settlements.push({
        from:   debtor.username,
        to:     creditor.username,
        amount: parseFloat((settlePaise / 100).toFixed(2)),
      });
    }

    creditor.amountPaise -= settlePaise;
    debtor.amountPaise   -= settlePaise;

    if (creditor.amountPaise < THRESHOLD) ci++;
    if (debtor.amountPaise   < THRESHOLD) di++;
  }

  return { balances, settlements };
}

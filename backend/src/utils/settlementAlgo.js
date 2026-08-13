// src/utils/settlementAlgo.js
import { resolveExpenseAllocations, normalizeParticipants } from './splitEngine.js';

export function filterValidExpenses(expenses, memberSet) {
  return (expenses || []).filter((expense) => {
    if (!expense || !expense.payer_username || !memberSet.has(expense.payer_username)) return false;

    const participants = normalizeParticipants(expense.participants || []);
    const explicitParticipants = Array.isArray(expense.participant_allocations)
      ? expense.participant_allocations.map((entry) => entry.username)
      : [];
    const allParticipants = normalizeParticipants([...participants, ...explicitParticipants]);

    if (!allParticipants.length) return false;
    return allParticipants.every((username) => memberSet.has(username));
  });
}

export function computeSettlements(validExpenses, memberSet, completedPayments = []) {
  const paidPaise = {};
  const owesPaise = {};

  for (const username of memberSet) {
    paidPaise[username] = 0;
    owesPaise[username] = 0;
  }

  for (const expense of validExpenses) {
    const payer = expense.payer_username;
    if (!payer || paidPaise[payer] === undefined) continue;

    const totalPaise = Math.round(Number(expense.amount || 0) * 100);
    paidPaise[payer] += totalPaise;

    const allocations = resolveExpenseAllocations({
      ...expense,
      participants: expense.participants || [],
      split_type: expense.split_type || 'EQUAL',
      split_data: expense.split_data || {},
    }, memberSet);

    for (const allocation of allocations) {
      const target = allocation.username;
      if (owesPaise[target] === undefined) {
        owesPaise[target] = 0;
      }
      owesPaise[target] += Number(allocation.amountPaise || 0);
    }
  }

  const netPaise = {};
  for (const username of memberSet) {
    netPaise[username] = paidPaise[username] - owesPaise[username];
  }

  for (const payment of completedPayments || []) {
    const from = payment.from_username;
    const to = payment.to_username;
    const amountPaise = Math.round(Number(payment.amount || 0) * 100);
    if (from && netPaise[from] !== undefined) netPaise[from] += amountPaise;
    if (to && netPaise[to] !== undefined) netPaise[to] -= amountPaise;
  }

  const balances = {};
  for (const username of memberSet) {
    balances[username] = {
      paid: Number((paidPaise[username] / 100).toFixed(2)),
      owes: Number((owesPaise[username] / 100).toFixed(2)),
      net: Number((netPaise[username] / 100).toFixed(2)),
    };
  }

  const THRESHOLD = 1;
  const creditors = [];
  const debtors = [];

  for (const username of memberSet) {
    const net = netPaise[username];
    if (net > THRESHOLD) creditors.push({ username, amountPaise: net });
    if (net < -THRESHOLD) debtors.push({ username, amountPaise: Math.abs(net) });
  }

  creditors.sort((a, b) => b.amountPaise - a.amountPaise);
  debtors.sort((a, b) => b.amountPaise - a.amountPaise);

  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const settlePaise = Math.min(creditor.amountPaise, debtor.amountPaise);

    if (settlePaise >= THRESHOLD) {
      settlements.push({
        from: debtor.username,
        to: creditor.username,
        amount: Number((settlePaise / 100).toFixed(2)),
      });
    }

    creditor.amountPaise -= settlePaise;
    debtor.amountPaise -= settlePaise;

    if (creditor.amountPaise < THRESHOLD) creditorIndex += 1;
    if (debtor.amountPaise < THRESHOLD) debtorIndex += 1;
  }

  return { balances, settlements };
}

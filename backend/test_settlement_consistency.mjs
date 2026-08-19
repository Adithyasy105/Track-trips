#!/usr/bin/env node
import assert from 'node:assert/strict';

import { computeSettlements, filterValidExpenses, buildSettlementSnapshot } from './src/utils/settlementAlgo.js';

const expectSettlement = (settlements, from, to, amount) => {
  const match = settlements.find((settlement) => settlement.from === from && settlement.to === to);
  assert.ok(match, `Expected settlement ${from} -> ${to} to exist`);
  assert.equal(Number(match.amount.toFixed(2)), Number(amount.toFixed(2)));
};

const sortAmounts = (settlements) =>
  settlements
    .map((settlement) => Number(settlement.amount.toFixed(2)))
    .sort((a, b) => a - b);

console.log('\n=== SETTLEMENT CONSISTENCY TESTS ===\n');

// 1. Two-person settlement
{
  const members = new Set(['alice', 'bob']);
  const expenses = [
    {
      payer_username: 'alice',
      amount: 100,
      participants: ['alice', 'bob'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  const result = computeSettlements(expenses, members, []);
  assert.deepEqual(result.balances.alice, { paid: 100, owes: 50, net: 50 });
  assert.deepEqual(result.balances.bob, { paid: 0, owes: 50, net: -50 });
  assert.equal(result.settlements.length, 1);
  expectSettlement(result.settlements, 'bob', 'alice', 50);
  console.log('✓ Two-person settlement');
}

// 2. Multiple creditors and debtors
{
  const members = new Set(['alice', 'bob', 'charlie', 'dana']);
  const expenses = [
    {
      payer_username: 'alice',
      amount: 120,
      participants: ['alice', 'bob'],
      split_type: 'EQUAL',
      split_data: {},
    },
    {
      payer_username: 'charlie',
      amount: 90,
      participants: ['charlie', 'dana'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  const result = computeSettlements(expenses, members, []);
  assert.equal(result.settlements.length, 2);
  expectSettlement(result.settlements, 'bob', 'alice', 60);
  expectSettlement(result.settlements, 'dana', 'charlie', 45);
  console.log('✓ Multiple creditors and debtors');
}

// 3. Completed payments reduce the remaining settlement
{
  const members = new Set(['alice', 'bob']);
  const expenses = [
    {
      payer_username: 'alice',
      amount: 100,
      participants: ['alice', 'bob'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  const result = computeSettlements(expenses, members, [
    { from_username: 'bob', to_username: 'alice', amount: 20 },
  ]);
  assert.equal(result.settlements.length, 1);
  expectSettlement(result.settlements, 'bob', 'alice', 30);
  assert.deepEqual(result.balances.alice, { paid: 100, owes: 70, net: 30 });
  assert.deepEqual(result.balances.bob, { paid: 20, owes: 50, net: -30 });
  console.log('✓ Completed payments');
}

// 4. Expense deletion changes the snapshot
{
  const members = new Set(['alice', 'bob']);
  const fullExpenses = [
    {
      payer_username: 'alice',
      amount: 100,
      participants: ['alice', 'bob'],
      split_type: 'EQUAL',
      split_data: {},
    },
    {
      payer_username: 'bob',
      amount: 20,
      participants: ['alice', 'bob'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  const before = buildSettlementSnapshot(fullExpenses, members, []);
  const after = buildSettlementSnapshot(fullExpenses.slice(0, 1), members, []);
  expectSettlement(before.settlements, 'bob', 'alice', 40);
  expectSettlement(after.settlements, 'bob', 'alice', 50);
  assert.equal(before.summary.total_expenses, 120);
  assert.equal(after.summary.total_expenses, 100);
  console.log('✓ Expense deletion');
}

// 5. Member removal filters out invalid expenses
{
  const members = new Set(['alice', 'bob']);
  const expenses = [
    {
      payer_username: 'alice',
      amount: 75,
      participants: ['alice', 'bob', 'charlie'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  assert.equal(filterValidExpenses(expenses, members).length, 0);
  console.log('✓ Member removal filtering');
}

// 6. Unequal split / remainder handling
{
  const members = new Set(['alice', 'bob', 'charlie']);
  const expenses = [
    {
      payer_username: 'alice',
      amount: 100.01,
      participants: ['alice', 'bob', 'charlie'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  const result = computeSettlements(expenses, members, []);
  assert.deepEqual(sortAmounts(result.settlements), [33.33, 33.34]);
  const netTotal =
    Number(result.balances.alice.net.toFixed(2)) +
    Number(result.balances.bob.net.toFixed(2)) +
    Number(result.balances.charlie.net.toFixed(2));
  assert.equal(Number(netTotal.toFixed(2)), 0);
  console.log('✓ Unequal split and remainder handling');
}

// 7. Exact current two-person settlement amount
{
  const members = new Set(['adi', 'tester2']);
  const expenses = [
    {
      payer_username: 'adi',
      amount: 1250,
      participants: ['adi', 'tester2'],
      split_type: 'EQUAL',
      split_data: {},
    },
    {
      payer_username: 'tester2',
      amount: 300,
      participants: ['adi', 'tester2'],
      split_type: 'EQUAL',
      split_data: {},
    },
  ];
  const result = computeSettlements(expenses, members, []);
  assert.equal(result.settlements.length, 1);
  assert.deepEqual(result.balances.adi, { paid: 1250, owes: 775, net: 475 });
  assert.deepEqual(result.balances.tester2, { paid: 300, owes: 775, net: -475 });
  assert.deepEqual(result.settlements[0], { from: 'tester2', to: 'adi', amountPaise: 47500, amount: 475 });
  assert.equal(result.balances.adi.net, result.balances.adi.paid - result.balances.adi.owes);
  assert.equal(result.balances.tester2.net, result.balances.tester2.paid - result.balances.tester2.owes);
  assert.equal(result.balances.adi.net + result.balances.tester2.net, 0);
  assert.equal(result.settlements.reduce((sum, settlement) => sum + settlement.amount, 0), 475);
  expectSettlement(result.settlements, 'tester2', 'adi', 475);
  console.log('✓ Exact current settlement amount');
}

console.log('\n=== ALL SETTLEMENT TESTS PASSED ===\n');

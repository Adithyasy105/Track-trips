#!/usr/bin/env node
import {
  resolveExpenseAllocations,
  toPaise,
  normalizeParticipants,
} from './src/utils/splitEngine.js';

import { computeSettlements, filterValidExpenses } from './src/utils/settlementAlgo.js';

console.log('\n=== SPLIT ENGINE UNIT TESTS ===\n');

// Test 1: EQUAL split
console.log('Test 1: EQUAL split (100 ÷ 3 people)');
const test1 = {
  amount: 100,
  participants: ['alice', 'bob', 'charlie'],
  split_type: 'EQUAL',
  split_data: {},
};
const result1 = resolveExpenseAllocations(test1);
console.log('  Allocations:', result1);
const total1 = result1.reduce((sum, a) => sum + (a.amountPaise || 0), 0);
console.log('  Total paise:', total1, '(should be', toPaise(100), ')');
console.log('  Valid:', total1 === toPaise(100) ? '✓' : '✗');

// Test 2: EXACT split
console.log('\nTest 2: EXACT split (alice:30, bob:30, charlie:40)');
const test2 = {
  amount: 100,
  participants: ['alice', 'bob', 'charlie'],
  split_type: 'EXACT',
  split_data: { alice: 30, bob: 30, charlie: 40 },
};
const result2 = resolveExpenseAllocations(test2);
console.log('  Allocations:', result2);
const total2 = result2.reduce((sum, a) => sum + (a.amountPaise || 0), 0);
console.log('  Total paise:', total2, '(should be', toPaise(100), ')');
console.log('  Valid:', total2 === toPaise(100) ? '✓' : '✗');

// Test 3: PERCENTAGE split
console.log('\nTest 3: PERCENTAGE split (alice:50%, bob:30%, charlie:20%)');
const test3 = {
  amount: 100,
  participants: ['alice', 'bob', 'charlie'],
  split_type: 'PERCENTAGE',
  split_data: { alice: 50, bob: 30, charlie: 20 },
};
const result3 = resolveExpenseAllocations(test3);
console.log('  Allocations:', result3);
const total3 = result3.reduce((sum, a) => sum + (a.amountPaise || 0), 0);
console.log('  Total paise:', total3, '(should be', toPaise(100), ')');
console.log('  Valid:', total3 === toPaise(100) ? '✓' : '✗');

// Test 4: SHARES split
console.log('\nTest 4: SHARES split (alice:1, bob:2, charlie:1 share)');
const test4 = {
  amount: 100,
  participants: ['alice', 'bob', 'charlie'],
  split_type: 'SHARES',
  split_data: { alice: 1, bob: 2, charlie: 1 },
};
const result4 = resolveExpenseAllocations(test4);
console.log('  Allocations:', result4);
const total4 = result4.reduce((sum, a) => sum + (a.amountPaise || 0), 0);
console.log('  Total paise:', total4, '(should be', toPaise(100), ')');
console.log('  Valid:', total4 === toPaise(100) ? '✓' : '✗');

// Test 5: ADJUSTMENT split
console.log('\nTest 5: ADJUSTMENT split (alice:+10, bob:+20, charlie: rest)');
const test5 = {
  amount: 100,
  participants: ['alice', 'bob', 'charlie'],
  split_type: 'ADJUSTMENT',
  split_data: { alice: 10, bob: 20, charlie: 0 },
};
const result5 = resolveExpenseAllocations(test5);
console.log('  Allocations:', result5);
const total5 = result5.reduce((sum, a) => sum + (a.amountPaise || 0), 0);
console.log('  Total paise:', total5, '(should be', toPaise(100), ')');
console.log('  Valid:', total5 === toPaise(100) ? '✓' : '✗');

// Test 6: Settlement calculation with EQUAL split
console.log('\n=== SETTLEMENT ENGINE TESTS ===\n');

console.log('Test 6: Settlement with EQUAL split');
const tripMembers = new Set(['alice', 'bob', 'charlie']);
const expenses6 = [
  {
    payer_username: 'alice',
    amount: 300,
    participants: ['alice', 'bob', 'charlie'],
    split_type: 'EQUAL',
    split_data: {},
  },
];
const settlements6 = computeSettlements(expenses6, tripMembers, []);
console.log('  Balances:', settlements6.balances);
console.log('  Settlements:', settlements6.settlements);

// Test 7: Settlement with mixed split types
console.log('\nTest 7: Settlement with mixed EQUAL and EXACT splits');
const expenses7 = [
  {
    payer_username: 'alice',
    amount: 100,
    participants: ['alice', 'bob', 'charlie'],
    split_type: 'EQUAL',
    split_data: {},
  },
  {
    payer_username: 'bob',
    amount: 100,
    participants: ['alice', 'bob', 'charlie'],
    split_type: 'EXACT',
    split_data: { alice: 40, bob: 30, charlie: 30 },
  },
];
const settlements7 = computeSettlements(expenses7, tripMembers, []);
console.log('  Balances:', settlements7.balances);
console.log('  Settlements:', settlements7.settlements);

console.log('\n=== ALL TESTS COMPLETE ===\n');

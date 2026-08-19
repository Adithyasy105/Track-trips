import assert from 'node:assert/strict';
import { buildSettlementSnapshot } from './src/utils/settlementAlgo.js';
import { isAllowedPaymentTransition } from './src/utils/paymentState.js';

const members = new Set(['a', 'b', 'c']);
const expenses = [{
  payer_username: 'a',
  amount: 1500,
  participants: ['a', 'b', 'c'],
  split_type: 'EQUAL',
  split_data: {},
}];

assert.equal(isAllowedPaymentTransition('pending', 'payment_initiated'), true);
assert.equal(isAllowedPaymentTransition('payment_initiated', 'awaiting_receiver_confirmation'), true);
assert.equal(isAllowedPaymentTransition('awaiting_receiver_confirmation', 'completed'), true);
assert.equal(isAllowedPaymentTransition('awaiting_receiver_confirmation', 'pending'), true);
assert.equal(isAllowedPaymentTransition('pending', 'completed'), false);
assert.equal(isAllowedPaymentTransition('payment_initiated', 'completed'), false);
assert.equal(isAllowedPaymentTransition('completed', 'pending'), false);
assert.equal(isAllowedPaymentTransition('completed', 'awaiting_receiver_confirmation'), false);
assert.equal(isAllowedPaymentTransition('pending', 'completed', { legacyManualPayment: true }), true);

const initial = buildSettlementSnapshot(expenses, members, []);
assert.deepEqual(initial.settlements, [
  { from: 'b', to: 'a', amountPaise: 50000, amount: 500 },
  { from: 'c', to: 'a', amountPaise: 50000, amount: 500 },
]);

const changed = buildSettlementSnapshot([
  ...expenses,
  { payer_username: 'b', amount: 300, participants: ['a', 'b', 'c'], split_type: 'EQUAL', split_data: {} },
], members, []);
assert.equal(changed.settlements.some(({ from, to, amount }) => from === 'b' && to === 'a' && amount === 300), true);

const activePaymentIgnored = buildSettlementSnapshot(expenses, members, []);
assert.equal(activePaymentIgnored.settlements.some(({ from, to, amountPaise }) => from === 'b' && to === 'a' && amountPaise === 50000), true);

const changedWhileAwaiting = buildSettlementSnapshot([
  ...expenses,
  { payer_username: 'a', amount: 600, participants: ['a', 'b', 'c'], split_type: 'EQUAL', split_data: {} },
], members, []);
assert.equal(changedWhileAwaiting.settlements.some(({ from, to, amountPaise }) => from === 'b' && to === 'a' && amountPaise === 70000), true);

const onePaise = buildSettlementSnapshot([
  { payer_username: 'a', amount: 0.03, participants: ['a', 'b'], split_type: 'EXACT', split_data: { amounts: { a: 0.02, b: 0.01 } } },
], new Set(['a', 'b']), []);
assert.deepEqual(onePaise.settlements, [{ from: 'b', to: 'a', amountPaise: 1, amount: 0.01 }]);

for (const [amount, expected] of [[0.01, 1], [1.01, 101], [666.67, 66667], [9999.99, 999999]]) {
  assert.equal(Math.round(amount * 100), expected);
}

const upiAmount = (amountPaise) => (amountPaise / 100).toFixed(2);
assert.equal(upiAmount(66667), '666.67');
assert.equal(upiAmount(1), '0.01');

console.log('Payment state, active-hold regression, and paise audit tests passed');
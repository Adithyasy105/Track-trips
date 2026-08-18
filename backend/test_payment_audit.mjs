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
  { from: 'b', to: 'a', amount: 500 },
  { from: 'c', to: 'a', amount: 500 },
]);

const changed = buildSettlementSnapshot([
  ...expenses,
  { payer_username: 'b', amount: 300, participants: ['a', 'b', 'c'], split_type: 'EQUAL', split_data: {} },
], members, []);
assert.equal(changed.settlements.some(({ from, to, amount }) => from === 'b' && to === 'a' && amount === 300), true);

for (const [amount, expected] of [[0.01, 1], [1.01, 101], [666.67, 66667], [9999.99, 999999]]) {
  assert.equal(Math.round(amount * 100), expected);
}

const upiAmount = (amountPaise) => (amountPaise / 100).toFixed(2);
assert.equal(upiAmount(66667), '666.67');
assert.equal(upiAmount(1), '0.01');

console.log('Payment state, active-hold regression, and paise audit tests passed');
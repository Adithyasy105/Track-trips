import { supabase } from '../services/supabaseClient.js';
import { buildSettlementSnapshot } from '../utils/settlementAlgo.js';
import { emitToTrip } from '../services/socketService.js';
import { invalidateTripCaches } from '../services/redisClient.js';
import { isAllowedPaymentTransition } from '../utils/paymentState.js';

const toPaise = (value) => Math.round(Number(value || 0) * 100);
const amountPaiseOf = (payment) => Number.isSafeInteger(payment?.amount_paise) ? payment.amount_paise : toPaise(payment?.amount);
const settlementKey = (tripId, from, to, paise) => `${tripId}:${from}:${to}:${paise}`;
const sameUser = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const fail = (res, status, code, error) => res.status(status).json({ code, error });

const calculateSettlements = async (tripId) => {
  const [members, expenses, completed] = await Promise.all([
    supabase.from('trip_members').select('username').eq('trip_id', tripId),
    supabase.from('expenses').select('*').eq('trip_id', tripId),
    supabase.from('payments').select('from_username, to_username, amount, amount_paise').eq('trip_id', tripId).eq('status', 'completed'),
  ]);
  if (members.error) throw members.error;
  if (expenses.error) throw expenses.error;
  if (completed.error) throw completed.error;
  const memberSet = new Set((members.data || []).map((row) => row.username));
  return memberSet.size ? buildSettlementSnapshot(expenses.data || [], memberSet, (completed.data || []).map((payment) => ({ ...payment, amount: amountPaiseOf(payment) / 100 }))).settlements : [];
};

export const verifyTripMember = async (tripId, username) => {
  const { data: trip, error } = await supabase.from('trips').select('group_id').eq('id', tripId).maybeSingle();
  if (error) throw error;
  if (!trip) return { code: 404, error: 'Trip not found', reason: 'TRIP_NOT_FOUND' };
  const { data: member, error: memberError } = await supabase.from('group_members').select('username').eq('group_id', trip.group_id).eq('username', username).maybeSingle();
  if (memberError) throw memberError;
  return member ? null : { code: 403, error: 'You are not a current trip member', reason: 'NOT_TRIP_MEMBER' };
};

const loadPaymentForActor = async (id, username) => {
  const { data: payment, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!payment) return { error: { status: 404, code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' } };
  const membership = await verifyTripMember(payment.trip_id, username);
  if (membership) return { error: { status: membership.code, code: membership.reason, message: membership.error } };
  return { payment };
};

const emitPaymentChange = async (payment, event = 'payment:updated') => {
  // Cache errors are contained by redisClient; DB state is already durable at this point.
  await invalidateTripCaches(payment.trip_id);
  emitToTrip(payment.trip_id, event, payment);
  emitToTrip(payment.trip_id, 'settlement:updated', payment);
};

// Rebuild only keyed current instructions; legacy NULL-key records and active/completed history are preserved.
export const syncPendingPaymentsForTrip = async (tripId, actorUsername) => {
  const settlements = await calculateSettlements(tripId);
  const { data: activeRows, error: activeError } = await supabase.from('payments').select('settlement_key, from_username, to_username').eq('trip_id', tripId)
    .in('status', ['payment_initiated', 'awaiting_receiver_confirmation']);
  if (activeError) throw activeError;
  const activePairs = new Set((activeRows || []).map((row) => `${row.from_username}:${row.to_username}`));
  const { error: removeError } = await supabase.from('payments').delete().eq('trip_id', tripId).eq('status', 'pending').not('settlement_key', 'is', null);
  if (removeError) throw removeError;
  const rows = settlements.map((item) => {
    const paise = toPaise(item.amount);
    return { trip_id: tripId, from_username: item.from, to_username: item.to, amount: paise / 100, amount_paise: paise,
      settlement_key: settlementKey(tripId, item.from, item.to, paise), status: 'pending', created_by: actorUsername || item.from };
  }).filter((row) => !activePairs.has(`${row.from_username}:${row.to_username}`));
  if (!rows.length) return { created: 0 };
  // The partial unique index is the final duplicate guard; conflicts are re-read by callers.
  const { data, error } = await supabase.from('payments').insert(rows).select('id');
  if (error && error.code !== '23505') throw error;
  return { created: data?.length || 0 };
};

export const listTripPayments = async (req, res, next) => {
  try {
    const denied = await verifyTripMember(req.params.trip_id, req.user.username);
    if (denied) return fail(res, denied.code, denied.reason, denied.error);
    const { data, error } = await supabase.from('payments').select('*').eq('trip_id', req.params.trip_id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) { next(error); }
};

export const initiateSettlementPayment = async (req, res, next) => {
  try {
    const { trip_id: tripId, to_username: requestedReceiver, amount_paise } = req.body || {};
    const payer = req.user.username;
    const paiseText = typeof amount_paise === 'number' ? String(amount_paise) : String(amount_paise || '').trim();
    const paise = /^\d+$/.test(paiseText) ? Number(paiseText) : NaN;
    if (!tripId || !requestedReceiver || !Number.isSafeInteger(paise) || paise <= 0) return fail(res, 400, 'INVALID_PAYMENT_REQUEST', 'A valid settlement is required');
    const denied = await verifyTripMember(tripId, payer);
    if (denied) return fail(res, denied.code, denied.reason, denied.error);
    const settlement = (await calculateSettlements(tripId)).find((item) => sameUser(item.from, payer) && sameUser(item.to, requestedReceiver) && toPaise(item.amount) === paise);
    if (!settlement) return fail(res, 409, 'SETTLEMENT_CHANGED', 'This settlement is no longer current. Refresh and try again.');
    const key = settlementKey(tripId, settlement.from, settlement.to, paise);
    const { data: receiver, error: receiverError } = await supabase.from('users').select('username, full_name, upi_id').eq('username', settlement.to).maybeSingle();
    if (receiverError) throw receiverError;
    if (!receiver?.upi_id) return fail(res, 422, 'RECEIVER_UPI_NOT_CONFIGURED', `@${settlement.to} has not added a UPI ID yet.`);

    const existing = await supabase.from('payments').select('*').eq('trip_id', tripId).eq('from_username', settlement.from).eq('to_username', settlement.to)
      .in('status', ['pending', 'payment_initiated', 'awaiting_receiver_confirmation']).maybeSingle();
    if (existing.error) throw existing.error;
    let payment = existing.data;
    if (payment?.status === 'pending') {
      const { data, error } = await supabase.from('payments').update({ status: 'payment_initiated', initiated_at: new Date().toISOString() })
        .eq('id', payment.id).eq('status', 'pending').select().maybeSingle();
      if (error) throw error;
      payment = data;
    }
    if (!payment) {
      const { data, error } = await supabase.from('payments').insert([{ trip_id: tripId, from_username: settlement.from, to_username: settlement.to,
        amount: paise / 100, amount_paise: paise, settlement_key: key, status: 'payment_initiated', initiated_at: new Date().toISOString(), created_by: payer }]).select().maybeSingle();
      if (error && error.code !== '23505') throw error;
      payment = data;
    }
    if (!payment) {
      const { data, error } = await supabase.from('payments').select('*').eq('trip_id', tripId).eq('settlement_key', key)
        .in('status', ['pending', 'payment_initiated', 'awaiting_receiver_confirmation']).maybeSingle();
      if (error) throw error;
      payment = data;
    }
    if (!payment) return fail(res, 409, 'PAYMENT_ALREADY_ACTIVE', 'Another payment attempt is in progress.');
    if (!payment.reference_id) {
      const { data, error } = await supabase.from('payments').update({ reference_id: `TRIPSYNC-${payment.id}` }).eq('id', payment.id).is('reference_id', null).select().maybeSingle();
      if (error) throw error;
      payment = data || payment;
    }
    await emitPaymentChange(payment, 'payment:initiated');
    res.json({ ...payment, amountPaise: amountPaiseOf(payment), receiverUpiId: receiver.upi_id, receiverName: receiver.full_name || receiver.username });
  } catch (error) { next(error); }
};

export const claimPaymentPaid = async (req, res, next) => {
  try {
    const loaded = await loadPaymentForActor(req.params.id, req.user.username);
    if (loaded.error) return fail(res, loaded.error.status, loaded.error.code, loaded.error.message);
    const { payment } = loaded;
    if (!sameUser(payment.from_username, req.user.username)) return fail(res, 403, 'NOT_PAYMENT_PAYER', 'Only the sender can report payment');
    if (!isAllowedPaymentTransition(payment.status, 'awaiting_receiver_confirmation')) return fail(res, 409, 'INVALID_PAYMENT_STATE', 'Payment state cannot be claimed');
    if (payment.status === 'completed') return fail(res, 409, 'PAYMENT_ALREADY_COMPLETED', 'Completed payments are immutable');
    const { data, error } = await supabase.from('payments').update({ status: 'awaiting_receiver_confirmation', claimed_paid_at: new Date().toISOString() })
      .eq('id', payment.id).eq('from_username', req.user.username).eq('status', 'payment_initiated').select().maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 409, 'INVALID_PAYMENT_STATE', 'Payment state changed; refresh and try again.');
    await emitPaymentChange(data, 'payment:awaiting_confirmation');
    res.json(data);
  } catch (error) { next(error); }
};

export const rejectPaymentClaim = async (req, res, next) => {
  try {
    const loaded = await loadPaymentForActor(req.params.id, req.user.username);
    if (loaded.error) return fail(res, loaded.error.status, loaded.error.code, loaded.error.message);
    const { payment } = loaded;
    if (!sameUser(payment.to_username, req.user.username)) return fail(res, 403, 'NOT_PAYMENT_RECEIVER', 'Only the receiver can reject payment');
    if (!isAllowedPaymentTransition(payment.status, 'pending')) return fail(res, 409, 'INVALID_PAYMENT_STATE', 'Payment state cannot be rejected');
    const { data, error } = await supabase.from('payments').update({ status: 'pending', claimed_paid_at: null })
      .eq('id', payment.id).eq('to_username', req.user.username).eq('status', 'awaiting_receiver_confirmation').select().maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 409, payment.status === 'completed' ? 'PAYMENT_ALREADY_COMPLETED' : 'INVALID_PAYMENT_STATE', 'Payment state changed; refresh and try again.');
    await emitPaymentChange(data);
    res.json(data);
  } catch (error) { next(error); }
};

export const completePayment = async (req, res, next) => {
  try {
    const loaded = await loadPaymentForActor(req.params.id, req.user.username);
    if (loaded.error) return fail(res, loaded.error.status, loaded.error.code, loaded.error.message);
    const { payment } = loaded;
    if (!sameUser(payment.to_username, req.user.username)) return fail(res, 403, 'NOT_PAYMENT_RECEIVER', 'Only the receiver can confirm receipt');
    const legacyManualPayment = payment.settlement_key === null && !payment.reference_id;
    if (!isAllowedPaymentTransition(payment.status, 'completed', { legacyManualPayment })) return fail(res, 409, 'INVALID_PAYMENT_STATE', 'Payment state cannot be completed');
    const expectedStatuses = legacyManualPayment ? ['pending', 'awaiting_receiver_confirmation'] : ['awaiting_receiver_confirmation'];
    const { data, error } = await supabase.from('payments').update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', payment.id).eq('to_username', req.user.username).in('status', expectedStatuses).select().maybeSingle();
    if (error) throw error;
    if (!data) return fail(res, 409, payment.status === 'completed' ? 'PAYMENT_ALREADY_COMPLETED' : 'INVALID_PAYMENT_STATE', 'Payment state changed; refresh and try again.');
    // DB completion is authoritative; a sync failure can only leave display instructions stale, never reverse completion.
    try {
      await syncPendingPaymentsForTrip(payment.trip_id, req.user.username);
    } catch (syncError) {
      // Completion is already durable; a refresh can rebuild stale pending instructions.
      console.error('Failed to rebuild pending payments after completion:', syncError);
    }
    await emitPaymentChange(data, 'payment:completed');
    res.json(data);
  } catch (error) { next(error); }
};

export const resetTripPayments = async (req, res, next) => {
  try {
    if (String(req.body?.mode || '').toLowerCase() === 'hard') return fail(res, 403, 'COMPLETED_PAYMENTS_IMMUTABLE', 'Hard reset is unavailable');
    const denied = await verifyTripMember(req.params.trip_id, req.user.username);
    if (denied) return fail(res, denied.code, denied.reason, denied.error);
    const result = await syncPendingPaymentsForTrip(req.params.trip_id, req.user.username);
    res.json({ message: 'Current pending payment instructions rebuilt', ...result });
  } catch (error) { next(error); }
};

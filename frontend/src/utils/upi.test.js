import { buildUpiPaymentUrl, formatPaise } from './upi';

describe('UPI payment URI', () => {
  it('uses the authoritative exact amount and never adds mam', () => {
    const url = buildUpiPaymentUrl({
      upiId: 'receiver@bank',
      payeeName: 'Receiver Name',
      amountPaise: 66667,
      transactionId: 'TRIPSYNC-123',
      note: 'TripSync Settlement',
    });
    const params = new URL(url).searchParams;

    expect(url.startsWith('upi://pay?')).toBe(true);
    expect(params.get('pa')).toBe('receiver@bank');
    expect(params.get('pn')).toBe('Receiver Name');
    expect(params.get('am')).toBe('666.67');
    expect(params.get('cu')).toBe('INR');
    expect(params.get('tr')).toBe('TRIPSYNC-123');
    expect(params.get('tn')).toBe('TripSync Settlement');
    expect(params.has('mam')).toBe(false);
  });

  it('rejects invalid or non-positive paise values', () => {
    expect(() => formatPaise(1.5)).toThrow('Invalid paise amount.');
    expect(() => buildUpiPaymentUrl({ upiId: 'receiver@bank', amountPaise: 0 })).toThrow('Invalid payment amount.');
  });
});

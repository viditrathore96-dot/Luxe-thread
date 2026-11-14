import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './razorpay';

test('verifyRazorpayPaymentSignature verifies valid HMAC-SHA256 signatures and rejects tampering', () => {
  const secret = 'rzp_test_secret_123456';
  const orderId = 'order_Nx987654321';
  const paymentId = 'pay_Nx123456789';
  const validSig = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, validSig, secret), true);
  assert.equal(verifyRazorpayPaymentSignature(orderId, 'pay_tampered', validSig, secret), false);
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, 'bad_len', secret), false);
  assert.equal(verifyRazorpayPaymentSignature(orderId, paymentId, validSig, 'wrong_secret'), false);
});

test('verifyRazorpayWebhookSignature validates raw webhook payload signatures', () => {
  const webhookSecret = 'whsec_test_999';
  const rawPayload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } });
  const validSig = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');

  assert.equal(verifyRazorpayWebhookSignature(rawPayload, validSig, webhookSecret), true);
  assert.equal(verifyRazorpayWebhookSignature(rawPayload + ' ', validSig, webhookSecret), false);
  assert.equal(verifyRazorpayWebhookSignature(rawPayload, '0'.repeat(validSig.length), webhookSecret), false);
});

import crypto from 'node:crypto';
import Razorpay from 'razorpay';

export interface RazorpayConfigStatus {
  configured: boolean;
  keyId: string | null;
  webhookConfigured: boolean;
  mode: 'live_or_test_api' | 'sandbox_test_simulation';
}

export function getRazorpayConfigStatus(): RazorpayConfigStatus {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
  const configured =
    Boolean(keyId && keySecret) &&
    !keyId.includes('your_key_id') &&
    !keySecret.includes('your_razorpay_key_secret');

  return {
    configured,
    keyId: configured ? keyId : null,
    webhookConfigured: Boolean(webhookSecret) && !webhookSecret.includes('your_razorpay_webhook_secret'),
    mode: configured ? 'live_or_test_api' : 'sandbox_test_simulation',
  };
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Checkout payment callback.
 */
export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  secret: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !secret) {
    return false;
  }
  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(razorpaySignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay webhook raw body.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string | Buffer,
  webhookSignature: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !webhookSignature || !webhookSecret) {
    return false;
  }
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(webhookSignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export function createSandboxSignatureForTestOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string
): string {
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim() || 'atelier_vanya_test_mode_hmac_key';
  return crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
}

export function getActiveRazorpaySecret(): string {
  const status = getRazorpayConfigStatus();
  if (status.configured) {
    return process.env.RAZORPAY_KEY_SECRET!.trim();
  }
  return 'atelier_vanya_test_mode_hmac_key';
}

export async function createGatewayOrder(params: {
  amountPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ id: string; amount: number; currency: string; mode: 'razorpay' | 'test_simulation' }> {
  const status = getRazorpayConfigStatus();
  if (status.configured) {
    const client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!.trim(),
      key_secret: process.env.RAZORPAY_KEY_SECRET!.trim(),
    });
    const rzpOrder = await client.orders.create({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    });
    return {
      id: rzpOrder.id,
      amount: Number(rzpOrder.amount),
      currency: rzpOrder.currency,
      mode: 'razorpay',
    };
  }

  return {
    id: `order_test_${crypto.randomBytes(8).toString('hex')}`,
    amount: params.amountPaise,
    currency: 'INR',
    mode: 'test_simulation',
  };
}

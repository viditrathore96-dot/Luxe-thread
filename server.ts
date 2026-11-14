import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  attachSession,
  clearSessionCookie,
  rateLimit,
  requireAdmin,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  type AuthenticatedRequest,
} from './server/auth';
import { storeRepo } from './server/repository';
import {
  createGatewayOrder,
  createSandboxSignatureForTestOrder,
  getActiveRazorpaySecret,
  getRazorpayConfigStatus,
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from './server/razorpay';
import { validateCheckoutInput } from './src/utils/commerce';
import type { OrderStatus } from './src/types/ecommerce';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // Capture raw body for Razorpay webhook HMAC verification before JSON parsing
  app.use(
    '/api/webhooks/razorpay',
    express.raw({ type: 'application/json' })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(attachSession);
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'public', 'uploads')));

  // --- Health & Integration Status ---
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      ...storeRepo.getIntegrationStatus(),
      razorpay: getRazorpayConfigStatus(),
    });
  });

  // --- SEO Sitemap ---
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const baseUrl = process.env.APP_URL?.replace(/\/$/, '') || `http://${req.headers.host}`;
    const products = storeRepo.getPublishedProducts();
    const urls = [
      `${baseUrl}/`,
      `${baseUrl}/shop`,
      ...products.map((p) => `${baseUrl}/product/${p.slug}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  });

  // --- Authentication ---
  app.post('/api/auth/register', rateLimit(15, 60_000), (req: Request, res: Response) => {
    try {
      const { email, password, fullName, phone } = req.body || {};
      if (!email || !password || !fullName) {
        res.status(400).json({ error: 'Name, email, and password are required.' });
        return;
      }
      if (String(password).length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }
      const profile = storeRepo.registerCustomer({ email, password, fullName, phone });
      const token = signSessionToken({
        userId: profile.id,
        email: profile.email,
        role: profile.role,
      });
      setSessionCookie(res, token);
      res.status(201).json({ user: profile, token });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/auth/login', rateLimit(20, 60_000), (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }
    const profile = storeRepo.authenticateUser(String(email), String(password));
    if (!profile) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = signSessionToken({
      userId: profile.id,
      email: profile.email,
      role: profile.role,
    });
    setSessionCookie(res, token);
    res.json({ user: profile, token });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      res.json({ user: null });
      return;
    }
    const stored = storeRepo.findUserById(req.user.userId);
    if (!stored) {
      clearSessionCookie(res);
      res.json({ user: null });
      return;
    }
    res.json({ user: storeRepo.toPublicProfile(stored) });
  });

  // --- Storefront Public Routes ---
  app.get('/api/store/config', (_req: Request, res: Response) => {
    res.json({
      settings: storeRepo.getStoreSettings(),
      categories: storeRepo.getCategories(),
      razorpay: getRazorpayConfigStatus(),
      integration: storeRepo.getIntegrationStatus(),
    });
  });

  app.get('/api/products', (_req: Request, res: Response) => {
    res.json({ products: storeRepo.getPublishedProducts() });
  });

  app.get('/api/products/:slug', (req: Request, res: Response) => {
    const product = storeRepo.getProductBySlug(String(req.params.slug));
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json({ product });
  });

  app.post('/api/products/:id/reviews', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rating, comment } = req.body || {};
      const user = storeRepo.findUserById(req.user!.userId);
      if (!comment || String(comment).trim().length < 4) {
        res.status(400).json({ error: 'Please write a short review comment.' });
        return;
      }
      const review = storeRepo.addProductReview(
        String(req.params.id),
        user?.fullName || req.user!.email,
        Number(rating) || 5,
        String(comment)
      );
      res.status(201).json({ review });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/newsletter', rateLimit(15, 60_000), (req: Request, res: Response) => {
    try {
      const result = storeRepo.subscribeNewsletter(String(req.body?.email || ''));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/coupons/validate', (req: Request, res: Response) => {
    const { code, subtotalPaise } = req.body || {};
    const coupon = storeRepo.validateCoupon(String(code || ''), Number(subtotalPaise) || 0);
    if (!coupon) {
      res.status(404).json({ error: 'Coupon code is invalid or minimum order amount not met.' });
      return;
    }
    res.json({ coupon });
  });

  // --- Customer Account Routes ---
  app.put('/api/account/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fullName, phone } = req.body || {};
      if (!fullName || String(fullName).trim().length < 2) {
        res.status(400).json({ error: 'Full name is required.' });
        return;
      }
      const profile = storeRepo.updateProfile(req.user!.userId, {
        fullName: String(fullName),
        phone: String(phone || ''),
      });
      res.json({ user: profile });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/account/addresses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ addresses: storeRepo.getUserAddresses(req.user!.userId) });
  });

  app.post('/api/account/addresses', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body || {};
    if (!/^[1-9][0-9]{5}$/.test(String(body.pinCode || '').trim())) {
      res.status(400).json({ error: 'Please enter a valid 6-digit Indian PIN code.' });
      return;
    }
    if (!body.recipientName || !body.streetAddress || !body.city || !body.state || !body.phone) {
      res.status(400).json({ error: 'All address fields are required.' });
      return;
    }
    const address = storeRepo.addAddress(req.user!.userId, {
      label: String(body.label || 'Home'),
      recipientName: String(body.recipientName).trim(),
      phone: String(body.phone).trim(),
      streetAddress: String(body.streetAddress).trim(),
      city: String(body.city).trim(),
      state: String(body.state).trim(),
      pinCode: String(body.pinCode).trim(),
      isDefault: Boolean(body.isDefault),
    });
    res.status(201).json({ address });
  });

  app.delete('/api/account/addresses/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const deleted = storeRepo.deleteAddress(req.user!.userId, String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Address not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/account/orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ orders: storeRepo.getOrdersForUser(req.user!.userId) });
  });

  app.get('/api/account/wishlist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ productIds: storeRepo.getWishlist(req.user!.userId) });
  });

  app.post('/api/account/wishlist/toggle', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const productId = String(req.body?.productId || '');
    if (!productId) {
      res.status(400).json({ error: 'Product ID is required.' });
      return;
    }
    const productIds = storeRepo.toggleWishlist(req.user!.userId, productId);
    res.json({ productIds });
  });

  app.get('/api/orders/:id', (req: AuthenticatedRequest, res: Response) => {
    const order = storeRepo.getOrderById(String(req.params.id));
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    // Allow viewing if admin, owner of order, or guest viewing order receipt by UUID directly after checkout
    if (order.userId && req.user && req.user.role !== 'admin' && req.user.userId !== order.userId) {
      res.status(403).json({ error: 'Not authorized to view this order.' });
      return;
    }
    res.json({ order });
  });

  // --- Checkout & Razorpay Payment Verification ---
  app.post('/api/checkout/create-order', rateLimit(25, 60_000), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = req.body || {};
      const validation = validateCheckoutInput({
        customerName: String(body.customerName || ''),
        customerEmail: String(body.customerEmail || ''),
        customerPhone: String(body.customerPhone || ''),
        shippingAddress: String(body.shippingAddress || ''),
        shippingCity: String(body.shippingCity || ''),
        shippingState: String(body.shippingState || ''),
        shippingPinCode: String(body.shippingPinCode || ''),
      });
      if (!validation.valid) {
        res.status(400).json({ error: 'Please review the highlighted checkout fields.', errors: validation.errors });
        return;
      }

      const paymentMethod = body.paymentMethod === 'cod' ? 'cod' : 'razorpay';
      const order = storeRepo.createPendingOrderFromServerValidation({
        userId: req.user?.userId || null,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        shippingAddress: body.shippingAddress,
        shippingCity: body.shippingCity,
        shippingState: body.shippingState,
        shippingPinCode: body.shippingPinCode,
        paymentMethod,
        couponCode: body.couponCode,
        items: Array.isArray(body.items) ? body.items : [],
      });

      if (paymentMethod === 'cod') {
        res.status(201).json({ order, razorpayOrder: null });
        return;
      }

      const gatewayOrder = await createGatewayOrder({
        amountPaise: order.totalPaise,
        receipt: order.orderNumber,
        notes: {
          order_id: order.id,
          order_number: order.orderNumber,
        },
      });
      const updatedOrder = storeRepo.attachRazorpayOrderToOrder(order.id, gatewayOrder.id);

      res.status(201).json({
        order: updatedOrder,
        razorpayOrder: gatewayOrder,
        razorpayKeyId: getRazorpayConfigStatus().keyId,
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/payments/verify', rateLimit(30, 60_000), (req: Request, res: Response) => {
    try {
      const {
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        simulateTestSignature,
        paymentMethodLabel,
      } = req.body || {};

      if (!orderId || !razorpayOrderId || !razorpayPaymentId) {
        res.status(400).json({ error: 'Missing payment verification identifiers.' });
        return;
      }

      const existingOrder = storeRepo.getOrderById(String(orderId));
      if (!existingOrder) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const rzpStatus = getRazorpayConfigStatus();
      let signatureToVerify = String(razorpaySignature || '');

      // Only allow test-mode HMAC signature generation when Razorpay live/test API credentials are not configured
      if (!rzpStatus.configured && simulateTestSignature === true) {
        signatureToVerify = createSandboxSignatureForTestOrder(
          String(razorpayOrderId),
          String(razorpayPaymentId)
        );
      }

      const isValid = verifyRazorpayPaymentSignature(
        String(razorpayOrderId),
        String(razorpayPaymentId),
        signatureToVerify,
        getActiveRazorpaySecret()
      );

      if (!isValid) {
        const failed = storeRepo.markOrderPaymentFailed(
          existingOrder.id,
          'Razorpay HMAC signature verification failed'
        );
        res.status(400).json({ error: 'Payment signature verification failed.', order: failed });
        return;
      }

      const { order, alreadyProcessed } = storeRepo.markOrderPaidIdempotent({
        orderId: existingOrder.id,
        razorpayOrderId: String(razorpayOrderId),
        razorpayPaymentId: String(razorpayPaymentId),
        razorpaySignature: signatureToVerify,
        method: String(paymentMethodLabel || 'upi'),
        source: 'checkout_callback',
      });

      res.json({ verified: true, alreadyProcessed, order });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/payments/fail', (req: Request, res: Response) => {
    try {
      const { orderId, reason } = req.body || {};
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required.' });
        return;
      }
      const order = storeRepo.markOrderPaymentFailed(
        String(orderId),
        String(reason || 'Payment cancelled or declined by bank')
      );
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // --- Razorpay Server-Side Webhook (Idempotent & HMAC Verified) ---
  app.post('/api/webhooks/razorpay', (req: Request, res: Response) => {
    const signature = String(req.headers['x-razorpay-signature'] || '');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || '';
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

    if (!webhookSecret || webhookSecret.includes('your_razorpay_webhook_secret')) {
      res.status(503).json({ error: 'RAZORPAY_WEBHOOK_SECRET is not configured on the server.' });
      return;
    }

    if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
      res.status(400).json({ error: 'Invalid webhook signature.' });
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      res.status(400).json({ error: 'Malformed webhook payload.' });
      return;
    }

    const eventType = String(payload.event || '');
    const paymentEntity = (payload.payload as any)?.payment?.entity;
    const eventId = String(req.headers['x-razorpay-event-id'] || `${eventType}:${paymentEntity?.id || ''}`);

    if (eventId && storeRepo.hasProcessedWebhookEvent(eventId)) {
      res.json({ status: 'already_processed' });
      return;
    }

    if (eventType === 'payment.captured' && paymentEntity?.order_id) {
      const order = storeRepo.findOrderByRazorpayOrderId(String(paymentEntity.order_id));
      if (order) {
        storeRepo.markOrderPaidIdempotent({
          orderId: order.id,
          razorpayOrderId: String(paymentEntity.order_id),
          razorpayPaymentId: String(paymentEntity.id),
          method: String(paymentEntity.method || 'razorpay'),
          source: 'webhook',
        });
      }
    } else if (eventType === 'payment.failed' && paymentEntity?.order_id) {
      const order = storeRepo.findOrderByRazorpayOrderId(String(paymentEntity.order_id));
      if (order) {
        storeRepo.markOrderPaymentFailed(
          order.id,
          String(paymentEntity.error_description || 'Webhook reported payment failure')
        );
      }
    }

    if (eventId) {
      storeRepo.recordWebhookEvent(eventId);
    }

    res.json({ status: 'ok' });
  });

  // --- Protected Admin Routes (Strict RBAC) ---
  app.get('/api/admin/overview', requireAdmin, (_req: Request, res: Response) => {
    res.json({
      overview: storeRepo.getDashboardOverview(),
      integration: storeRepo.getIntegrationStatus(),
      razorpay: getRazorpayConfigStatus(),
    });
  });

  app.get('/api/admin/products', requireAdmin, (_req: Request, res: Response) => {
    res.json({ products: storeRepo.getAllProductsAdmin() });
  });

  app.post('/api/admin/products', requireAdmin, (req: Request, res: Response) => {
    try {
      const product = storeRepo.upsertProduct(req.body);
      res.status(201).json({ product });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const product = storeRepo.upsertProduct({ ...req.body, id: String(req.params.id) });
      res.json({ product });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/admin/products/:id/publish', requireAdmin, (req: Request, res: Response) => {
    try {
      const product = storeRepo.toggleProductPublished(
        String(req.params.id),
        Boolean(req.body?.isPublished)
      );
      res.json({ product });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req: Request, res: Response) => {
    const deleted = storeRepo.deleteProduct(String(req.params.id));
    if (!deleted) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.post('/api/admin/upload', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { fileName, mimeType, base64Data } = req.body || {};
      if (!fileName || !mimeType || !base64Data) {
        res.status(400).json({ error: 'Missing image file payload.' });
        return;
      }
      const result = await storeRepo.uploadProductImage({
        fileName: String(fileName),
        mimeType: String(mimeType),
        base64Data: String(base64Data),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.patch('/api/admin/inventory/:variantId', requireAdmin, (req: Request, res: Response) => {
    try {
      const variant = storeRepo.updateVariantStock(
        String(req.params.variantId),
        Number(req.body?.stockQuantity ?? 0)
      );
      res.json({ variant });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/admin/orders', requireAdmin, (_req: Request, res: Response) => {
    res.json({ orders: storeRepo.getAllOrdersAdmin() });
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, (req: Request, res: Response) => {
    try {
      const validStatuses: OrderStatus[] = [
        'Pending',
        'Paid',
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled',
        'Refunded',
      ];
      const nextStatus = req.body?.orderStatus as OrderStatus;
      if (!validStatuses.includes(nextStatus)) {
        res.status(400).json({ error: 'Invalid order status.' });
        return;
      }
      const order = storeRepo.updateOrderStatusAdmin({
        orderId: String(req.params.id),
        orderStatus: nextStatus,
        trackingNumber: req.body?.trackingNumber,
        carrierName: req.body?.carrierName,
        note: req.body?.note,
      });
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.put('/api/admin/settings', requireAdmin, (req: Request, res: Response) => {
    const settings = storeRepo.updateStoreSettings(req.body || {});
    res.json({ settings });
  });

  // --- Vite Dev Middleware / Production Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Vanya server listening on http://localhost:${PORT}`);
  });
}

startServer();

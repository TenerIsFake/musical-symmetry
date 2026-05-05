import Stripe from 'stripe';
import { Router } from 'express';
import { requireAuth } from './middleware.js';
import { updateTier, getUserById, getUserByStripeCustomerId } from './db.js';
import './types.js';

export const billingRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2026-04-22.dahlia' });
}

export function isValidTier(tier: string): tier is 'pro' | 'research' {
  return tier === 'pro' || tier === 'research';
}

export async function createCheckoutUrl(
  userId: string,
  tier: 'pro' | 'research',
  email: string,
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const priceId =
    tier === 'pro'
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_RESEARCH;

  if (!priceId) return null;

  const appUrl = process.env.APP_URL || 'https://symmetry.tendrid.us';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId, tier },
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/dashboard?checkout=cancelled`,
  });

  return session.url;
}

// POST /api/billing/checkout — Create Stripe checkout session
billingRouter.post('/checkout', requireAuth, async (req, res) => {
  try {
    const { tier } = req.body;
    if (!tier || !isValidTier(tier)) {
      res.status(400).json({ error: 'tier must be "pro" or "research"' });
      return;
    }

    const user = req.user!;
    const url = await createCheckoutUrl(user.id, tier, user.email);

    if (!url) {
      res.json({
        message: 'Stripe not configured. In stub mode.',
        stub: true,
        note: 'Set STRIPE_SECRET_KEY env var to enable real billing',
      });
      return;
    }

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/billing/webhook — Handle Stripe webhook events
billingRouter.post('/webhook', async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      res.status(501).json({ error: 'Stripe not configured' });
      return;
    }

    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      res.status(400).json({ error: 'Webhook signature verification failed' });
      return;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;
      if (userId && tier && isValidTier(tier)) {
        try {
          updateTier(userId, tier);
        } catch (err) {
          res.status(500).json({ error: 'Failed to update tier' });
          return;
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      const user = getUserByStripeCustomerId(customerId);
      if (user) {
        updateTier(user.id, 'free');
      }
    }

    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// GET /api/billing/portal — Redirect to Stripe customer portal
billingRouter.get('/portal', requireAuth, async (req, res) => {
  try {
    const stripe = getStripe();
    if (!stripe) {
      res.json({
        message: 'Stripe not configured. In stub mode.',
        stub: true,
        currentTier: req.user!.tier,
      });
      return;
    }

    const user = req.user!;
    const appUrl = process.env.APP_URL || 'https://symmetry.tendrid.us';

    // Ensure the user has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      // Use INSERT-if-still-null pattern to avoid race condition
      const { getDb } = await import('./db.js');
      getDb()
        .prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND (stripe_customer_id IS NULL OR stripe_customer_id = "")')
        .run(customer.id, user.id);
      // Re-read to get the winning customer ID
      const freshUser = getUserById(user.id);
      customerId = freshUser?.stripe_customer_id || customer.id;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard`,
    });

    res.json({ url: portalSession.url });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

import { Router } from 'express';
import { requireAuth } from './middleware.js';
import { updateTier, getUserById } from './db.js';
import './types.js';

export const billingRouter = Router();

// Stripe integration - currently stubbed
// Will be activated when STRIPE_SECRET_KEY env var is set

export function createCheckoutSession(_userId: string, _tier: 'pro' | 'research'): string | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null; // Stub mode
  // TODO: Real Stripe checkout session creation
  return null;
}

export function handleWebhook(_body: Buffer, _signature: string): void {
  // TODO: Handle subscription.created, subscription.deleted, etc.
}

// POST /api/billing/checkout — Create Stripe checkout session
billingRouter.post('/checkout', requireAuth, (req, res) => {
  try {
    const { tier } = req.body;
    if (!tier || !['pro', 'research'].includes(tier)) {
      res.status(400).json({ error: 'tier must be "pro" or "research"' });
      return;
    }

    const user = req.user!;
    const sessionUrl = createCheckoutSession(user.id, tier);

    if (!sessionUrl) {
      res.json({
        message: 'Stripe not configured. In stub mode.',
        stub: true,
        note: 'Set STRIPE_SECRET_KEY env var to enable real billing',
      });
      return;
    }

    res.json({ url: sessionUrl });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// POST /api/billing/webhook — Stripe webhook handler
billingRouter.post('/webhook', (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    handleWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Webhook error' });
  }
});

// GET /api/billing/portal — Redirect to Stripe customer portal
billingRouter.get('/portal', requireAuth, (req, res) => {
  try {
    const user = req.user!;
    const key = process.env.STRIPE_SECRET_KEY;

    if (!key) {
      res.json({
        message: 'Stripe not configured. In stub mode.',
        stub: true,
        currentTier: user.tier,
      });
      return;
    }

    // TODO: Create Stripe portal session and redirect
    res.json({ message: 'Portal not yet implemented', currentTier: user.tier });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

import { useState } from 'react';

interface StripeCheckoutProps {
  tier: 'pro' | 'research';
  label: string;
  currentTier: string;
}

export default function StripeCheckout({ tier, label, currentTier }: StripeCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const isCurrentTier = currentTier === tier;

  const handleClick = async () => {
    if (isCurrentTier || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Billing is not configured yet.');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const baseClass =
    tier === 'pro'
      ? 'px-4 py-2 bg-indigo-600 rounded text-sm font-medium text-white hover:bg-indigo-500 transition-colors'
      : 'px-4 py-2 bg-purple-600 rounded text-sm font-medium text-white hover:bg-purple-500 transition-colors';

  const disabledClass = 'px-4 py-2 rounded text-sm font-medium text-gray-400 bg-gray-700 cursor-not-allowed opacity-60';

  return (
    <button
      onClick={handleClick}
      disabled={isCurrentTier || loading}
      className={isCurrentTier ? disabledClass : baseClass}
    >
      {loading ? 'Loading...' : label}
    </button>
  );
}

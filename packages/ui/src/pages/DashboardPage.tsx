import { useState, useEffect, useCallback } from 'react';

interface UserProfile {
  email: string;
  tier: 'free' | 'pro' | 'research';
  memberSince: string;
  apiKey: string;
  usage: {
    classifications: { used: number; limit: number };
    fileAnalyses: { used: number; limit: number };
    shareCards: { used: number; limit: number };
  };
}

function TierBadge({ tier }: { tier: UserProfile['tier'] }) {
  const colors = {
    free: 'bg-gray-600 text-gray-200',
    pro: 'bg-indigo-600 text-white',
    research: 'bg-purple-600 text-white',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${colors[tier]}`}>
      {tier}
    </span>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-indigo-500';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400">
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MaskedKey({ apiKey, onCopy, onRegenerate }: { apiKey: string; onCopy: () => void; onRegenerate: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const masked = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-3)}` : apiKey;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">API Key</h3>
      <div className="flex items-center gap-3">
        <code className="flex-1 bg-gray-900 px-3 py-2 rounded text-sm font-mono text-gray-300">{masked}</code>
        <button
          onClick={onCopy}
          className="px-3 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors"
        >
          Copy
        </button>
        {showConfirm ? (
          <div className="flex gap-2">
            <button
              onClick={() => {
                onRegenerate();
                setShowConfirm(false);
              }}
              className="px-3 py-2 bg-red-700 rounded text-sm hover:bg-red-600 transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 py-2 bg-gray-700 rounded text-sm hover:bg-gray-600 transition-colors"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

function LoggedInView({ user }: { user: UserProfile }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(user.apiKey).catch(() => {});
  }, [user.apiKey]);

  const handleRegenerate = useCallback(() => {
    fetch('/api/auth/regenerate-key', { method: 'POST', credentials: 'include' }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold text-white">{user.email}</p>
            <p className="text-sm text-gray-400 mt-1">
              Member since {new Date(user.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <TierBadge tier={user.tier} />
        </div>
      </div>

      {/* API Usage */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Today's API Usage</h3>
        <div className="space-y-4">
          <UsageBar label="Classifications" used={user.usage.classifications.used} limit={user.usage.classifications.limit} />
          <UsageBar label="File Analyses" used={user.usage.fileAnalyses.used} limit={user.usage.fileAnalyses.limit} />
          <UsageBar label="Share Cards" used={user.usage.shareCards.used} limit={user.usage.shareCards.limit} />
        </div>
      </div>

      {/* API Key */}
      <MaskedKey apiKey={user.apiKey} onCopy={handleCopy} onRegenerate={handleRegenerate} />

      {/* Subscription */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Subscription</h3>
        <div className="flex items-center gap-3">
          <span className="text-white">
            Current plan: <TierBadge tier={user.tier} />
          </span>
        </div>
        <div className="mt-4 flex gap-3">
          {user.tier === 'free' && (
            <>
              <a
                href="/api/billing/checkout?plan=pro"
                className="px-4 py-2 bg-indigo-600 rounded text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                Upgrade to Pro
              </a>
              <a
                href="/api/billing/checkout?plan=research"
                className="px-4 py-2 bg-purple-600 rounded text-sm font-medium text-white hover:bg-purple-500 transition-colors"
              >
                Upgrade to Research
              </a>
            </>
          )}
          {(user.tier === 'pro' || user.tier === 'research') && (
            <a
              href="/api/billing/portal"
              className="px-4 py-2 bg-gray-700 rounded text-sm font-medium text-white hover:bg-gray-600 transition-colors"
            >
              Manage Subscription
            </a>
          )}
        </div>
      </div>

      {/* Restart Tour */}
      <div className="text-center">
        <button
          onClick={() => {
            localStorage.removeItem('tour-completed');
            window.location.hash = 'classifier';
          }}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors underline"
        >
          Restart guided tour
        </button>
      </div>
    </div>
  );
}

function LoginView() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <h2 className="text-xl font-bold text-white mb-2">Sign In</h2>
        <p className="text-gray-400 text-sm mb-6">
          Sign in to track your usage and unlock Pro features.
        </p>

        {status === 'sent' ? (
          <div className="bg-green-900/40 border border-green-700 rounded-lg p-4 text-sm text-green-300">
            Check your email for a magic link to sign in.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              required
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full px-4 py-2 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending...' : 'Send Link'}
            </button>
            {status === 'error' && (
              <p className="text-red-400 text-sm">Something went wrong. Try again.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {user ? <LoggedInView user={user} /> : <LoginView />}
    </div>
  );
}

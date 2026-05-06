import { useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  className?: string;
}

export default function AdBanner({ slot, format = 'auto', className = '' }: AdBannerProps) {
  const { user, loading } = useUser();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const isPaid = user?.tier === 'pro' || user?.tier === 'research';

  useEffect(() => {
    if (loading || isPaid || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded (ad blocker or script not yet ready)
    }
  }, [loading, isPaid]);

  if (loading || isPaid) return null;

  return (
    <div className={`ad-container my-4 ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={import.meta.env.VITE_ADSENSE_CLIENT || ''}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
        ref={adRef}
      />
    </div>
  );
}

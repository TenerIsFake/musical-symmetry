import { useEffect, useRef } from 'react';
import { useUser, type User } from '../context/UserContext';
import { isNativePlatform } from '../utils/platform';

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

function shouldShowAds(user: User | null): boolean {
  if (!user) return true;
  return user.tier === 'free';
}

/**
 * Web-only AdSense banner. The Android app ships ad-free (v1 product
 * decision), so this renders nothing on native — and the AdSense script is
 * never injected there either (see src/utils/webScripts.ts).
 */
export default function AdBanner({ slot, format = 'auto', className = '' }: AdBannerProps) {
  const { user, loading } = useUser();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const showAds = !isNativePlatform && shouldShowAds(user);

  useEffect(() => {
    if (loading || !showAds || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded
    }
  }, [loading, showAds]);

  if (loading || !showAds) return null;

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

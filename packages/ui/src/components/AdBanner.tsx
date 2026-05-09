import { useEffect, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { initAdMob, showBannerAd, hideBannerAd, shouldShowAds } from '../utils/admob';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

const isNative = typeof (window as any).Capacitor !== 'undefined';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  className?: string;
}

export default function AdBanner({ slot, format = 'auto', className = '' }: AdBannerProps) {
  const { user, loading } = useUser();
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  const showAds = shouldShowAds(user);

  useEffect(() => {
    if (loading || !showAds) return;

    if (isNative) {
      initAdMob().then(() => showBannerAd());
      return () => { hideBannerAd(); };
    }

    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded
    }
  }, [loading, showAds]);

  if (loading || !showAds) {
    if (isNative) hideBannerAd();
    return null;
  }

  if (isNative) return null;

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

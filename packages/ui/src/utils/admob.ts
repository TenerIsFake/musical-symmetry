import type { User } from '../context/UserContext';

const isNative = typeof (window as any).Capacitor !== 'undefined';

const BANNER_UNIT_ID = 'ca-app-pub-9760203099492988/6094967804';

let initialized = false;
let bannerVisible = false;

async function getAdMob() {
  if (!isNative) return null;
  try {
    const mod = await import('@capacitor-community/admob');
    return mod.AdMob;
  } catch {
    return null;
  }
}

export async function initAdMob() {
  if (initialized || !isNative) return;
  const AdMob = await getAdMob();
  if (!AdMob) return;
  await AdMob.initialize({ initializeForTesting: false });
  initialized = true;
}

export async function showBannerAd() {
  if (bannerVisible || !isNative) return;
  const AdMob = await getAdMob();
  if (!AdMob) return;
  const { BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
  await AdMob.showBanner({
    adId: BANNER_UNIT_ID,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    isTesting: false,
  });
  bannerVisible = true;
}

export async function hideBannerAd() {
  if (!bannerVisible || !isNative) return;
  const AdMob = await getAdMob();
  if (!AdMob) return;
  await AdMob.removeBanner();
  bannerVisible = false;
}

export function shouldShowAds(user: User | null): boolean {
  if (!user) return true;
  return user.tier === 'free';
}

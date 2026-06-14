import Constants from 'expo-constants';

const LOCAL_STOREFRONT_ORIGIN = 'http://localhost:3002';
const PRODUCTION_STOREFRONT_ORIGIN = 'https://www.absghana.com';

const addProtocol = (url: string): string => {
  if (/^https?:\/\//i.test(url)) return url;
  const localhostLike = /^(localhost|127(?:\.\d{1,3}){3}|192\.168\.)/i.test(url);
  return `${localhostLike ? 'http' : 'https'}://${url}`;
};

export const getStorefrontBaseUrl = (): string => {
  const configured =
    process.env.EXPO_PUBLIC_STOREFRONT_URL
    || Constants.expoConfig?.extra?.storefrontUrl
    || (__DEV__ ? LOCAL_STOREFRONT_ORIGIN : PRODUCTION_STOREFRONT_ORIGIN);
  const trimmed = String(configured || PRODUCTION_STOREFRONT_ORIGIN).trim();
  const withProtocol = addProtocol(trimmed);
  return withProtocol.replace(/\/+$/g, '').replace(/\/stores?$/i, '');
};

export const buildStorefrontStoreUrl = (slug: string): string => {
  if (!slug) return '';
  return `${getStorefrontBaseUrl()}/store/${encodeURIComponent(slug)}`;
};

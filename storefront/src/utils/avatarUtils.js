import { resolveImageUrl } from './fileUtils';

export const getCustomerInitials = (customer) => {
  const source = customer?.name || customer?.email || 'Shopper';
  const parts = String(source).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

export const getCustomerAvatarUrl = (customer) => {
  const raw = customer?.avatarUrl ?? customer?.avatar?.url ?? '';
  return resolveImageUrl(raw);
};

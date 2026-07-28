/**
 * Clear leftover document body locks from Radix Dialog/Sheet after abrupt
 * unmount (e.g. navigate while a drawer is open). Without this, body can keep
 * `pointer-events: none` and the sidebar / app shell stop receiving clicks.
 */
export function releaseBodyInteractionLocks() {
  if (typeof document === 'undefined') return;

  const { body, documentElement } = document;
  body.style.removeProperty('pointer-events');
  body.style.removeProperty('overflow');
  body.style.removeProperty('padding-right');
  documentElement.style.removeProperty('pointer-events');
  documentElement.style.removeProperty('overflow');

  // Radix RemoveScroll may leave this attribute behind on rapid route changes.
  if (body.hasAttribute('data-scroll-locked')) {
    body.removeAttribute('data-scroll-locked');
  }

  // Drop inert/aria-hidden leftovers that can block the app shell after a portal unmount.
  if (body.hasAttribute('inert')) {
    body.removeAttribute('inert');
  }
  if (body.getAttribute('aria-hidden') === 'true') {
    body.removeAttribute('aria-hidden');
  }
}

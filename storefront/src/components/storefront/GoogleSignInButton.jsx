import { useEffect, useRef } from 'react';

import { cn } from '../../lib/utils';
import { useGoogleSignIn } from './GoogleSignInHost';

/**
 * Custom-styled Google sign-in/up control. Renders the official GIS button
 * in a full-size transparent overlay so clicks reach Google's iframe reliably.
 */
const GoogleSignInButton = ({
  children,
  className,
  disabled = false,
  isSignup = false,
}) => {
  const googleSignIn = useGoogleSignIn();
  const wrapperRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const wrapper = wrapperRef.current;
    if (!googleSignIn || !overlay || !wrapper || disabled) {
      if (overlay) overlay.innerHTML = '';
      return undefined;
    }

    const text = isSignup ? 'signup_with' : 'signin_with';

    const mount = () => {
      const width = wrapper.clientWidth || 300;
      return googleSignIn.mountButton(overlay, { text, width });
    };

    let cleanup = mount();

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          cleanup?.();
          cleanup = mount();
        })
      : null;

    observer?.observe(wrapper);

    return () => {
      observer?.disconnect();
      cleanup?.();
    };
  }, [disabled, googleSignIn, isSignup]);

  const scriptReady = googleSignIn?.scriptLoadedSuccessfully ?? false;
  const isInteractive = scriptReady && !disabled;

  return (
    <div ref={wrapperRef} className={cn('relative w-full min-h-[44px]', className)}>
      <div
        className={cn(
          'pointer-events-none flex w-full min-h-[44px] items-center justify-center',
          !isInteractive && 'opacity-60',
        )}
        aria-hidden="true"
      >
        {children}
      </div>
      <div
        ref={overlayRef}
        className={cn(
          'absolute inset-0 z-10 overflow-hidden',
          isInteractive ? 'cursor-pointer opacity-[0.01]' : 'pointer-events-none opacity-0',
        )}
        aria-label={isSignup ? 'Sign up with Google' : 'Sign in with Google'}
      />
    </div>
  );
};

export default GoogleSignInButton;

import { Headphones, Mail, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ONLINE_STORE_SUPPORT_EMAIL,
  ONLINE_STORE_SUPPORT_EMAIL_HREF,
  ONLINE_STORE_SUPPORT_WHATSAPP_HREF,
} from '../../constants';

/**
 * Paid setup help CTA for Online Store domain / setup surfaces.
 * Primary channel: WhatsApp (sales). Fallback: email.
 * @param {{ className?: string, compact?: boolean }} props
 */
const OnlineStoreHelpBanner = ({ className = '', compact = false }) => (
  <div
    className={`rounded-lg border border-border bg-muted/40 ${compact ? 'p-3' : 'p-4'} ${className}`}
  >
    <div className={`flex gap-3 ${compact ? 'items-start' : 'flex-col sm:flex-row sm:items-center'}`}>
      <span
        className={`flex shrink-0 items-center justify-center rounded-md border border-border bg-background text-emerald-700 ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        }`}
        aria-hidden
      >
        <Headphones className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={`font-medium text-foreground ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>
          Need help setting up your Online Store?
        </p>
        <p className="text-sm text-muted-foreground">
          Contact support — we can set it up for you (paid). Prefer WhatsApp for a faster reply.
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" variant="outline" size="sm" className="bg-background" asChild>
          <a href={ONLINE_STORE_SUPPORT_EMAIL_HREF}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Email
          </a>
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-[#166534] text-white hover:bg-[#14532d]"
          asChild
        >
          <a
            href={ONLINE_STORE_SUPPORT_WHATSAPP_HREF}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            WhatsApp
          </a>
        </Button>
      </div>
    </div>
    {!compact ? (
      <p className="mt-2 text-xs text-muted-foreground">
        Or email{' '}
        <a className="font-medium text-emerald-700 hover:underline" href={ONLINE_STORE_SUPPORT_EMAIL_HREF}>
          {ONLINE_STORE_SUPPORT_EMAIL}
        </a>
      </p>
    ) : null}
  </div>
);

export default OnlineStoreHelpBanner;

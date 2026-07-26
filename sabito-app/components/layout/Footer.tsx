import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { SITE_NAME } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <p className="font-semibold text-slate-900">Quick Links</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <Link href="/businesses" className="block hover:text-[var(--sabito-teal)]">
              Partner businesses
            </Link>
            <Link href="/signup" className="block hover:text-[var(--sabito-teal)]">
              Become a marketer
            </Link>
          </div>
        </div>
        <div>
          <p className="font-semibold text-slate-900">For businesses</p>
          <p className="mt-3 text-sm text-slate-600">
            Enable Sabito Partners in ABS Settings to appear on this marketplace.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Support</p>
          <p className="mt-3 text-sm text-slate-600">Questions about commissions or applications? Message us on WhatsApp.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">ABS</p>
          <p className="mt-3 text-sm text-slate-600">Powered by African Business Suite. Backend and payouts run through ABS.</p>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center">
          <Logo />
          <p>© {new Date().getFullYear()} {SITE_NAME}</p>
        </div>
      </div>
      <div className="h-2 bg-[var(--sabito-teal)]" />
    </footer>
  );
}

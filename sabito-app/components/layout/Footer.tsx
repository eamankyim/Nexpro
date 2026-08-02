import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ABS_BUSINESS_SIGNUP_URL, ABS_SITE_URL, SITE_NAME, SUPPORT_EMAIL } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2">
        <div>
          <h3 className="text-base font-bold text-white">About us</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Sabito is a performance-based referral platform that connects businesses with trusted
            marketers. Businesses run on African Business Suite; marketers earn on Sabito when
            payment is collected.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Join marketers and ABS businesses growing together.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h4 className="text-sm font-bold text-white">Quick links</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-white">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/ai-match" className="hover:text-white">
                  AI Match
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/commission-guide" className="hover:text-white">
                  Commission guide
                </Link>
              </li>
              <li>
                <Link href="/businesses" className="hover:text-white">
                  Partner businesses
                </Link>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">
                  Contact us
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">For businesses</h4>
            <p className="mt-3 text-sm text-slate-400">
              Sign up on ABS, then enable Sabito Partners in Settings.
            </p>
            <a
              href={ABS_BUSINESS_SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-[var(--sabito-green)] hover:underline"
            >
              Go to ABS →
            </a>
            <a
              href={ABS_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-slate-400 hover:text-white"
            >
              {ABS_SITE_URL.replace(/^https?:\/\//, "")}
            </a>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Legal</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/terms-and-conditions" className="hover:text-white">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-white">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-5 text-sm text-slate-500 sm:flex-row sm:items-center">
          <div className="[&_span]:text-white">
            <Logo light />
          </div>
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
        </div>
      </div>
      <div className="h-2 bg-[var(--sabito-green)]" />
    </footer>
  );
}

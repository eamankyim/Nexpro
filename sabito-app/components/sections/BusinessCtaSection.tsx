import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ABS_APP_URL } from "@/lib/constants";

export function BusinessCtaSection() {
  return (
    <section className="bg-primary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Got a business? Put your partners to work.
            </h2>
            <p className="mt-4 text-teal-100 max-w-lg leading-relaxed">
              Enable Partner Program in African Business Suite so marketers on
              Sabito App can discover you, apply, and bring you customers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={ABS_APP_URL} target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  className="bg-white text-primary hover:bg-mint"
                >
                  Open ABS
                </Button>
              </a>
              <Link href="/signup">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10"
                >
                  I&apos;m a marketer
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-white/20 bg-white p-4">
              <p className="text-xs text-muted-foreground mb-1">New application</p>
              <p className="text-sm font-semibold text-foreground">
                Ama Mensah wants to partner
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Beauty / Spa · Just now
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-mint px-3 py-1.5 text-xs font-semibold text-primary">
                  Review
                </span>
                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Later
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import {
  ChevronRight,
  CreditCard,
  Lock,
  MessageCircle,
  PlayCircle,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BENEFITS = [
  {
    title: 'Sell your products 24/7',
    description: 'Showcase your products and reach customers anytime, anywhere.',
    icon: ShoppingCart,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Accept secure payments',
    description: 'Get paid securely via Mobile Money, cards and more.',
    icon: CreditCard,
    iconClass: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'WhatsApp Integration',
    description: 'Customers can message you directly on WhatsApp before or after placing an order.',
    icon: MessageCircle,
    iconClass: 'bg-violet-100 text-violet-700',
    badge: 'New',
  },
  {
    title: 'Deliver to your customers',
    description: 'Manage orders and deliver with flexible options across Ghana.',
    icon: Truck,
    iconClass: 'bg-amber-100 text-amber-700',
  },
];

const FEATURES = [
  {
    title: 'Beautiful Storefront',
    description: 'Choose themes, add your logo and build a store that stands out.',
    icon: Store,
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Secure & Trusted',
    description: 'Your payments and customer data are always protected.',
    icon: ShieldCheck,
    iconClass: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'WhatsApp Integrated',
    description: 'Chat with customers on WhatsApp for quick support and more sales.',
    icon: MessageCircle,
    iconClass: 'bg-violet-100 text-violet-700',
  },
  {
    title: 'Grow Your Business',
    description: 'Track orders, sales and customers in one powerful dashboard.',
    icon: TrendingUp,
    iconClass: 'bg-amber-100 text-amber-700',
  },
];

const MOCK_PRODUCTS = [
  {
    name: 'Shea Butter',
    price: 'GHS 85',
    colorClass: 'bg-emerald-100',
  },
  {
    name: 'Kente Tote',
    price: 'GHS 120',
    colorClass: 'bg-amber-100',
  },
  {
    name: 'Gift Pack',
    price: 'GHS 210',
    colorClass: 'bg-sky-100',
  },
];

const WelcomeStoreMockup = () => (
  <div className="relative mx-auto flex h-full min-h-[340px] w-full max-w-[560px] items-center justify-center lg:max-w-none">
    <div className="absolute inset-4 rounded-[32px] border border-emerald-100 bg-emerald-50/70" aria-hidden />

    <div className="relative w-full rounded-[28px] border border-slate-200 bg-white p-3 sm:p-4">
      <div className="rounded-[22px] border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
            yourstore.abs.app
          </div>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-600 p-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300 bg-emerald-500">
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold">Akosua's Essentials</p>
                  <p className="text-xs text-emerald-50">Natural goods delivered fast</p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-300 bg-emerald-500 px-3 py-1 text-xs font-semibold">
                Open
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {MOCK_PRODUCTS.map((product) => (
              <div key={product.name} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className={cn('mb-3 h-16 rounded-xl border border-white/70', product.colorClass)} />
                <p className="truncate text-xs font-semibold text-slate-900">{product.name}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-700">{product.price}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    Add
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid grid-cols-3 gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-center text-[11px] font-semibold text-emerald-800">
                WhatsApp
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-2 text-center text-[11px] font-semibold text-sky-800">
                Payments
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-2 text-center text-[11px] font-semibold text-amber-800">
                Delivery
              </span>
            </div>
            <div className="rounded-full bg-slate-900 px-4 py-2 text-center text-xs font-bold text-white">
              Order now
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="absolute -bottom-2 right-3 hidden w-32 rounded-[24px] border border-slate-200 bg-white p-2 sm:block lg:right-0">
      <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-2">
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-slate-300" />
        <div className="rounded-2xl bg-emerald-600 p-2 text-white">
          <ShoppingBag className="mb-6 h-4 w-4" aria-hidden />
          <p className="text-[10px] font-bold leading-tight">3 new orders</p>
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-2 rounded-full bg-slate-200" />
          <div className="h-2 w-2/3 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Online Store welcome intro shown before the setup wizard.
 * @param {{ onStartSetup: () => void, onSeeHowItWorks?: () => void, className?: string }} props
 */
const OnlineStoreWelcome = ({ onStartSetup, onSeeHowItWorks, className }) => {
  const handleSeeHowItWorks = () => {
    if (onSeeHowItWorks) {
      onSeeHowItWorks();
      return;
    }
    document.getElementById('store-welcome-features')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={cn('-mx-2 min-h-[calc(100vh-8rem)] bg-[#f4f6f8] px-2 py-4 sm:mx-0 sm:min-h-0 sm:bg-transparent sm:px-0 sm:py-4', className)}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="overflow-hidden rounded-[28px] border border-slate-200/90 bg-white sm:border-slate-200">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)] lg:gap-10 lg:p-10 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <ShoppingBag className="h-3.5 w-3.5" />
                Online Store
              </span>

            <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.65rem] lg:leading-tight">
              Welcome to Online Store! 🎉
            </h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Set up your store in a few simple steps and start selling to customers online.
            </p>

            <ul className="mt-8 space-y-5">
              {BENEFITS.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <li key={benefit.title} className="flex gap-3.5">
                    <span
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                        benefit.iconClass,
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                        {benefit.title}
                        {benefit.badge ? (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            {benefit.badge}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{benefit.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                type="button"
                onClick={onStartSetup}
                className="h-12 rounded-xl bg-emerald-600 px-6 text-base font-semibold text-white hover:bg-emerald-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Start setup
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSeeHowItWorks}
                className="h-12 rounded-xl border-slate-300 bg-white px-6 text-base font-semibold text-slate-800 hover:bg-slate-50"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                See how it works
              </Button>
            </div>
          </div>

          <div id="store-welcome-preview" className="relative min-h-[320px] lg:min-h-[420px]">
            <WelcomeStoreMockup />
          </div>
        </div>

        <div
          id="store-welcome-features"
          className="border-t border-slate-100 bg-slate-50/80 px-6 py-8 sm:px-8 lg:px-10"
        >
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      feature.iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{feature.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="flex items-center justify-center gap-2 border-t border-slate-100 px-6 py-4 text-center text-sm text-slate-500">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Your store. Your brand. We handle the rest.
        </p>
      </div>
      </div>
    </div>
  );
};

export default OnlineStoreWelcome;

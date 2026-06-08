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

const WELCOME_IMAGE_SRC = '/store-setup-welcome.png';

const WelcomeSideImage = () => (
  <div className="relative mx-auto flex h-full min-h-[300px] w-full max-w-[520px] items-center justify-center lg:max-w-none">
    <img
      src={WELCOME_IMAGE_SRC}
      alt="Online store setup preview"
      className="relative z-10 max-h-[360px] w-full object-contain object-center sm:max-h-[420px] lg:max-h-[500px]"
      loading="eager"
    />
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
            <WelcomeSideImage />
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

import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  ShieldCheck,
  Store,
  Truck,
  Zap,
} from 'lucide-react';

import { dashboardLink } from '../config';
import { APP_NAME } from '../constants';
import { showSuccess } from '../utils/toast';
import { Breadcrumbs, PageShell, SectionHeader } from '../components/storefront/StorefrontLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const trustPillars = [
  { title: 'Trade Assurance', description: 'Shop with peace of mind. Payments are released to sellers after delivery confirmation.', icon: ShieldCheck },
  { title: 'Verified Shops', description: 'Every storefront on Sabito Store is launched and managed by a real business owner.', icon: CheckCircle2 },
  { title: 'Delivery Tracking', description: 'Follow your order from seller confirmation to doorstep delivery once checkout is live.', icon: Truck },
  { title: 'Secure Payments', description: 'Mobile money, card, and bank payment options are being prepared for marketplace checkout.', icon: CreditCard },
];

const shopperBenefits = [
  'Discover products from multiple launched Sabito storefronts in one marketplace',
  'Compare stores, prices, and categories without jumping across websites',
  'See verified storefront profiles, contact options, and delivery hints',
  'Shop from real catalogs backed by published product data',
];

const sellerBenefits = [
  'Launch a customer-ready storefront from the ABS Dashboard',
  'Publish products, categories, and promotions to the public marketplace',
  'Reach buyers with trade assurance and verified-store messaging',
  'Manage orders and fulfillment through the same Sabito seller tools',
];

const supportCards = [
  {
    title: 'Marketplace Support',
    description: 'Questions about browsing stores, products, or marketplace features.',
    email: 'support@sabitostore.com',
    phone: '+233 000 000 000',
    icon: MessageSquare,
  },
  {
    title: 'Order Support',
    description: 'Order tracking, delivery help, and checkout assistance coming soon.',
    email: 'orders@sabitostore.com',
    phone: '+233 000 000 000',
    icon: Truck,
  },
  {
    title: 'Seller Support',
    description: 'Get help launching your Sabito storefront, publishing products, and storefront setup.',
    email: 'seller-support@sabitostore.com',
    phone: '+233 000 000 000',
    icon: Phone,
  },
];

const AboutPage = () => {
  const handleSubmit = useCallback((event) => {
    event.preventDefault();
    showSuccess('Contact form delivery is coming soon. Please email support@sabitostore.com for now.');
  }, []);

  return (
  <PageShell activePath="/about-contact">
    <Breadcrumbs items={[{ label: 'About & Contact' }]} />

    <section className="rounded-2xl border border-green-900/10 bg-green-900 p-6 text-white sm:rounded-[2rem] md:p-10">
      <SectionHeader
        variant="inverse"
        eyebrow="About & Contact"
        title="The customer marketplace built for African businesses"
        description={`${APP_NAME} brings together launched storefronts so customers can discover products, compare trusted sellers, and shop with confidence.`}
        action={(
          <Button size="lg" className="rounded-full bg-amber-400 px-8 font-black text-green-950 hover:bg-amber-300" asChild>
            <Link to="/products">Start Shopping</Link>
          </Button>
        )}
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {trustPillars.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-2xl border border-white/15 bg-white/10 p-5 sm:rounded-3xl">
              <Icon className="h-6 w-6 text-amber-300" />
              <h2 className="mt-4 text-lg font-black">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-green-50/80">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>

    <section className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:rounded-[2rem] md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">For Shoppers</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Discover, compare, and trust every order</h2>
        <div className="mt-5 grid gap-3">
          {shopperBenefits.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
              <p className="text-sm leading-6 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:rounded-[2rem] md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">For Sellers</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Launch once, reach many customers</h2>
        <div className="mt-5 grid gap-3">
          {sellerBenefits.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <Store className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
              <p className="text-sm leading-6 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
            <a href={dashboardLink('/login')}>Seller Login</a>
          </Button>
          <Button className="rounded-full bg-green-700 hover:bg-green-800" asChild>
            <a href={dashboardLink('/signup')}>Open Your Store</a>
          </Button>
        </div>
      </div>
    </section>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
      <SectionHeader
        eyebrow="Contact Sabito Store"
        title="We are here to help customers and sellers"
        description="Reach Sabito Store support for marketplace questions. Contact form submission will be connected in a future release."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {supportCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:rounded-3xl">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 text-green-800">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-black text-slate-950">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
                <a href={`mailto:${card.email}`} className="inline-flex items-center gap-2 hover:text-green-800">
                  <Mail className="h-4 w-4 text-green-700" />
                  {card.email}
                </a>
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-700" />
                  {card.phone}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:rounded-[2rem] md:p-8">
        <h2 className="text-2xl font-extrabold text-slate-950">Send us a message</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use this form to share support questions. Submission will be enabled once the customer support intake endpoint is live.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Full name" required className="h-12 rounded-full px-5" />
            <Input type="email" placeholder="Email address" required className="h-12 rounded-full px-5" />
          </div>
          <Input placeholder="Phone (optional)" className="h-12 rounded-full px-5" />
          <Input placeholder="Subject" required className="h-12 rounded-full px-5" />
          <textarea
            rows={5}
            placeholder="How can we help?"
            required
            className="min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 outline-none ring-green-700 transition focus-visible:ring-2 sm:rounded-3xl"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" className="rounded-full border-green-200 text-green-800 hover:bg-green-50" asChild>
              <Link to="/track-order">Track an order</Link>
            </Button>
            <Button type="submit" className="rounded-full bg-green-700 hover:bg-green-800">Submit message</Button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-green-900/10 bg-green-950 p-6 text-white sm:rounded-[2rem] md:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Visit Us</p>
        <h2 className="mt-3 text-2xl font-black">Sabito Store Customer Support</h2>
        <div className="mt-6 grid gap-4 text-sm leading-6 text-green-50/80">
          <span className="inline-flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Accra, Ghana. Remote support available across participating marketplace stores.
          </span>
          <span className="inline-flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Support hours: Monday to Saturday, 8:00 AM - 6:00 PM GMT.
          </span>
          <span className="inline-flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            support@sabitostore.com
          </span>
        </div>
        <p className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-4 text-xs leading-6 text-green-50/70 sm:rounded-3xl">
          Business owners should continue to manage storefronts from the ABS Dashboard.
        </p>
      </div>
    </section>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:rounded-[2rem] md:p-8">
      <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-green-800">
          <Package className="h-8 w-8" />
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-green-700">Our Promise</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Real stores. Real products. Real support.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Sabito Store is designed for buyers who want a cleaner discovery experience and for businesses that want a modern storefront without rebuilding their operations from scratch.
          </p>
        </div>
        <Button className="rounded-full bg-amber-400 text-green-950 hover:bg-amber-300" asChild>
          <Link to="/stores">
            <Zap className="mr-2 h-4 w-4" />
            Explore stores
          </Link>
        </Button>
      </div>
    </section>
  </PageShell>
  );
};

export default AboutPage;

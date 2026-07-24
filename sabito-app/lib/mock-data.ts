export type BusinessCategory =
  | "All categories"
  | "Retail / Shop"
  | "Studio / Services"
  | "Pharmacy"
  | "Printing"
  | "Beauty / Spa";

export interface MarketplaceBusiness {
  id: string;
  slug: string;
  name: string;
  category: Exclude<BusinessCategory, "All categories">;
  location: string;
  commissionFrom: number;
  rating: number;
  imageUrl: string;
  imageAlt: string;
  description: string;
}

export interface Review {
  id: string;
  name: string;
  location: string;
  text: string;
  rating: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const CATEGORIES: BusinessCategory[] = [
  "All categories",
  "Retail / Shop",
  "Studio / Services",
  "Pharmacy",
  "Printing",
  "Beauty / Spa",
];

export const BUSINESSES: MarketplaceBusiness[] = [
  {
    id: "1",
    slug: "helena-prints",
    name: "Helena Prints",
    category: "Printing",
    location: "East Legon, Accra",
    commissionFrom: 8,
    rating: 5.0,
    imageUrl:
      "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=800&q=80",
    imageAlt: "Printing studio workspace",
    description:
      "Full-service print shop looking for marketers who can bring in corporate and event print jobs.",
  },
  {
    id: "2",
    slug: "nailz-by-helen",
    name: "Nailz By Helen",
    category: "Beauty / Spa",
    location: "Osu, Accra",
    commissionFrom: 12,
    rating: 5.0,
    imageUrl:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80",
    imageAlt: "Nail salon setup",
    description:
      "Premium nail studio offering partner commissions on bookings you refer.",
  },
  {
    id: "3",
    slug: "city-pharmacy-plus",
    name: "City Pharmacy Plus",
    category: "Pharmacy",
    location: "Kumasi",
    commissionFrom: 5,
    rating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&q=80",
    imageAlt: "Pharmacy shelves",
    description:
      "Community pharmacy seeking marketers for wellness product campaigns.",
  },
  {
    id: "4",
    slug: "barima-auto-care",
    name: "Barima Auto Care",
    category: "Studio / Services",
    location: "Spintex, Accra",
    commissionFrom: 10,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80",
    imageAlt: "Auto workshop",
    description:
      "Mechanic studio with partner payouts on service jobs you introduce.",
  },
  {
    id: "5",
    slug: "freshmart-retail",
    name: "FreshMart Retail",
    category: "Retail / Shop",
    location: "Madina, Accra",
    commissionFrom: 6,
    rating: 4.7,
    imageUrl:
      "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80",
    imageAlt: "Retail store aisle",
    description:
      "Neighborhood shop open to marketers promoting high-margin products.",
  },
  {
    id: "6",
    slug: "glow-salon-studio",
    name: "Glow Salon Studio",
    category: "Beauty / Spa",
    location: "Airport Residential",
    commissionFrom: 15,
    rating: 5.0,
    imageUrl:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80",
    imageAlt: "Hair salon interior",
    description:
      "Full-service salon offering strong commissions for consistent referrals.",
  },
  {
    id: "7",
    slug: "sulas-enterprise",
    name: "Sulas Enterprise",
    category: "Retail / Shop",
    location: "Tema",
    commissionFrom: 7,
    rating: 4.9,
    imageUrl:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
    imageAlt: "Modern retail storefront",
    description:
      "Growing retailer looking for partners to drive online and walk-in sales.",
  },
  {
    id: "8",
    slug: "precision-print-lab",
    name: "Precision Print Lab",
    category: "Printing",
    location: "Remote / Nationwide",
    commissionFrom: 9,
    rating: 4.8,
    imageUrl:
      "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&q=80",
    imageAlt: "Design and print materials",
    description:
      "Digital print lab ready for marketers who work with schools and NGOs.",
  },
];

export const REVIEWS: Review[] = [
  {
    id: "1",
    name: "Ama Mensah",
    location: "Ghana",
    text: "I partnered with three shops on Sabito and my first month commissions covered my data and transport. Clear offers, easy apply flow.",
    rating: 5,
  },
  {
    id: "2",
    name: "Kwesi Boateng",
    location: "Ghana",
    text: "As a marketer I finally have one place to find businesses that actually pay. Applying took minutes and the studio replied the same day.",
    rating: 5,
  },
  {
    id: "3",
    name: "Efua Addo",
    location: "Ghana",
    text: "Commission rates are transparent upfront. No guessing — I pick partners that match my audience and follow up from there.",
    rating: 5,
  },
  {
    id: "4",
    name: "Yaw Osei",
    location: "Ghana",
    text: "Love that businesses come from ABS Partner Program. Feels legit, not random WhatsApp groups promising money.",
    rating: 5,
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "1",
    question: "What is Sabito App?",
    answer:
      "Sabito App is a partner marketplace where marketers discover businesses that have enabled Partner Program in African Business Suite (ABS), apply to partner, and earn commission on referred sales or jobs.",
  },
  {
    id: "2",
    question: "How do commissions work?",
    answer:
      "Each business sets its own commission rate (shown as “Commission from X%” on listings). When your referred customer completes a qualifying sale or job, you earn according to that business’s partner terms.",
  },
  {
    id: "3",
    question: "How are payouts handled?",
    answer:
      "Payouts are managed by the partnering business (and later, optionally through ABS tooling). You’ll agree on payout schedule and method when your partnership is approved.",
  },
  {
    id: "4",
    question: "How do I apply to be a partner?",
    answer:
      "Create a marketer account, browse businesses, open a listing, and tap Apply to partner. The business reviews your application and accepts or declines.",
  },
  {
    id: "5",
    question: "I’m a business — how do I appear here?",
    answer:
      "Enable Partner Program in your ABS workspace settings. Once enabled, your business can appear in the Sabito App marketplace for marketers to discover and apply.",
  },
];

export const STATS = {
  partners: { value: "2,400+", label: "active marketers", color: "orange" as const },
  businesses: { value: "860+", label: "partner businesses", color: "teal" as const },
  commissions: { value: "GHS 1.2M+", label: "commissions tracked", color: "rose" as const },
};

export function getBusinessBySlug(slug: string) {
  return BUSINESSES.find((b) => b.slug === slug);
}

export function filterBusinesses(category: BusinessCategory) {
  if (category === "All categories") return BUSINESSES;
  return BUSINESSES.filter((b) => b.category === category);
}

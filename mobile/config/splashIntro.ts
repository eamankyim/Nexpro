/** Marketing intro slides shown once before workspace onboarding. */
export type SplashIntroSlide = {
  id: string;
  image: number;
  title: string;
  subtitle: string;
};

export const SPLASH_INTRO_SLIDES: SplashIntroSlide[] = [
  {
    id: 'business-management',
    image: require('@/assets/splash/splash-1.png'),
    title: 'Manage Your Business Smarter',
    subtitle:
      'Sales, inventory, customers, invoices, and analytics — all in one powerful platform.',
  },
  {
    id: 'growth-analytics',
    image: require('@/assets/splash/splash-2.png'),
    title: 'Track Growth in Real Time',
    subtitle:
      'Monitor sales, profits, customers, and performance with intelligent business insights.',
  },
  {
    id: 'customer-engagement',
    image: require('@/assets/splash/splash-3.png'),
    title: 'Automate Customer Communication',
    subtitle:
      'Send updates, reminders, and job notifications instantly through WhatsApp automation.',
  },
];

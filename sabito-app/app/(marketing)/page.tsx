import { Hero } from "@/components/sections/Hero";
import { MarketplaceSection } from "@/components/sections/MarketplaceSection";
import { StatsSection } from "@/components/sections/StatsSection";
import { ReviewsSection } from "@/components/sections/ReviewsSection";
import { BusinessCtaSection } from "@/components/sections/BusinessCtaSection";
import { FaqSection } from "@/components/sections/FaqSection";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <MarketplaceSection limit={8} />
      <StatsSection />
      <ReviewsSection />
      <BusinessCtaSection />
      <FaqSection />
    </main>
  );
}

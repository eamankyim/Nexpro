import { Star } from "lucide-react";
import { REVIEWS } from "@/lib/mock-data";

export function ReviewsSection() {
  return (
    <section id="reviews" className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-3">
            Reviews
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            What partners are saying
          </h2>
          <p className="mt-3 text-muted-foreground">
            Real experiences from marketers earning with partner businesses
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {REVIEWS.map((review) => (
            <article
              key={review.id}
              className="relative rounded-2xl border border-border bg-white p-5"
            >
              <span
                className="pointer-events-none absolute right-4 top-3 text-5xl font-serif text-slate-100 select-none"
                aria-hidden
              >
                ”
              </span>
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-accent text-accent"
                    aria-hidden
                  />
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed relative z-10">
                {review.text}
              </p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-deep text-primary font-semibold text-sm">
                  {review.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{review.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {review.location}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

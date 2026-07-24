import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 group", className)}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-display font-bold text-lg"
        aria-hidden
      >
        S
      </span>
      <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-primary-dark">
        {SITE_NAME}
      </span>
    </Link>
  );
}

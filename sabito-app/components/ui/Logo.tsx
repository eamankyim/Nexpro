import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sabito-teal)] text-white text-sm">
        S
      </span>
      <span>{SITE_NAME}</span>
    </Link>
  );
}

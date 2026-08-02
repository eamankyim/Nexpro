import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Match - Sabito | Find Partner Businesses",
  description:
    "Search ABS businesses that enabled Sabito Partners and find the right match for your referrals.",
};

export default function AIMatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

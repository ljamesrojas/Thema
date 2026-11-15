import type { Metadata } from "next";
import { PricingPage } from "@/site/pricing-page";

export const metadata: Metadata = {
  title: "Pricing · Thema",
  description:
    "Every feature, free to start. Pro keeps unlimited projects and reads 50 sites a day.",
};

/** Pricing (docs/pages.md). Built once; every value comes from the engine and its constants. */
export default function Page() {
  return <PricingPage />;
}

import type { Metadata } from "next";
import { HowItWorksPage } from "@/site/how-it-works";

export const metadata: Metadata = {
  title: "How it works · Thema",
  description: "From five links to one system: paste, extract, tag, tune and export.",
};

/** How it works (docs/pages.md). Built once; every value comes from the engine and its constants. */
export default function Page() {
  return <HowItWorksPage />;
}

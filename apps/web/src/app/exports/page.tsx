import type { Metadata } from "next";
import { ExportsPage } from "@/site/exports-page";

export const metadata: Metadata = {
  title: "Exports · Thema",
  description:
    "Five files, one system: DESIGN.md, Tailwind v4, shadcn/ui, DTCG tokens and a style guide.",
};

/** Exports (docs/pages.md). Built once; every value comes from the engine and its constants. */
export default function Page() {
  return <ExportsPage />;
}

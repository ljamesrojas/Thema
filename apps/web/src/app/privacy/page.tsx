import type { Metadata } from "next";
import text from "../../../../../docs/legal/privacy.md?raw";
import { LegalPage } from "@/site/legal-page";

export const metadata: Metadata = {
  title: "Privacy notice · Thema",
  description:
    "How Thema handles your data: what it collects, why, who processes it, and your rights.",
};

/** Privacy notice: docs/legal/privacy.md, rendered. */
export default function Page() {
  return <LegalPage title="Privacy notice" markdown={text} />;
}

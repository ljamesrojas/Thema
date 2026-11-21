import type { Metadata } from "next";
import text from "../../../../../docs/legal/refunds.md?raw";
import { LegalPage } from "@/site/legal-page";

export const metadata: Metadata = {
  title: "Refund policy · Thema",
  description: "Refunds for Thema Pro, sold through Paddle.",
};

/** Refund policy: docs/legal/refunds.md, rendered. */
export default function Page() {
  return <LegalPage title="Refund policy" markdown={text} />;
}

import type { Metadata } from "next";
import text from "../../../../../docs/legal/terms.md?raw";
import { LegalPage } from "@/site/legal-page";

export const metadata: Metadata = {
  title: "Terms of service · Thema",
  description: "The terms for using Thema and Thema Pro.",
};

/** Terms of service: docs/legal/terms.md, rendered. */
export default function Page() {
  return <LegalPage title="Terms of service" markdown={text} />;
}

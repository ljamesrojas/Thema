import type { Metadata } from "next";
import { AgentsPage } from "@/site/agents-page";

export const metadata: Metadata = {
  title: "For agents · Thema",
  description:
    "Give your coding agent a design system: DESIGN.md in your repo, or Thema as an MCP server.",
};

/** For agents (docs/pages.md). Built once; every value comes from the engine and its constants. */
export default function Page() {
  return <AgentsPage />;
}

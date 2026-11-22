import type { Metadata } from "next";
import { PlansPage } from "@/site/plans-page";

export const metadata: Metadata = {
  title: "Plans · Thema",
  description:
    "Every feature, free for everyone. Sign in with GitHub or Google to keep your projects.",
};

/** Plans (docs/pages.md → Pricing). Built once; every value comes from the code's constants. */
export default function Page() {
  return <PlansPage />;
}

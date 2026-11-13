import { Landing } from "@/components/landing";
import { heroBlend } from "@/lib/hero-blend";

// The hero blend is computed once at build time by the real engine (see lib/hero-blend.ts).
export default function Home() {
  return <Landing blend={heroBlend()} />;
}

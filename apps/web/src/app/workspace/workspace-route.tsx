"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Workspace } from "@/workspace/workspace";

/** Adds the Landing's URL once, then drops `?url=` so a reload doesn't add it again. */
export function WorkspaceRoute({ initialUrl }: { initialUrl?: string }) {
  const router = useRouter();
  const onInitialUrlUsed = useCallback(() => router.replace("/workspace"), [router]);
  return <Workspace {...(initialUrl ? { initialUrl } : {})} onInitialUrlUsed={onInitialUrlUsed} />;
}

import { WorkspaceRoute } from "./workspace-route";

/** The Workspace (SPEC → Screens). `?url=` comes from the Landing's hero input. */
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[] }>;
}) {
  const { url } = await searchParams;
  return <WorkspaceRoute {...(typeof url === "string" ? { initialUrl: url } : {})} />;
}

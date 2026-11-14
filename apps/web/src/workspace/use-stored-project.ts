"use client";

import { useEffect, useState } from "react";
import { browserStorage, loadProject, type WorkspaceProject } from "./project";

/**
 * The project saved in this browser (anonymous projects live here only, SPEC), read once on
 * mount: null until then, so server and first client render agree.
 */
export function useStoredProject(): { loaded: boolean; project: WorkspaceProject | null } {
  const [state, setState] = useState<{ loaded: boolean; project: WorkspaceProject | null }>({
    loaded: false,
    project: null,
  });
  useEffect(() => {
    setState({ loaded: true, project: loadProject(browserStorage()) });
  }, []);
  return state;
}

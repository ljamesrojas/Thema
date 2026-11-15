"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type AccountInfo } from "@/workspace/api";

export type AccountState =
  | { status: "loading" }
  /** The server couldn't say: treated like accounts being off, so anonymous use carries on. */
  | { status: "unavailable" }
  | { status: "ready"; info: AccountInfo };

/** Who's signed in (GET /api/account), fetched once per page; `refresh` after a change. */
export function useAccount(): AccountState & { refresh: () => void } {
  const [state, setState] = useState<AccountState>({ status: "loading" });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api.account().then(
      (info) => !cancelled && setState({ status: "ready", info }),
      () => !cancelled && setState({ status: "unavailable" }),
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}

/** The signed-in account, or null (signed out, loading, or accounts off). */
export const signedInAccount = (state: AccountState) =>
  state.status === "ready" ? state.info.account : null;

"use client";

import { useEffect } from "react";
import { accountsEnabled, hasSessionToken, syncNow } from "@/lib/accounts";

/**
 * Sync-on-load (ADR-0015): when this device holds a session token, merge the
 * guest state up and the account's state back down on every page open. Renders
 * nothing; with no flag or no token it is a no-op and the guest path is
 * untouched.
 */
export function AccountSync() {
  useEffect(() => {
    if (!accountsEnabled() || !hasSessionToken()) return;
    void syncNow().catch(() => null);
  }, []);
  return null;
}

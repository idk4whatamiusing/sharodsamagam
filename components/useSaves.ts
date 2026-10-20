"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { EMPTY_SAVES, fetchSaves, signIn, toggleSave } from "../lib/account";
import type { SavedSets } from "../lib/account";

/**
 * The signed-in user's saved items.
 *
 * Everything lives on the Worker: D1 holds the rows, KV caches the list for
 * five minutes. The browser keeps no copy - when signed out the sets are
 * empty and the save buttons ask the visitor to sign in.
 */
export function useSaves() {
  const { account, ready } = useAuth();
  const [saves, setSaves] = useState<SavedSets>(EMPTY_SAVES);

  // The account resolves from the API a moment after the page loads. A
  // visitor who clicks Save in that window must not be bounced to the sign-in
  // page, so the toggle waits for the answer instead of guessing.
  const accountRef = useRef<Account | null>(account);
  const readyRef = useRef(false);
  const waiters = useRef<((value: Account | null) => void)[]>([]);

  accountRef.current = account;
  readyRef.current = ready;

  useEffect(() => {
    if (!ready) return;
    const pending = waiters.current;
    waiters.current = [];
    for (const resolve of pending) resolve(account);
  }, [account, ready]);

  useEffect(() => {
    if (!ready || !account) return;
    let active = true;
    fetchSaves().then((next) => {
      if (active && next) setSaves(next);
    });
    return () => {
      active = false;
    };
  }, [account, ready]);

  const waitForAccount = useCallback(
    () =>
      new Promise<Account | null>((resolve) => {
        if (readyRef.current) {
          resolve(accountRef.current);
          return;
        }
        const timer = setTimeout(() => resolve(accountRef.current), 6000);
        waiters.current.push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      }),
    []
  );

  const toggle = useCallback(
    async (
      kind: "pandal" | "trail" | "route" | "liked",
      id: string,
      value?: string | number
    ) => {
      const user = await waitForAccount();
      if (!user) {
        signIn(window.location.pathname);
        return { saved: false, ok: false };
      }
      const result = await toggleSave(kind, id, value);
      if (!result) return { saved: false, ok: false };
      setSaves(result.saves);
      return { saved: result.saved, ok: true };
    },
    [waitForAccount]
  );

  return { saves, toggle, account, ready };
}

type Account = { id: string; email: string; name: string; picture: string };

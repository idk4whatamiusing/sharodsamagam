"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Account } from "../lib/account";
import { fetchAccount } from "../lib/account";

type AuthValue = {
  account: Account | null;
  ready: boolean;
};

const AuthContext = createContext<AuthValue>({ account: null, ready: false });

/**
 * Makes the signed-in account available to the whole site.
 *
 * The session itself lives in an HttpOnly cookie the Worker sets, so there
 * is nothing to store on the client - this only mirrors the display details
 * (name, picture) that the header, the map's save buttons and the AI planner
 * need to know whether to prompt for a sign-in.
 *
 * The provider adds no element of its own: the site chrome is laid out as
 * direct children of <body>, and a wrapper div would break the column
 * layout that keeps the footer at the bottom.
 */
export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAccount().then((user) => {
      if (!active) return;
      setAccount(user);
      setReady(true);
      document.documentElement.dataset.authState = user ? "signed-in" : "signed-out";
    });
    return () => {
      active = false;
    };
  }, []);

  return <AuthContext.Provider value={{ account, ready }}>{children}</AuthContext.Provider>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Account } from "../lib/account";
import { fetchAccount, signIn, signOut } from "../lib/account";

/**
 * The account control.
 *
 * It lives inside the MORE menu - the same panel the site's other
 * destinations live in - rather than as a loose button in the navbar, so the
 * header keeps the original's shape. Signed out it offers Google sign-in;
 * signed in it shows the account with its own profile and a sign-out.
 *
 * The session itself is an HttpOnly cookie the Worker sets, so this only
 * mirrors the display details.
 */
export default function AccountButton() {
  const [account, setAccount] = useState<Account | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchAccount().then((user) => {
      if (active) setAccount(user);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const find = () => {
      const node = document.getElementById("our-more-account");
      if (node) {
        setSlot(node);
        return true;
      }
      return false;
    };
    if (find()) return;
    // The MORE panel is built by ClientNav, which mounts after this
    // component, so the slot can appear a moment later.
    const observer = new MutationObserver(() => {
      if (find()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!slot) return null;

  const panel = account ? (
    <div className="flex items-center gap-2.5 w-full">
      {account.picture ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={account.picture}
          alt=""
          className="w-9 h-9 rounded-full border-2 border-[#E5C880] object-cover shrink-0"
        />
      ) : (
        <span className="w-9 h-9 rounded-full bg-[#D90429]/10 border border-[#D90429]/25 text-[#D90429] flex items-center justify-center font-serif font-black text-sm shrink-0">
          {(account.name || "P").slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h4 className="font-serif font-bold text-xs truncate">{account.name}</h4>
        <p className="text-[10px] text-[#2C1210]/70 font-serif truncate">{account.email}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <a
          href="/profile"
          className="px-3 py-1.5 rounded-xl bg-white border border-[#E5C880] hover:border-[#D90429] font-serif font-bold text-xs text-[#2C1210] no-underline transition-colors"
        >
          My profile
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          className="px-3 py-1.5 rounded-xl bg-[#D90429] hover:bg-[#B80322] text-white font-serif font-bold text-xs transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2.5 w-full">
      <span className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 text-[#D97706] flex items-center justify-center shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          fill="currentColor"
          viewBox="0 0 256 256"
        >
          <path d="M143.7,216a79.2,79.2,0,0,0-56-56,88.1,88.1,0,0,1,85.3-88.1,96,96,0,0,1,16,22.3,8.1,8.1,0,0,1-6.5,9.9,16,16,0,0,0-10.2-14.3,64,64,0,0,0-58.6,58.6,8,8,0,0,1-6.5-9.9,8.1,8.1,0,0,1-9.9-6.5A112,112,0,0,0,143.7,216Z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="font-serif font-bold text-xs">Sign in to Sharodsamagam</h4>
        <p className="text-[10px] text-[#2C1210]/70 font-serif truncate">
          Save pandals, trails and trips across your devices
        </p>
      </div>
      <button
        type="button"
        onClick={() => signIn(window.location.pathname)}
        className="px-3 py-1.5 rounded-xl bg-[#D90429] hover:bg-[#B80322] text-white font-serif font-bold text-xs shrink-0 transition-colors"
      >
        Sign in
      </button>
    </div>
  );

  return createPortal(panel, slot);
}

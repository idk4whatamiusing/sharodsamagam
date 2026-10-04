"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClientNav() {
  const router = useRouter();
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest("a");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href) return;
      if (href.startsWith("/") && !href.startsWith("//") && !el.target) {
        e.preventDefault();
        router.push(href);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [router]);
  return null;
}

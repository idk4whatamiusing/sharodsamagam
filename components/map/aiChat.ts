"use client";

import { useCallback, useState } from "react";
import type { AiPlan } from "./AiPlannerPanel";

export type AiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: AiPlan;
};

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * The AI planner's conversation.
 *
 * It lives here rather than inside the panel because the map shows the
 * planner in two places - the desktop sidebar and the phone's bottom sheet -
 * and both must show the same conversation.
 */
export function useAiChat(onPlan: (plan: AiPlan) => void) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setInput("");
      setError("");
      setMessages((previous) => [...previous, { id: uuid(), role: "user", text: message }]);
      setBusy(true);
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message }),
        });
        if (res.status === 401) {
          setError("Your session expired. Sign in again to plan.");
          setBusy(false);
          return;
        }
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          setError(
            detail.error === "google_not_configured"
              ? "Google sign-in is not configured on this deployment yet."
              : "The planner could not answer that. Please try again."
          );
          setBusy(false);
          return;
        }
        const next = (await res.json()) as AiPlan;
        setMessages((previous) => [
          ...previous,
          {
            id: uuid(),
            role: "assistant",
            text: next.clarify ? next.clarify : next.reply,
            plan: next.clarify ? undefined : next,
          },
        ]);
        if (!next.clarify && next.stops.length) onPlan(next);
      } catch {
        setError("The planner is unreachable right now. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, onPlan]
  );

  const clear = useCallback(() => setMessages([]), []);

  return { messages, input, setInput, busy, error, send, clear };
}

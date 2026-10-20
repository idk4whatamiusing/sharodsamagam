"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../AuthProvider";
import { signIn } from "../../lib/account";
import { Icon, Spinner } from "./ui";

type PlanStop = {
  id: string;
  name: string;
  kind: "pandal" | "poi";
  lat: number | null;
  lng: number | null;
  zone: string;
  locality: string;
};

type Plan = {
  reply: string;
  clarify: string | null;
  notes: string;
  mode: "walk" | "drive" | "cycle" | "transit";
  stops: PlanStop[];
  meetingPoint: PlanStop | null;
  ai: boolean;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  plan?: Plan;
};

const CHIPS = [
  "Heritage pandals in North Kolkata, about 3 hours",
  "Quiet evening in Salt Lake, avoid crowded",
  "Famous lighting pandals in South Kolkata",
  "Food trail from Park Street to Kalighat",
  "Meet a friend at Esplanade Metro, then see 4 pandals",
];

const uuid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));

export function AiPlannerPanel({
  onPlan,
  plan,
  onShare,
  onOpenGoogle,
  onOpenApple,
  onSave,
  saved,
  onClear,
}: {
  onPlan: (plan: Plan) => void;
  plan: Plan | null;
  onShare: () => void;
  onOpenGoogle: () => void;
  onOpenApple: () => void;
  onSave: () => void;
  saved: boolean;
  onClear: () => void;
}) {
  const { account, ready } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  if (ready && !account) {
    return (
      <div className="flex h-full flex-col gap-3">
        <div className="rounded-2xl border border-[#E5C880] bg-[#FFFBF0] p-4 text-center">
          <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#D90429]/10 text-[#D90429]">
            <Icon name="sparkle" size={20} />
          </span>
          <h2 className="font-serif text-sm font-black text-[#2C1210]">
            Plan a trip with the AI guide
          </h2>
          <p className="mt-1 font-sans text-[10.5px] leading-relaxed text-[#2C1210]/65">
            Sign in with Google and describe what you want to see - the zone, the mood, how long
            you have and where you are meeting. The planner builds the route and draws it on the
            map.
          </p>
          <button
            type="button"
            onClick={() => signIn(window.location.pathname)}
            className="mt-3 cursor-pointer rounded-full border border-[#E5C880] bg-[#D90429] px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#B50321]"
          >
            Sign in to plan
          </button>
        </div>
      </div>
    );
  }

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setError("");
    setMessages((previous) => [
      ...previous,
      { id: uuid(), role: "user", text: message },
    ]);
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
      const next = (await res.json()) as Plan;
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
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-sm font-black leading-tight text-[#2C1210]">
            AI Trip Planner
          </h2>
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#2C1210]/45">
            Describe the trip you want
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              onClear();
            }}
            className="shrink-0 cursor-pointer rounded-lg border border-[#E5C880] px-2 py-1 font-mono text-[9px] font-bold text-[#B45309] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
          >
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-[#E5C880] bg-[#FFFBF0] p-3">
            <p className="font-sans text-[10.5px] leading-relaxed text-[#2C1210]/70">
              Tell the planner where you are, how long you have and what you want to see. It
              picks real pandals and transit hubs, orders them into a route and draws it on the
              map.
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void send(chip)}
                  className="cursor-pointer rounded-full border border-[#E5C880] bg-white px-2 py-1 text-left font-mono text-[9px] font-semibold text-[#2C1210]/70 transition-colors hover:border-[#D90429] hover:text-[#D90429]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[92%] rounded-2xl px-2.5 py-2 text-[11px] leading-relaxed ${
              message.role === "user"
                ? "ml-auto bg-[#D90429] font-sans text-white"
                : "bg-[#FFFBF0] font-sans text-[#2C1210]/85 ring-1 ring-[#E5C880]/70"
            }`}
          >
            {message.text}
            {message.plan && message.plan.meetingPoint && (
              <p className="mt-1.5 rounded-lg bg-[#FFF3D6] px-2 py-1 font-mono text-[9px] font-bold text-[#B45309]">
                Meet at {message.plan.meetingPoint.name}
              </p>
            )}
            {message.plan && message.plan.stops.length > 0 && (
              <ol className="mt-1.5 space-y-0.5">
                {message.plan.stops.map((stop, index) => (
                  <li key={stop.id} className="flex items-start gap-1.5">
                    <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#B45309] font-mono text-[7px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{stop.name}</span>
                  </li>
                ))}
              </ol>
            )}
            {message.plan && message.plan.notes && (
              <p className="mt-1.5 border-t border-[#E5C880]/60 pt-1.5 font-sans text-[10px] italic text-[#B45309]">
                {message.plan.notes}
              </p>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFFBF0] px-2.5 py-2 font-mono text-[10px] text-[#B45309] ring-1 ring-[#E5C880]/70">
            <Spinner size={12} /> Planning your route...
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-[#D90429]/30 bg-[#FFF0F2] px-2.5 py-1.5 font-sans text-[10px] text-[#D90429]">
            {error}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {plan && plan.stops.length > 0 && (
        <div className="shrink-0 space-y-1.5 rounded-xl border border-[#E5C880] bg-[#FFFBF0] p-2">
          <p className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-[#2C1210]/45">
            {plan.stops.length} stops - {plan.mode}
          </p>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={onOpenGoogle}
              className="cursor-pointer rounded-lg bg-[#D90429] px-2 py-1.5 font-mono text-[9px] font-bold text-white transition-colors hover:bg-[#B50321]"
            >
              Google Maps
            </button>
            <button
              type="button"
              onClick={onOpenApple}
              className="cursor-pointer rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-mono text-[9px] font-bold text-[#2C1210] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
            >
              Apple Maps
            </button>
            <button
              type="button"
              onClick={onSave}
              className="cursor-pointer rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-mono text-[9px] font-bold text-[#2C1210] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
            >
              {saved ? "Saved" : "Save trip"}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="cursor-pointer rounded-lg border border-[#E5C880] bg-white px-2 py-1.5 font-mono text-[9px] font-bold text-[#2C1210] transition-colors hover:border-[#D90429] hover:text-[#D90429]"
            >
              Share
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex shrink-0 items-center gap-1.5"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. 3 hours of lighting pandals in South Kolkata"
          className="min-w-0 flex-1 rounded-full border border-[#E5C880] bg-[#FFFBF0] px-3 py-1.5 font-sans text-[11px] text-[#2C1210] outline-none placeholder:text-[#2C1210]/35 focus:border-[#D90429]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send to the planner"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#D90429] text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <Icon name="arrowRight" size={13} />
        </button>
      </form>
    </div>
  );
}

export type { Plan as AiPlan };

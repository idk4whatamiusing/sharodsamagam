"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** One entry of public/paras.json, produced by scripts/build-paras-json.mjs. */
type Pandal = {
  slug: string;
  name: string;
  zone: string;
  color: string;
  grad: string;
  image: string;
  established: number | null;
  rating: number | null;
  reviewCount: number;
  address: string;
  nearestMetro: string;
  description: string;
  tags: string[];
};

const BATCH = 24;
const SAVED_KEY = "sharodsamagam:saved-pandals";

/**
 * Curated enough to be "featured". The original has no tag by that name, so
 * this maps to the award-winner tag harvested from its own cards rather than
 * inventing a ranking.
 */
const FEATURED_TAGS = new Set(["award-winner"]);

/** Fails loudly: a silently half-built card is worse than a visible error. */
function need(el: Element | null | undefined, what: string): Element {
  if (!el) throw new Error(`paras card template is missing ${what}`);
  return el;
}

/**
 * Rewrites a clone of the first server-rendered card into a card for `p`.
 *
 * Cloning rather than re-authoring the markup is deliberate. The card is
 * ~4.2 KB of Tailwind, inline SVG and inline styles; hand-copying it into
 * this file would drift from mirror/paras.html the next time the original is
 * re-scraped. Cloning keeps every icon and gradient exactly as scraped.
 */
function paintCard(card: HTMLElement, p: Pandal) {
  const q = <T extends Element>(sel: string): T => need(card.querySelector(sel), sel) as T;

  const zoneName = p.zone.replace(/^./, (c) => c.toUpperCase());
  card.setAttribute("href", `/paras/${p.slug}`);

  const img = q<HTMLImageElement>("img");
  img.src = p.image;
  img.alt = `${p.name} Durga Puja Pandal Kolkata (${p.zone} Kolkata)`;
  img.title = `${p.name} — ${p.address}`;

  // Zone badge: background colour sits on the wrapper, the label in a span.
  const badge = q<HTMLElement>('div[style*="background-color"]');
  badge.style.backgroundColor = p.color;
  badge.querySelector("span")!.textContent = p.zone;

  const est = q<HTMLElement>("div.inline-block");
  est.textContent = p.established ? `Est. ${p.established}` : "";

  q("h3").textContent = p.name;
  q<HTMLElement>("span.text-white\\/90").textContent =
    p.rating == null ? "—" : String(p.rating);

  q<HTMLElement>("span.truncate").textContent = p.address;
  const metro = q<HTMLElement>("span.font-bold.shrink-0");
  metro.textContent = p.nearestMetro ? `· ${p.nearestMetro}` : "";
  metro.style.display = p.nearestMetro ? "" : "none";

  q("p.text-xs").textContent = p.description;

  // The 3px accent strip under the image.
  const strip = Array.from(card.querySelectorAll<HTMLElement>("div[style*='height:3px']"))[0];
  if (strip) strip.style.background = `linear-gradient(to right, ${p.grad})`;

  // Tag chips. The 54 pandals the original's own directory omits have none,
  // and are rendered without the row rather than given invented tags.
  const tagRow = q<HTMLElement>("div.flex.flex-wrap.gap-1");
  if (p.tags.length) {
    tagRow.innerHTML = p.tags
      .map(
        (t) =>
          `<span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full font-mono bg-stone-100 text-stone-700">${t}</span>`
      )
      .join("");
    tagRow.style.display = "";
  } else {
    tagRow.innerHTML = "";
    tagRow.style.display = "none";
  }

  return card;
}

const readSaved = (): Set<string> => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

export default function ParasInteractions() {
  const pathname = usePathname();

  // Only the listing. /paras/<slug> detail pages also contain links to
  // sibling pandals, and treating those as filterable cards would be wrong.
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments[0] !== "paras" || segments.length > 1) return;
    const main = document.querySelector("main");
    if (!main) return;

    // Exactly the cards the original renders: its own `block h-full` class on
    // an anchor. A bare `a[href^="/paras/"]` also matches links like
    // /paras/search, which are not cards and must not be filtered or cloned.
    const CARD = 'a.block.h-full[href^="/paras/"]';

    const cardAnchors = () =>
      Array.from(main!.querySelectorAll<HTMLAnchorElement>(CARD));

    const container = cardAnchors()[0]?.parentElement;
    const template = cardAnchors()[0]?.cloneNode(true) as HTMLElement | undefined;
    const moreSlot = main.querySelector<HTMLElement>("[data-paras-more]");
    const sentinel = main.querySelector<HTMLElement>("[data-paras-sentinel]");
    const countEl = main.querySelector<HTMLElement>("[data-paras-count]");
    const loadBtn = main.querySelector<HTMLButtonElement>("[data-paras-load]");

    // ---- search haystack -----------------------------------------------
    // The old handler read innerText off every card on every keystroke. At 24
    // cards that was free; at 776 it would be 776 layout reads per character.
    const haystack = new WeakMap<HTMLElement, string>();
    const index = (card: HTMLAnchorElement) => {
      if (!haystack.has(card)) haystack.set(card, card.innerText.toLowerCase());
      return haystack.get(card)!;
    };
    cardAnchors().forEach(index);

    // ---- filters -------------------------------------------------------
    let query = "";
    let zone = "all";
    let savedOnly = false;
    let featuredOnly = false;
    let mode: "grid" | "list" = "grid";

    const saved = readSaved();

    const applyFilters = () => {
      let shown = 0;
      cardAnchors().forEach((a) => {
        const slug = a.getAttribute("href")?.split("/").pop() || "";
        const badge = (a.querySelector("span")?.textContent || "").trim().toLowerCase();
        const ok =
          (!query || index(a).includes(query)) &&
          (zone === "all" || badge.startsWith(zone)) &&
          (!savedOnly || saved.has(slug)) &&
          (!featuredOnly || featuredTags.has(slug));
        a.style.display = ok ? "" : "none";
        if (ok) shown++;
      });
      if (countEl) {
        const total = all.length || shown;
        countEl.textContent =
          shown === total
            ? `Showing all ${total} pandals`
            : `Showing ${shown} of ${total} pandals`;
      }
    };

    // ---- featured / saved state ---------------------------------------
    let all: Pandal[] = [];
    const bySlug = new Map<string, Pandal>();
    const featuredTags = new Set<string>();

    const setChipState = () => {
      main!.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
        const t = b.innerText.trim().toLowerCase();
        const badge = b.querySelector("span:last-child");
        if (t.startsWith("featured") && badge) badge.textContent = String(featuredTags.size);
        if (t.startsWith("saved") && badge) badge.textContent = String(saved.size);
      });
    };

    // ---- card list-mode rendering -------------------------------------
    const slimRow = (p: Pandal) => {
      const esc = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `
      <div class="flex items-center gap-3 rounded-2xl border border-[#EAD5A0] bg-white p-2.5 shadow-xs hover:border-[#D90429] transition-colors">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" class="w-11 h-11 rounded-full object-cover border border-[#EAD5A0] shrink-0" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-widest text-white" style="background:${p.color}">${esc(p.zone)}</span>
            <h3 class="font-serif font-bold text-sm text-[#2C1210] truncate">${esc(p.name)}</h3>
          </div>
          <p class="text-[11px] text-[#2C1210]/60 truncate">${esc(p.address)}${p.nearestMetro ? " · " + esc(p.nearestMetro) : ""}</p>
        </div>
        <span class="px-2.5 py-1.5 rounded-full text-xs font-mono font-bold text-[#B45309] bg-amber-50 border border-amber-200 shrink-0">★ ${p.rating ?? "—"}</span>
        <span class="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0">⤴</span>
        <span class="w-8 h-8 rounded-full bg-rose-50 text-[#D90429] flex items-center justify-center font-bold shrink-0">→</span>
      </div>`;
    };

    const applyMode = () => {
      if (!container) return;
      container.className =
        mode === "list"
          ? "flex flex-col gap-2"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5";
      cardAnchors().forEach((a) => {
        const slug = a.getAttribute("href")?.split("/").pop() || "";
        const p = bySlug.get(slug);
        if (mode === "list") {
          if (!a.dataset.orig) a.dataset.orig = a.innerHTML;
          a.innerHTML = p ? slimRow(p) : a.innerHTML;
          a.classList.remove("group", "block", "h-full");
        } else {
          if (a.dataset.orig) {
            a.innerHTML = a.dataset.orig;
            a.className = "block h-full";
          }
        }
      });
      document.body.classList.toggle("paras-list-mode", mode === "list");
      main!.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
        const t = b.innerText.trim();
        if (t === "Grid" || t === "List") {
          const on = t.toLowerCase() === mode;
          b.style.background = on ? "#D90429" : "";
          b.style.color = on ? "#fff" : "";
          b.style.borderColor = on ? "#D90429" : "";
        }
      });
    };

    // ---- progressive loading ------------------------------------------
    // Slugs already on the page. The 24 server-rendered cards are the
    // original's own selection, which is NOT the head of paras.json (that is
    // sorted by rating), so counting cards and slicing `all` by that count
    // silently skipped 24 records and re-added 20 duplicates. Track slugs.
    const seen = new Set(
      cardAnchors().map((a) => (a.getAttribute("href") || "").split("/").pop() || "")
    );
    let cursor = 0;
    let exhausted = false;
    let loading = false;

    const appendBatch = () => {
      if (exhausted || loading || !container || !template) return;
      loading = true;

      const next: Pandal[] = [];
      while (next.length < BATCH && cursor < all.length) {
        const p = all[cursor++];
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        next.push(p);
      }

      if (!next.length) {
        exhausted = true;
        loading = false;
        finishLoading();
        return;
      }

      const frag = document.createDocumentFragment();
      const failed: string[] = [];
      next.forEach((p) => {
        const clone = template.cloneNode(true) as HTMLAnchorElement;
        try {
          paintCard(clone, p);
        } catch {
          // One bad record must not take the batch down, but it must not be
          // silent either.
          failed.push(p.slug);
          seen.delete(p.slug);
          return;
        }
        frag.appendChild(clone);
      });
      container!.appendChild(frag);
      if (failed.length) {
        console.warn("[paras] could not render", failed.length, "cards:", failed.slice(0, 5));
      }

      cardAnchors().forEach((a) => {
        if (haystack.has(a)) return;
        if (mode === "list") slimSwap(a);
        else index(a);
      });
      wireCards();
      applyMode();
      applyFilters();
      setChipState();
      loading = false;
      if (cursor >= all.length) {
        exhausted = true;
        finishLoading();
      }
    };

    const slimSwap = (a: HTMLAnchorElement) => {
      const slug = a.getAttribute("href")?.split("/").pop() || "";
      const p = bySlug.get(slug);
      if (!p) return;
      if (!a.dataset.orig) a.dataset.orig = a.innerHTML;
      a.innerHTML = slimRow(p);
      a.classList.remove("group", "block", "h-full");
    };

    const finishLoading = () => {
      if (sentinel) sentinel.style.display = "none";
      if (loadBtn) loadBtn.style.display = "none";
    };

    // ---- per-card actions ---------------------------------------------
    const wireCards = () => {
      cardAnchors().forEach((a) => {
        const slug = a.getAttribute("href")?.split("/").pop() || "";
        if (!slug || a.dataset.wired) return;
        a.dataset.wired = "1";

        const saveBtn = a.querySelector<HTMLButtonElement>('[aria-label="Save Pandal"]');
        if (saveBtn) {
          const paint = () => {
            const on = saved.has(slug);
            saveBtn.style.background = on ? "#D90429" : "";
            saveBtn.style.borderColor = on ? "#D90429" : "";
            saveBtn.setAttribute("aria-pressed", String(on));
          };
          paint();
          saveBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (saved.has(slug)) saved.delete(slug);
            else saved.add(slug);
            localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]));
            paint();
            setChipState();
            if (savedOnly) applyFilters();
          });
        }

        const shareBtn = a.querySelector<HTMLButtonElement>('[aria-label="Share Pandal"]');
        if (shareBtn) {
          shareBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = location.origin + "/paras/" + slug;
            if (navigator.share) {
              navigator.share({ title: bySlug.get(slug)?.name || slug, url }).catch(() => {});
            } else {
              navigator.clipboard?.writeText(url).catch(() => {});
            }
          });
        }
      });
    };

    // ---- data ----------------------------------------------------------
    const boot = async () => {
      try {
        const res = await fetch("/paras.json");
        all = (await res.json()) as Pandal[];
      } catch {
        return;
      }
      all.forEach((p) => {
        bySlug.set(p.slug, p);
        if (p.tags.some((t) => FEATURED_TAGS.has(t))) featuredTags.add(p.slug);
      });
      // The server-rendered 24 need haystacks and saved-state too.
      cardAnchors().forEach((a) => {
        const slug = a.getAttribute("href")?.split("/").pop() || "";
        if (bySlug.has(slug) && mode === "list") slimSwap(a);
      });
      wireCards();
      setChipState();
      applyFilters();

      if (sentinel && !exhausted) {
        const io = new IntersectionObserver(
          (entries) => {
            if (entries.some((e) => e.isIntersecting)) appendBatch();
          },
          { rootMargin: "600px" }
        );
        io.observe(sentinel);
      }
    };

    // ---- static controls ----------------------------------------------
    const search = main.querySelector<HTMLInputElement>(
      'input[placeholder*="Search pandal"]'
    );
    search?.addEventListener("input", () => {
      query = search.value.toLowerCase().trim();
      applyFilters();
    });

    // The chips row holds All / zones / Featured / Saved. Strip the trailing
    // count before matching: "featured 30" used to be tested as a zone name,
    // matched nothing, and hid every card in the grid.
    main.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
      const raw = btn.innerText.trim().toLowerCase();
      const label = raw.replace(/\d+\s*$/, "").trim();
      if (!/^(all|north|south|central|east|howrah|others|featured|saved)$/.test(label)) return;
      btn.addEventListener("click", () => {
        if (label === "all") {
          zone = "all";
          savedOnly = false;
          featuredOnly = false;
        } else if (label === "saved") {
          savedOnly = true;
          featuredOnly = false;
          zone = "all";
        } else if (label === "featured") {
          featuredOnly = true;
          savedOnly = false;
          zone = "all";
        } else {
          zone = label;
          savedOnly = false;
          featuredOnly = false;
        }
        applyFilters();
      });
    });

    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      const t = b.innerText.trim();
      if (t === "Grid" || t === "List") {
        b.addEventListener("click", () => {
          mode = t === "Grid" ? "grid" : "list";
          applyMode();
          applyFilters();
        });
      }
    });

    // Suggest / Add goes to upload
    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (/suggest|add/i.test(b.innerText))
        b.addEventListener("click", () => (location.href = "/upload"));
    });

    loadBtn?.addEventListener("click", appendBatch);

    boot();
  }, [pathname]);

  return null;
}
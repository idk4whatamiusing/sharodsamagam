"use client";

import { useEffect } from "react";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useSaves } from "./useSaves";
import ui from "../data/paras-ui.json";

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

/**
 * Curated enough to be "featured". The original has no tag by that name, so
 * this maps to the award-winner tag harvested from its own cards rather than
 * inventing a ranking.
 */
const FEATURED_TAGS = new Set(["award-winner"]);

/** The floor behind the "Top Rated (★ 4.9+)" option, as the label says. */
const TOP_RATED_MIN = 4.9;

/** The sort keys behind data/paras-ui.json's option labels, in order. */
const SORT_KEYS = ["popular", "rated", "alpha"] as const;
type SortKey = (typeof SORT_KEYS)[number];

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
  img.alt = `${p.name} Durga Puja Pandal Kolkata (${zoneName} Kolkata)`;
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

export default function ParasInteractions() {
  const pathname = usePathname();
  const { saves, toggle: toggleSaved } = useSaves();
  // The listing effect wires the cards once and then keeps its own set,
  // so the account's list is mirrored into it through a ref rather than
  // by re-running the whole effect (which would re-fetch the directory).
  const savedRef = useRef<string[]>([]);
  const repaintRef = useRef<(() => void) | null>(null);
  // The listing effect wires its cards once, on mount, when the account
  // has not loaded yet. It therefore cannot close over the toggle
  // directly - it would keep the signed-out version forever - so the
  // latest one is read through a ref at click time.
  const toggleRef = useRef(toggleSaved);
  toggleRef.current = toggleSaved;
  savedRef.current = saves.pandals;

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
    const CARD_TEMPLATE = 'a.block.h-full[href^="/paras/"]';
    // Everything after this line keys off the frozen marker instead: list
    // view used to rewrite the anchors' class list, at which point the old
    // `a.block.h-full` queries could no longer see the component's own cards
    // (list mode counted 0 and filtering loaded nothing).
    const CARD = "[data-paras-card]";

    const first = main.querySelector<HTMLAnchorElement>(CARD_TEMPLATE);
    const container = first?.parentElement;
    if (!first || !container) return;

    let orderSeq = 0;
    main.querySelectorAll<HTMLAnchorElement>(CARD_TEMPLATE).forEach((a) => {
      a.setAttribute("data-paras-card", "1");
      if (!a.dataset.parasOrder) a.dataset.parasOrder = String(orderSeq++);
    });
    orderSeq = main.querySelectorAll<HTMLAnchorElement>(CARD).length;
    const template = first.cloneNode(true) as HTMLAnchorElement;

    const cardAnchors = () => Array.from(main.querySelectorAll<HTMLAnchorElement>(CARD));
    const slugOf = (a: Element) => (a.getAttribute("href") || "").split("/").pop() || "";

    const sentinel = main.querySelector<HTMLElement>("[data-paras-sentinel]");
    const countEl = main.querySelector<HTMLElement>("[data-paras-count]");
    const loadBtn = main.querySelector<HTMLButtonElement>("[data-paras-load]");

    // ---- state ----------------------------------------------------------
    let all: Pandal[] = [];
    const bySlug = new Map<string, Pandal>();
    const featuredTags = new Set<string>();
    const searchText = new Map<string, string>();
    const blindText = new Map<string, string>();
    const cardBySlug = new Map<string, HTMLAnchorElement>();
    const saved = new Set(savedRef.current);

    let query = "";
    let zone = "all";
    let savedOnly = false;
    let featuredOnly = false;
    let mode: "grid" | "list" = "grid";
    let sortIndex = 0;
    const sortKey = (): SortKey => SORT_KEYS[sortIndex] ?? "popular";

    cardAnchors().forEach((a) => cardBySlug.set(slugOf(a), a));
    // Slugs already on the page. The 24 server-rendered cards are the
    // original's own selection, which is NOT the head of paras.json (that is
    // sorted by rating), so counting cards and slicing `all` by that count
    // silently skipped 24 records and re-added 20 duplicates. Track slugs.
    const seen = new Set(cardBySlug.keys());

    /**
     * The directory's own search fields - "pandal, locality, artisan, or
     * theme". Built from the records, not from rendered cards: a match may
     * not have a card yet, and the old innerText walk only ever saw the
     * cards that happened to be loaded.
     */
    const indexText = (p: Pandal) =>
      [p.name, p.zone, p.address, p.nearestMetro, p.description, ...p.tags]
        .join(" ")
        .toLowerCase();

    /**
     * "bagbazar" has to find "Baghbazar": the original's own search returns
     * nine pandals for it, and the area is spelled both ways in the
     * harvested addresses. Dropping an h sitting between two consonants on
     * both sides of the comparison bridges the spellings without turning the
     * search into a fuzzy one.
     */
    const blind = (s: string) => s.replace(/([^aeiou\s])h(?=[^aeiou\s])/g, "$1");

    const filterActive = () =>
      query !== "" || zone !== "all" || savedOnly || featuredOnly || sortKey() === "rated";

    const matches = (p: Pandal) => {
      if (sortKey() === "rated" && !((p.rating ?? 0) >= TOP_RATED_MIN)) return false;
      if (zone !== "all" && !(p.zone || "").toLowerCase().startsWith(zone)) return false;
      if (savedOnly && !saved.has(p.slug)) return false;
      if (featuredOnly && !featuredTags.has(p.slug)) return false;
      if (query) {
        const hay = searchText.get(p.slug) ?? indexText(p);
        if (!hay.includes(query)) {
          const alt = blindText.get(p.slug) ?? blind(hay);
          if (query.length < 4 || !alt.includes(blind(query))) return false;
        }
      }
      return true;
    };

    const setCount = (shown: number, total: number) => {
      if (!countEl) return;
      countEl.textContent =
        shown === total
          ? `Showing all ${total} pandals`
          : `Showing ${shown} of ${total} pandals`;
    };

    // ---- card plumbing --------------------------------------------------
    const wireCard = (a: HTMLAnchorElement) => {
      const slug = slugOf(a);
      if (!slug || a.dataset.wired === "1") return;
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
          void (async () => {
            const result = await toggleRef.current("pandal", slug);
            if (!result.ok) return;
            if (result.saved) saved.add(slug);
            else saved.delete(slug);
            paint();
            setChipState();
            if (savedOnly) applyVisibility();
          })();
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
    };

    const buildCard = (p: Pandal, temp: boolean) => {
      // A filtered view may have materialised this pandal already (it was a
      // match while its turn in the load order had not come). Keep one card:
      // the real one replaces the filtered stand-in, so clearing the filter
      // cannot leave a duplicate behind.
      cardBySlug.get(p.slug)?.remove();
      const clone = template.cloneNode(true) as HTMLAnchorElement;
      clone.setAttribute("data-paras-card", "1");
      clone.dataset.parasOrder = String(orderSeq++);
      if (temp) clone.dataset.parasTemp = "1";
      paintCard(clone, p);
      wireCard(clone);
      container.appendChild(clone);
      cardBySlug.set(p.slug, clone);
      return clone;
    };

    // ---- list / grid ----------------------------------------------------
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

    // The mode toggle's two looks are both in the scraped markup already: the
    // Grid button shipped pressed (it is the server-rendered default) and the
    // List button unpressed. Snapshot the pair and swap class strings -
    // painting inline styles underneath left the pressed look's own
    // `bg-[#D90429]` class on the Grid button, so Grid stayed red in list
    // view while List lit up beside it.
    const viewButtons = Array.from(
      main.querySelectorAll<HTMLButtonElement>(
        'button[aria-label="Grid View"], button[aria-label="List View"]'
      )
    );
    const gridBtn = viewButtons.find((b) => b.getAttribute("aria-label") === "Grid View") ?? null;
    const listBtn = viewButtons.find((b) => b.getAttribute("aria-label") === "List View") ?? null;
    const lit = (b: HTMLButtonElement | null) =>
      !!b && /(^|\s)bg-\[#D90429\](\s|$)/.test(b.className);
    const litBtn = lit(gridBtn) ? gridBtn : lit(listBtn) ? listBtn : gridBtn;
    const dimBtn = litBtn === gridBtn ? listBtn : gridBtn;
    const VIEW_ON = litBtn?.className ?? "";
    const VIEW_OFF = dimBtn?.className ?? "";

    const applyMode = () => {
      container.className =
        mode === "list"
          ? "flex flex-col gap-2"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5";
      cardAnchors().forEach((a) => {
        const p = bySlug.get(slugOf(a));
        if (mode === "list") {
          if (!a.dataset.orig) a.dataset.orig = a.innerHTML;
          if (p) a.innerHTML = slimRow(p);
        } else if (a.dataset.orig) {
          // Restore the grid body and re-wire it: the swap replaced the
          // save/share buttons, so the old listeners would be gone with the
          // old nodes.
          a.innerHTML = a.dataset.orig;
          delete a.dataset.wired;
          wireCard(a);
        }
      });
      if (VIEW_ON && VIEW_OFF) {
        for (const b of viewButtons) {
          b.className = (b === gridBtn) === (mode === "grid") ? VIEW_ON : VIEW_OFF;
          // Inline styles an earlier build left on the buttons would outrank
          // the class swap.
          b.style.background = "";
          b.style.color = "";
          b.style.borderColor = "";
        }
      }
    };

    // ---- ordering -------------------------------------------------------
    const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

    const applyOrder = () => {
      const cards = cardAnchors();
      if (cards.length < 2) return;
      const key = sortKey();
      if (key === "popular") {
        cards.sort(
          (a, b) => Number(a.dataset.parasOrder || 0) - Number(b.dataset.parasOrder || 0)
        );
      } else {
        // The original's Top Rated order is rating descending with ties
        // alphabetical; Alphabetical is name order with numbers read as
        // numbers ("7 Tanks" ahead of "22 Palli", which a plain string
        // compare would invert).
        cards.sort((a, b) => {
          const pa = bySlug.get(slugOf(a));
          const pb = bySlug.get(slugOf(b));
          if (!pa || !pb) return 0;
          if (key === "rated") {
            const byRating = (pb.rating ?? 0) - (pa.rating ?? 0);
            if (byRating) return byRating;
          }
          return collator.compare(pa.name, pb.name);
        });
      }
      const frag = document.createDocumentFragment();
      cards.forEach((a) => frag.appendChild(a));
      container.appendChild(frag);
    };

    // ---- visibility -----------------------------------------------------
    const applyVisibility = () => {
      // Before /paras.json lands there is nothing to judge the cards by; the
      // server-rendered state stands until boot re-runs this.
      if (!all.length) return;
      const total = all.length;
      if (!filterActive()) {
        // Nothing filtered: the list is simply what has loaded, in the
        // directory's own order.
        main.querySelectorAll<HTMLAnchorElement>("[data-paras-temp]").forEach((a) => {
          cardBySlug.delete(slugOf(a));
          a.remove();
        });
        cardAnchors().forEach((a) => {
          a.style.display = "";
        });
        applyOrder();
        setCount(cardAnchors().length, total);
        return;
      }

      const wanted = all.filter(matches);
      const wantedSlugs = new Set(wanted.map((p) => p.slug));
      let failed = 0;
      wanted.forEach((p) => {
        if (cardBySlug.has(p.slug)) return;
        try {
          buildCard(p, true);
        } catch {
          // One bad record must not take the view down, but it must not be
          // silent either.
          failed++;
        }
      });
      if (failed) console.warn("[paras] could not render", failed, "filtered cards");

      cardAnchors().forEach((a) => {
        a.style.display = wantedSlugs.has(slugOf(a)) ? "" : "none";
      });
      applyOrder();
      setCount(wanted.length, total);
    };

    // ---- progressive loading -------------------------------------------
    let cursor = 0;
    let exhausted = false;
    let loading = false;

    const finishLoading = () => {
      if (sentinel) sentinel.style.display = "none";
      if (loadBtn) loadBtn.style.display = "none";
    };

    const appendBatch = () => {
      if (exhausted || loading || !all.length) return;
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

      const failed: string[] = [];
      next.forEach((p) => {
        try {
          buildCard(p, false);
        } catch {
          failed.push(p.slug);
          seen.delete(p.slug);
        }
      });
      if (failed.length) {
        console.warn("[paras] could not render", failed.length, "cards:", failed.slice(0, 5));
      }

      applyMode(); // a batch arriving in list view needs slimming
      applyVisibility(); // and a batch arriving under a filter must be judged
      setChipState();
      loading = false;
      if (cursor >= all.length) {
        exhausted = true;
        finishLoading();
      }
    };

    // ---- chips ----------------------------------------------------------
    type ChipKind = "all" | "zone" | "featured" | "saved";
    type Chip = { btn: HTMLButtonElement; kind: ChipKind; value: string };

    const chips: Chip[] = [];
    main.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
      const raw = btn.innerText.trim().toLowerCase();
      const label = raw.replace(/\d+\s*$/, "").trim();
      if (label === "featured" || label === "saved") {
        chips.push({ btn, kind: label, value: label });
      } else if (label === "all") {
        chips.push({ btn, kind: "all", value: "all" });
      } else if (/^(north|south|central|east|howrah|others)$/.test(label)) {
        chips.push({ btn, kind: "zone", value: label });
      }
    });
    let activeChip: Chip | null = chips.find((c) => c.kind === "all") ?? null;

    const CHIP_OFF = "background-color:#FFFFFF;color:#2C1210;border-color:#EAD5A0";

    /**
     * The chips can look pressed on their own: zone chips carry inline
     * colours, Featured/Saved carry class strings. The pressed looks are the
     * original's own (captured into data/paras-ui.json by
     * scripts/harvest-paras-ui.mjs): a zone lights up in its own dot colour,
     * All in ink, Featured in its rose gradient and Saved in solid red.
     */
    const paintChips = () => {
      chips.forEach((chip) => {
        const on = chip === activeChip;
        if (chip.kind === "featured" || chip.kind === "saved") {
          const state = chip.kind === "featured" ? ui.chips.featuredActive : ui.chips.savedActive;
          const plain =
            chip.kind === "featured" ? ui.chips.featuredInactive : ui.chips.savedInactive;
          chip.btn.className = on ? state.cls : plain.cls;
          const svg = chip.btn.querySelector("svg");
          if (svg) svg.setAttribute("class", on ? state.svg : plain.svg);
        } else {
          const dot = chip.btn.querySelector<HTMLElement>("span");
          // The dot's colour lives in the scraped markup as a hex literal;
          // reading it back through CSSOM would round-trip it as rgb(...).
          const colour =
            chip.kind === "all"
              ? "#2C1210"
              : (dot?.getAttribute("style") || "").match(/#[0-9a-f]{3,8}/i)?.[0] ||
                dot?.style.backgroundColor ||
                "#2C1210";
          chip.btn.setAttribute(
            "style",
            on
              ? `background-color:${colour};color:#FFFFFF;border-color:${colour}`
              : CHIP_OFF
          );
        }
      });
    };

    chips.forEach((chip) => {
      chip.btn.addEventListener("click", () => {
        activeChip = chip;
        if (chip.kind === "all") {
          zone = "all";
          savedOnly = false;
          featuredOnly = false;
        } else if (chip.kind === "saved") {
          savedOnly = true;
          featuredOnly = false;
          zone = "all";
        } else if (chip.kind === "featured") {
          featuredOnly = true;
          savedOnly = false;
          zone = "all";
        } else {
          zone = chip.value;
          savedOnly = false;
          featuredOnly = false;
        }
        paintChips();
        applyVisibility();
      });
    });

    const setChipState = () => {
      main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
        const t = b.innerText.trim().toLowerCase();
        const badge = b.querySelector("span:last-child");
        if (t.startsWith("featured") && badge) badge.textContent = String(featuredTags.size);
        if (t.startsWith("saved") && badge) badge.textContent = String(saved.size);
      });
    };

    // ---- sort dropdown --------------------------------------------------
    // The mirror kept the original's button (label "Popular") but not the
    // listbox, which only exists while it is open. The option labels and
    // class strings come from the original too (data/paras-ui.json).
    const sortBtn = main.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
    const sortLabel = sortBtn?.querySelector<HTMLElement>("div span") ?? null;
    const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 256 256" class="text-[#D90429] shrink-0"><path d="${ui.sort.checkSvgPath}"></path></svg>`;

    let sortBox: HTMLElement | null = null;

    const renderSort = () => {
      if (sortLabel) sortLabel.textContent = ui.sort.options[sortIndex] ?? ui.sort.options[0];
      if (!sortBox) return;
      sortBox.innerHTML = ui.sort.options
        .map(
          (label, i) =>
            `<button type="button" role="option" aria-selected="${i === sortIndex}" class="${
              i === sortIndex ? ui.sort.optionActiveClass : ui.sort.optionClass
            }"><span>${label}</span>${i === sortIndex ? CHECK_SVG : ""}</button>`
        )
        .join("");
    };

    const setSortOpen = (open: boolean) => {
      if (!sortBtn || !sortBox) return;
      sortBox.style.display = open ? "" : "none";
      sortBtn.setAttribute("aria-expanded", String(open));
      const chevron = sortBtn.querySelector<SVGElement>("svg:last-of-type");
      if (chevron) chevron.style.transform = open ? "rotate(180deg)" : "";
    };

    if (sortBtn) {
      sortBox = document.createElement("div");
      sortBox.setAttribute("role", "listbox");
      sortBox.className = ui.sort.listboxClass;
      sortBox.style.display = "none";
      sortBtn.parentElement?.appendChild(sortBox);
      renderSort();

      sortBtn.addEventListener("click", () => setSortOpen(sortBox!.style.display === "none"));
      sortBox.addEventListener("click", (e) => {
        const opt = (e.target as HTMLElement | null)?.closest('[role="option"]');
        if (!opt || !sortBox) return;
        const i = Array.from(sortBox.querySelectorAll('[role="option"]')).indexOf(opt as Element);
        if (i < 0 || i === sortIndex) {
          setSortOpen(false);
          return;
        }
        sortIndex = i;
        renderSort();
        setSortOpen(false);
        applyVisibility();
      });
    }

    const onSortOutside = (e: MouseEvent) => {
      if (!sortBox || sortBox.style.display === "none") return;
      const t = e.target as Node | null;
      if (t && (sortBox.contains(t) || sortBtn?.contains(t))) return;
      setSortOpen(false);
    };
    const onSortEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortOpen(false);
    };
    document.addEventListener("click", onSortOutside);
    document.addEventListener("keydown", onSortEscape);

    // ---- static controls ------------------------------------------------
    const search = main.querySelector<HTMLInputElement>(
      'input[placeholder*="Search pandal"]'
    );
    search?.addEventListener("input", () => {
      query = search.value.toLowerCase().trim();
      applyVisibility();
    });

    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      const t = b.innerText.trim();
      if (t === "Grid" || t === "List") {
        b.addEventListener("click", () => {
          mode = t === "Grid" ? "grid" : "list";
          applyMode();
          applyVisibility();
        });
      }
    });

    // Suggest / Add goes to upload
    main.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (/suggest|add/i.test(b.innerText))
        b.addEventListener("click", () => (location.href = "/upload"));
    });

    loadBtn?.addEventListener("click", appendBatch);

    // ---- data -----------------------------------------------------------
    // The server-rendered cards exist before the directory JSON arrives, so
    // they are wired straight away - a visitor who clicks Save in that
    // window must not find a dead button.
    cardAnchors().forEach(wireCard);

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
        const text = indexText(p);
        searchText.set(p.slug, text);
        blindText.set(p.slug, blind(text));
      });

      // The server-rendered 24 need their saved-state and their list-view
      // rendering too.
      cardAnchors().forEach(wireCard);
      setChipState();
      paintChips();
      applyMode();
      applyVisibility();

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

    // Keep the listing in step with the account: a save made on another
    // device (or in the map) repaints the cards and the Saved badge.
    repaintRef.current = () => {
      saved.clear();
      for (const slug of savedRef.current) saved.add(slug);
      main.querySelectorAll<HTMLAnchorElement>(CARD).forEach((a) => {
        const btn = a.querySelector<HTMLButtonElement>('[aria-label="Save Pandal"]');
        if (!btn) return;
        const on = saved.has(slugOf(a));
        btn.style.background = on ? "#D90429" : "";
        btn.style.borderColor = on ? "#D90429" : "";
        btn.setAttribute("aria-pressed", String(on));
      });
      setChipState();
      if (savedOnly) applyVisibility();
    };

    boot();

    return () => {
      repaintRef.current = null;
      document.removeEventListener("click", onSortOutside);
      document.removeEventListener("keydown", onSortEscape);
    };
  }, [pathname]);

  useEffect(() => {
    repaintRef.current?.();
  }, [saves.pandals]);

  return null;
}

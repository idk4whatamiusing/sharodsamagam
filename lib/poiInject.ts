import pois from "../data/pois.json";

/**
 * Build-time rewrite for the Points of Interest directory.
 *
 * The original renders 119 places into the HTML and then, on mount, fetches
 * /api/pois and swaps in the full 273 - so a scrape keeps the 119 cards, a
 * search box with nothing behind it, and category chips that lead nowhere.
 * data/pois.json holds the live list, the chips' own pressed/unpressed
 * classes, the "No Facilities Found" empty state, and one card template per
 * category (tokenised from the live DOM by scripts/harvest-pois.mjs, with a
 * text-for-text re-render check over all 273 cards).
 *
 * This rebuilds the grid from those templates, marks the search box, the
 * chips, the grid and each card for components/PoiSearch.tsx, and appends the
 * empty state (hidden) below the grid, which is where the original keeps it.
 */

const SEARCH_INPUT =
  '<input type="text" placeholder="Search POI by station name, hospital, police booth, or locality..."';

const CHIP_ROW =
  '<div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none justify-start -mx-1 px-1">';

const GRID =
  '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pt-0.5">';

const OLD_ALL_LABEL = "<span>All (119)</span>";

type Place = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  openHours: string;
  phone?: string;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");

/** Index just past the </div> that closes the <div ...> opened at `from`. */
function closeOfDiv(html: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < html.length) {
    const open = html.indexOf("<div", i);
    const close = html.indexOf("</div>", i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth += 1;
      i = open + 4;
    } else {
      depth -= 1;
      i = close + 6;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function renderCard(p: Place): string {
  const t = pois.templates[p.category as keyof typeof pois.templates];
  if (!t) return "";
  const tpl = (p.phone && t.withPhone) || t.noPhone;
  if (!tpl) return "";
  const html = tpl
    .split("{{name}}")
    .join(esc(p.name))
    .split("{{address}}")
    .join(esc(p.address))
    .split("{{phone}}")
    .join(esc(p.phone ?? ""))
    .split("{{lat}}")
    .join(String(p.lat))
    .split("{{lng}}")
    .join(String(p.lng))
    .split("{{hours}}")
    .join(esc(p.openHours));
  // The search matches name and address only, as the original's filter does.
  const key = escAttr(`${p.name} ${p.address}`.toLowerCase());
  return html.replace(
    "<div ",
    `<div data-poi-card data-poi-cat="${p.category}" data-poi-key="${key}" `
  );
}

export function injectPoiDirectory(html: string): string {
  if (!html.includes(GRID)) return html;
  let out = html;

  if (out.includes(SEARCH_INPUT)) {
    out = out.replace(SEARCH_INPUT, SEARCH_INPUT.replace("<input ", "<input data-poi-search "));
  }

  if (out.includes(CHIP_ROW)) {
    const labelToId = new Map(pois.categories.map((c) => [c.label, c.id]));
    out = out.replace(
      CHIP_ROW,
      CHIP_ROW.replace(
        "<div ",
        `<div data-poi-chips data-active-class="${escAttr(pois.chipClasses.active)}" data-inactive-class="${escAttr(pois.chipClasses.inactive)}" `
      )
    );
    out = out.replace(OLD_ALL_LABEL, `<span>All (${pois.pois.length})</span>`);
    // Chips lead with an icon - an <img> on category chips, an inline <svg> on
    // the "All" chip - before their label span. (cheerio, which mirrorHtml
    // runs the page through, serialises void elements without a slash, so no
    // self-closing form appears here.)
    out = out.replace(
      /<button class="([^"]*)">((?:<img[^>]*>|<svg[\s\S]*?<\/svg>)?)<span>([^<]+)<\/span><\/button>/g,
      (m, cls: string, lead: string, label: string) => {
        const id = label.startsWith("All (") ? "all" : labelToId.get(label);
        if (!id) return m;
        return `<button data-poi-cat="${id}" class="${cls}">${lead}<span>${label}</span></button>`;
      }
    );
  }

  // Rebuild the grid from the harvest's templates: the server-rendered 119
  // places are all in the live list too, so replacing the whole grid keeps
  // one ordering - the API's own - rather than merging two.
  const gridAt = out.indexOf(GRID);
  const gridEnd = closeOfDiv(out, gridAt);
  if (gridAt === -1 || gridEnd === -1) return out;

  const gridTagged = GRID.replace("<div ", "<div data-poi-grid ");
  const cards = (pois.pois as Place[]).map(renderCard).filter(Boolean).join("");
  out = out.slice(0, gridAt) + gridTagged + cards + out.slice(gridEnd - 6);

  // The empty state sits right after the grid, hidden until a filter matches
  // nothing.
  const empty = pois.emptyState
    .replace("<div ", "<div hidden data-poi-empty ")
    .replace("<button class=", "<button data-poi-reset class=");
  const taggedEnd = closeOfDiv(out, out.indexOf(gridTagged));
  if (taggedEnd !== -1) {
    out = out.slice(0, taggedEnd) + empty + out.slice(taggedEnd);
  }

  return out;
}

/**
 * Build-time rewrites for mirror/guide.html's topic tabs.
 *
 * The guide index shows one topic at a time behind five pills ("Getting
 * Around & Metro", "Where to Stay", ...). The static scrape kept the pill row
 * and whichever panel the original server-rendered - the first one - while
 * the other four live in its client component, so the pills shipped as dead
 * buttons with nothing to reveal. data/guide-tabs.json holds all four panels,
 * captured by clicking each pill in a real browser (scripts/
 * harvest-guide-tabs.mjs), plus the original's own pressed/unpressed pill
 * classes.
 *
 * The first tab is deliberately not harvested: our mirror's copy of it is the
 * one lib/metroInject.ts rewrites to hold the transit map. The harvested
 * panels are grafted in after the row, hidden, and components/GuideTabs.tsx
 * shows one at a time.
 */

import data from "../data/guide-tabs.json";

/** The scraped tab row; matched exactly, and only once. */
const ROW_OPEN =
  '<div class="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none justify-start sm:justify-center -mx-4 px-4 sm:mx-0 sm:px-0">';

/** The panel the row switches between; also matched once, right after the row. */
const CONTENT_OPEN = '<div class="space-y-4 sm:space-y-6 animate-fadeIn">';

/** Attribute-value escaping, as the markup has it. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

export function injectGuideTabs(html: string): string {
  const rowAt = html.indexOf(ROW_OPEN);
  if (rowAt === -1) return html;
  const contentAt = html.indexOf(CONTENT_OPEN, rowAt);
  if (contentAt === -1) return html;

  const labels = [data.firstTab, ...data.panels.map((p) => p.label)];

  // Tag the five pills, each by its own label, within the row only - the
  // labels also appear in the panels' prose.
  let region = html.slice(rowAt, contentAt);
  region = region.replace(ROW_OPEN, ROW_OPEN.replace("<div ", "<div data-guide-tabs "));
  for (const label of labels) {
    const text = `<span>${esc(label)}</span>`;
    const at = region.indexOf(text);
    if (at === -1) continue;
    const btn = region.lastIndexOf("<button", at);
    if (btn === -1) continue;
    region =
      region.slice(0, btn + "<button".length) +
      ` data-guide-tab="${esc(label)}"` +
      region.slice(btn + "<button".length);
  }

  // Tag the server-rendered panel with its own label, and graft the four
  // harvested panels in as hidden siblings just before it.
  const taggedContent = CONTENT_OPEN.replace(
    "<div ",
    `<div data-guide-panel="${esc(data.firstTab)}" `
  );
  const hidden = data.panels
    .map(
      (p) =>
        `<div data-guide-panel="${esc(p.label)}" style="display:none" class="${esc(p.cls)}">${p.html}</div>`
    )
    .join("");
  const tail = html.slice(contentAt).replace(CONTENT_OPEN, taggedContent);

  return html.slice(0, rowAt) + region + hidden + tail;
}

/**
 * Build-time rewrites for the About page's "Ritual Journey" day tabs.
 *
 * The section shows one day at a time behind six tabs. Only the day that
 * happened to match the original's render date is in the server HTML - the
 * other five live in its client component - so a static scrape kept a row of
 * dead buttons, the same class of gap as the home day strip and the hero
 * dots. data/about-days.json holds all six panels, captured by clicking each
 * tab in a real browser (scripts/harvest-about-days.mjs), together with the
 * original's own active/inactive button classes.
 *
 * This tags the tab row, its six buttons and the panel wrapper; components/
 * AboutJourney.tsx does the swapping.
 */

const ROW_OPEN =
  '<div class="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none justify-start sm:justify-center -mx-2 px-2 sm:mx-0 sm:px-0">';

const PANEL_OPEN =
  '<div class="rounded-xl sm:rounded-2xl p-[1px] bg-gradient-to-b from-[#E5C880] via-[#D97706]/30 to-[#2C1210]/20 shadow-sm overflow-hidden">';

const DAYS = ["Mahalaya", "Maha Shasthi", "Maha Saptami", "Maha Ashtami", "Maha Navami", "Bijoya Dashami"];

export function injectAboutJourney(html: string): string {
  if (!html.includes(ROW_OPEN)) return html;
  let out = html.replace(ROW_OPEN, ROW_OPEN.replace("<div ", "<div data-about-tabs "));

  out = out.replace(
    /<button type="button" class="([^"]*)">(Mahalaya|Maha Shasthi|Maha Saptami|Maha Ashtami|Maha Navami|Bijoya Dashami)<\/button>/g,
    (m, cls: string, day: string) =>
      DAYS.includes(day)
        ? `<button type="button" data-about-day="${day}" class="${cls}">${day}</button>`
        : m
  );

  if (out.includes(PANEL_OPEN)) {
    out = out.replace(PANEL_OPEN, PANEL_OPEN.replace("<div ", "<div data-about-panel "));
  }

  return out;
}

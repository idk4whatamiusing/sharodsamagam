/**
 * Build-time rewrites for the About page's "Four Sacred Pillars" tabs.
 */

const GRID_OPEN = '<div class="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2.5">';
const PANEL_OPEN =
  '<div class="rounded-xl sm:rounded-2xl p-[1px] bg-gradient-to-b from-[#E5C880] via-[#D97706]/30 to-[#2C1210]/20 shadow-md overflow-hidden">';

export function injectAboutPillars(html: string): string {
  const marker = "The Four Sacred Pillars";
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return html;

  let out = html;
  const gridIndex = out.indexOf(GRID_OPEN, markerIndex);
  if (gridIndex !== -1) {
    out = out.slice(0, gridIndex) + GRID_OPEN.replace("<div ", "<div data-pillar-tabs ") + out.slice(gridIndex + GRID_OPEN.length);
  }

  out = out.replace(
    /<button type="button" class="([^"]*)">([\s\S]*?Pillar 0[1-4][\s\S]*?)<\/button>/g,
    (m, cls: string, inner: string) => {
      const label = inner.match(/Pillar 0[1-4]/)?.[0];
      return label ? `<button type="button" data-pillar="${label}" class="${cls}">${inner}</button>` : m;
    }
  );

  const panelIndex = out.indexOf(PANEL_OPEN, gridIndex === -1 ? markerIndex : gridIndex);
  if (panelIndex !== -1) {
    out = out.slice(0, panelIndex) + PANEL_OPEN.replace("<div ", "<div data-pillar-panel ") + out.slice(panelIndex + PANEL_OPEN.length);
  }

  return out;
}

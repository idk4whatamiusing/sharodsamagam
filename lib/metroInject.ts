/**
 * Build-time rewrite for the guide's transit map placeholder.
 *
 * /guide and /guide/navigating-kolkata both advertise an "Interactive Metro &
 * Railway Map" (58 stations, 5 lines) under that heading, and both ship the
 * loading fallback instead of a map: the metro emoji, "Loading Kolkata
 * Transit & Metro GIS Network..." and "Initializing 58 stations across 5
 * operational metro lines", in a container still marked `animate-pulse`.
 *
 * Same cause as the hero card and the pandal list: the original builds the map
 * client-side, so a static scrape kept the skeleton. The coordinates are in
 * data/metro.json, harvested from the original by scripts/harvest-metro.mjs.
 *
 * The replacement keeps the container's outer box (height, border, radius) so
 * the page below it does not shift.
 */

/** Unique opener of the placeholder. Matched once per guide page. */
const SKELETON_OPEN =
  '<div class="w-full h-[520px] bg-[#FFFDF5] border-2 border-[#E5C880] rounded-3xl p-6 flex flex-col items-center justify-center text-center animate-pulse">';

/** Unique tail: the last line of copy, then the container's own close. */
const SKELETON_TAIL =
  "Initializing 58 stations across 5 operational metro lines</p></div>";

export function injectMetroMap(html: string): string {
  const start = html.indexOf(SKELETON_OPEN);
  if (start === -1) return html;

  const tailAt = html.indexOf(SKELETON_TAIL, start);
  if (tailAt === -1) return html;
  const end = tailAt + SKELETON_TAIL.length;

  const slot =
    '<div data-metro-map class="w-full h-[520px] bg-[#FFFDF5] border-2 border-[#E5C880] rounded-3xl overflow-hidden"></div>';

  return html.slice(0, start) + slot + html.slice(end);
}
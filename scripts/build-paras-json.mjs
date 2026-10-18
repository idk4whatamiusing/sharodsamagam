/**
 * Builds public/paras.json - the dataset the /paras directory loads from.
 *
 * The directory used to ship 24 cards and a dead "Loading more pandals..."
 * sentinel. The other 752 were never rendered, because the original reveals
 * them on scroll and a static scrape captures only the first page.
 *
 * This joins three sources into one card-ready record:
 *   data/pandals.json    - names, zones, addresses, ratings, descriptions
 *   data/paras-tags.json - tag chips harvested from the original
 *
 * A separate file from public/points.json on purpose: points.json is a
 * contract shared with the map injector and the list-view renderer, and
 * widening it for one caller would put the others at risk.
 *
 * Usage: node scripts/build-paras-json.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const read = (p) => JSON.parse(readFileSync(path.join(process.cwd(), p), "utf8"));

/** Zone colours and accent strips, copied from the cards in mirror/paras.html. */
const ZONE = {
  north: { color: "#4F46E5", grad: "#4F46E5, #818CF8, #C7D2FE" },
  south: { color: "#D90429", grad: "#D90429, #FFB800, #D97706" },
  east: { color: "#059669", grad: "#059669, #34D399, #6EE7B7" },
  howrah: { color: "#0891B2", grad: "#0891B2, #22D3EE, #A5F3FC" },
  central: { color: "#D97706", grad: "#D97706, #FBBF24, #FDE68A" },
  others: { color: "#475569", grad: "#475569, #64748B, #94A3B8" },
};

/**
 * Every card uses the same still. The only real photos in the dataset are
 * presigned R2 links with a seven-day expiry that lapsed on 10 Oct, and the
 * original's own captured cards all point at this file, so matching it is
 * both accurate and consistent.
 */
const IMAGE = "/pandals/maddox_square.jpg";

const pandals = read("data/pandals.json");
const { tags } = read("data/paras-tags.json");

const out = pandals
  .map((p) => {
    const z = ZONE[p.zone] ?? ZONE.others;
    return {
      slug: p.slug,
      name: p.name,
      zone: p.zone || "others",
      color: z.color,
      grad: z.grad,
      image: IMAGE,
      established: p.established ?? null,
      rating: p.rating ?? null,
      reviewCount: p.reviewCount ?? 0,
      address: p.address || "",
      nearestMetro: p.nearestMetro || "",
      description: p.description || "",
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      tags: tags[p.slug] || [],
    };
  })
  // Best-rated first, then most-reviewed, then alphabetical. The directory's
  // own "Popular" control implies exactly this ordering.
  .sort(
    (a, b) =>
      (b.rating ?? 0) - (a.rating ?? 0) ||
      b.reviewCount - a.reviewCount ||
      a.name.localeCompare(b.name)
  );

writeFileSync(
  path.join(process.cwd(), "public", "paras.json"),
  JSON.stringify(out) + "\n"
);

const withTags = out.filter((p) => p.tags.length).length;
const size = Buffer.byteLength(JSON.stringify(out));
console.log(`pandals:        ${out.length}`);
console.log(`with tags:      ${withTags}`);
console.log(`without tags:   ${out.length - withTags}`);
console.log(`bytes:          ${(size / 1024).toFixed(0)} KB`);
console.log(`gzipped approx: ~${(size / 1024 / 4).toFixed(0)} KB`);
console.log("wrote public/paras.json");
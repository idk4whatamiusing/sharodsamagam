const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const RAW = '/Users/x/pujo/data/raw';
const out = [];

const dir = path.join(RAW, 'paras');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const $ = cheerio.load(html);
  const slug = f.replace(/\.html$/, '');
  const lds = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      if (Array.isArray(parsed)) lds.push(...parsed); else lds.push(parsed);
    } catch {}
  });
  const place = lds.find(x => x['@type'] === 'TouristAttraction') || {};
  const fest = lds.find(x => x['@type'] === 'Festival') || {};

  // zone / est / metro from breadcrumb-ish header area
  const headText = $('main').text().replace(/\s+/g, ' ');
  const zoneM = headText.match(/\b(north|south|central|east|west|howrah|others) Kolkata\b/i);
  const zone = zoneM ? zoneM[1].toLowerCase() : null;
  const estM = headText.match(/Est\.\s*(\d{4})/);
  const est = estM ? +estM[1] : null;

  // tags: look at page for tag-like small pills after description - grab from ld? fallback: empty
  const rating = place.aggregateRating || {};
  const addr = place.address || {};
  const geo = place.geo || {};

  out.push({
    slug,
    name: (place.name || $('h1').first().text() || '').trim(),
    description: place.description || '',
    zone,
    established: est,
    rating: rating.ratingValue ?? null,
    reviewCount: rating.reviewCount ?? null,
    address: addr.streetAddress || '',
    locality: addr.addressLocality || 'Kolkata',
    lat: geo.latitude ?? null,
    lng: geo.longitude ?? null,
    festivalStart: fest.startDate || null,
    festivalEnd: fest.endDate || null,
    image: place.image || '',
  });
}

fs.writeFileSync('/Users/x/pujo/data/pandals.json', JSON.stringify(out, null, 1));
console.log('pandals:', out.length);
console.log('sample:', JSON.stringify(out[0], null, 1));
console.log('missing zone:', out.filter(p => !p.zone).length);
console.log('missing rating:', out.filter(p => p.rating == null).length);

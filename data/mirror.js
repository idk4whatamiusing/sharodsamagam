const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const RAW = '/Users/x/pujo/data/raw';
const OUT = '/Users/x/pujo/web/mirror';
fs.mkdirSync(OUT, { recursive: true });

function walk(dir) {
  let res = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) res = res.concat(walk(p));
    else if (e.name.endsWith('.html')) res.push(p);
  }
  return res;
}

const files = walk(RAW);
let ok = 0, fail = 0;
for (const file of files) {
  const rel = path.relative(RAW, file).replace(/\.html$/, '');
  const html = fs.readFileSync(file, 'utf8');
  const $ = cheerio.load(html);
  $('script').remove();
  $('link').remove();
  // remove expired signed R2 images -> placeholder
  $('img').each((i, el) => {
    const src = $(el).attr('src') || '';
    if (src.includes('X-Amz-Signature') || src.startsWith('https://durgapujakolkata.')) {
      $(el).attr('src', '/pandals/maddox_square.jpg');
      $(el).removeAttr('srcset');
    }
  });
  const body = $('body').html() || '';
  const outPath = path.join(OUT, rel.replace(/\/index$/, '') === '' ? '' : rel) + '.html';
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel + '.html'), body);
  ok++;
}
console.log('mirrored', ok, 'failed', fail);

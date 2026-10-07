import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { get } from 'https';
import { dirname } from 'path';

const BBOX = { north: 22.73, south: 22.44, west: 88.22, east: 88.53 };
const ZOOM_MIN = 12;
const ZOOM_MAX = 16;
const OUT = '/Users/x/pujo/public/tiles';

const n = (z) => Math.pow(2, z);
const lat2tile = (lat, z) => Math.floor((1 - Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2 * n(z));
const lng2tile = (lng, z) => Math.floor((lng+180)/360 * n(z));

const download = async (z,x,y) => {
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const dest = `${OUT}/${z}/${x}/${y}.png`;
  if (existsSync(dest)) return;
  mkdirSync(dirname(dest), { recursive: true });
  return new Promise((resolve) => {
    get(url, { headers: { 'User-Agent': 'sharodsamagam-offline-maps/1.0' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); resolve(); return; }
      res.pipe(createWriteStream(dest)).on('finish', resolve);
    }).on('error', resolve);
  });
};

const jobs = [];
for (let z=ZOOM_MIN; z<=ZOOM_MAX; z++) {
  const x0=lng2tile(BBOX.west,z), x1=lng2tile(BBOX.east,z);
  const y0=lat2tile(BBOX.north,z), y1=lat2tile(BBOX.south,z);
  for (let x=x0; x<=x1; x++) for (let y=y0; y<=y1; y++) jobs.push([z,x,y]);
}
console.log('tiles:', jobs.length);
let idx=0; 
async function worker() {
  while (idx < jobs.length) {
    const [z,x,y] = jobs[idx++];
    await download(z,x,y);
  }
}
await Promise.all(Array.from({length:8}, ()=>worker()));
console.log('done');

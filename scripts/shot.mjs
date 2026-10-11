import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto(process.argv[2], { waitUntil: "networkidle", timeout: 60000 });
await p.waitForTimeout(3500);
await p.screenshot({ path: process.argv[3] });
await b.close();

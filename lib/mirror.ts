import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const MIRROR = path.join(process.cwd(), "mirror");

export function mirrorHtml(rel: string): string | null {
  // rel like "paras" or "paras/some-slug" or "index"
  const file = path.join(MIRROR, rel + ".html");
  let target = file;
  if (!fs.existsSync(target)) {
    const idx = path.join(MIRROR, rel, "index.html");
    if (fs.existsSync(idx)) target = idx;
    else return null;
  }
  const raw = fs.readFileSync(target, "utf8");
  const $ = cheerio.load(`<div id="__root">${raw}</div>`);
  $("#__root > header, #__root > footer, #__root > nav").remove();
  const main = $("#__root main");
  if (main.length) return main.prop("outerHTML");
  return $("#__root").html();
}

export function listRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html") && !e.name.startsWith("_")) {
        out.push(path.relative(MIRROR, p).replace(/\.html$/, ""));
      }
    }
  };
  walk(MIRROR);
  return out;
}

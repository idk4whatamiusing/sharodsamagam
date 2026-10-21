import { chromium } from "playwright";
const B="http://127.0.0.1:4173";
const b=await chromium.launch();
for (const vp of [{width:1440,height:1000},{width:390,height:844}]) {
  console.log("=== viewport", vp.width, "===");
  for (const path of ["/","/about-us/","/paras/","/gallery/","/panzika/","/chronicles/","/events/","/upload/","/guide/","/connect/","/announcements/","/copyright/","/points-of-interest/","/procession/","/guide/emergency/"]) {
    const p=await b.newPage({viewport:vp});
    try {
      await p.goto(B+path,{waitUntil:"domcontentloaded",timeout:20000});
      await p.waitForTimeout(500);
      const r=await p.evaluate(()=>{
        const head=[...document.querySelectorAll("header")].find(h=>getComputedStyle(h).display!=="none"&&h.getBoundingClientRect().height>0);
        if(!head) return null;
        const hb=head.getBoundingClientRect();
        // find elements whose visible text overlaps the header band
        const hits=[];
        for(const el of document.querySelectorAll("main *")){
          if(el.children.length) continue;
          const t=(el.textContent||"").trim();
          if(!t) continue;
          const r=el.getBoundingClientRect();
          if(r.width<=0||r.height<=0) continue;
          if(r.top < hb.bottom-2 && r.bottom > hb.top+2 && r.left < hb.right-2 && r.right > hb.left+2){
            hits.push({t:t.slice(0,32), top:Math.round(r.top), bottom:Math.round(r.bottom)});
          }
        }
        return {headBottom:Math.round(hb.bottom), hits:hits.slice(0,4), n:hits.length};
      });
      console.log(path.padEnd(22), JSON.stringify(r));
    } catch(e){ console.log(path, "ERR", e.message.slice(0,50)); }
    await p.close();
  }
}
await b.close();

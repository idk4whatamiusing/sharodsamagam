import { chromium } from "playwright";
const B="http://127.0.0.1:4173";
const b=await chromium.launch();
for (const vp of [{width:1440,height:1000},{width:390,height:844}]) {
  console.log("=== viewport", vp.width, "===");
  for (const path of ["/","/about-us/","/paras/","/map/","/routes/","/gallery/","/panzika/","/guide/","/chronicles/","/events/","/profile/","/upload/"]) {
    const p=await b.newPage({viewport:vp});
    try {
      await p.goto(B+path,{waitUntil:"domcontentloaded",timeout:20000});
      await p.waitForTimeout(600);
      const r=await p.evaluate(()=>{
        const heads=[...document.querySelectorAll("header")].filter(h=>getComputedStyle(h).display!=="none");
        const head=heads[0];
        const hb=head?head.getBoundingClientRect():null;
        // first visible element in main that has text
        const main=document.querySelector("main");
        let first=null;
        if(main){
          for(const el of main.querySelectorAll("*")){
            if(el.children.length===0 && el.textContent.trim()){
              const bb=el.getBoundingClientRect();
              if(bb.width>0&&bb.height>0&&bb.top>=0&&bb.top<600){ first={tag:el.tagName,text:el.textContent.trim().slice(0,40),top:Math.round(bb.top),left:Math.round(bb.left)}; break; }
            }
          }
        }
        const mainStyle=main?getComputedStyle(main):null;
        return {headBottom:hb?Math.round(hb.bottom):null, headTop:hb?Math.round(hb.top):null, first, mainPadTop: mainStyle?mainStyle.paddingTop:null, mainClass: main?main.className.slice(0,70):null};
      });
      console.log(path.padEnd(14), JSON.stringify(r));
    } catch(e){ console.log(path, "ERR", e.message.slice(0,60)); }
    await p.close();
  }
}
await b.close();

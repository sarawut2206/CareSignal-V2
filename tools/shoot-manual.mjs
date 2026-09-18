/* ถ่ายภาพหน้าจอแอป V3 สำหรับคู่มือ — Chrome headless ขนาดมือถือ 412×860 ความคมชัด 2 เท่า
   ข้อมูลเป็นตัวอย่างทั้งหมด อยู่ในโปรไฟล์ชั่วคราว ไม่แตะระบบกลาง */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "C:/Users/KruSam/AppData/Local/Temp/claude/C--Users-KruSam-Downloads-caresignal/2bbcefbd-336d-4eda-91c4-c16e36c3379d/scratchpad/mshots/";
const URL = "http://localhost:8093/CareSignal-App.html";
const PORT = 9366;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = 864e5, now = Date.now(), iso = (t) => new Date(t).toISOString();
const BASE = { caregiver: { name: "นิด (ตัวอย่าง)", phone: "08x-xxx-xxxx", second: "" },
  elders: [{ id: "e1", name: "คุณแม่ (ตัวอย่าง)", age: 72, aid: "cane", conditions: "ความดันโลหิตสูง", medsCount: 1, consent: { data: true, share: true, notdx: true } }],
  meds: [{ id: "m1", elderId: "e1", inn: "amlodipine", name: "amlodipine", frid: "antihtn", lv: 1, dose: "5 mg", source: "manual", date: iso(now - 20 * day) },
         { id: "m2", elderId: "e1", inn: "metformin", name: "metformin", frid: "none", lv: 0, dose: "500 mg", source: "manual", date: iso(now - 20 * day) }],
  assessments: [{ id: "a0", elderId: "e1", date: iso(now - 95 * day), ftsst: 10.2, tug: 10.4, balPassed: 3, balStages: [10, 10, 10, 4.0], balance: 10, tier: 4, score: 8, max: 9, flags: { reds: [], yellows: [] }, trend: [], by: "นิด (ตัวอย่าง)" }],
  falls: [] };
const pend = { id: "a1", elderId: "e1", date: iso(now - 1 * day), ftsst: 13.9, tug: 11.6, balPassed: 2, balStages: [10, 10, 4.1, null], balance: 4.1, fallsCount: 0, worried: true, medsCount: 1, adl: 2,
  tier: 2, score: 5, max: 9, pending: true, by: "นิด (ตัวอย่าง)", trend: [{ id: "R1", text: "ลุกนั่งช้าลง 3.7 วินาทีจากครั้งก่อน", why: "ถึงเกณฑ์การเปลี่ยนแปลงที่มีความหมายทางคลินิก (≥ 2.3 วินาที หรือ ≥ 15%)" }],
  flags: { reds: [], yellows: [{ id: "B8", text: "รู้สึกไม่มั่นคงขณะเดิน หรือกังวลว่าจะล้ม", why: "ความรู้สึกของเจ้าตัวเป็นข้อคัดกรองข้อแรกของ CDC STEADI" }, { id: "B9", text: "ลุกนั่ง 5 ครั้งใช้เวลา 13.9 วินาที เกินเกณฑ์อายุ 11.5 วินาที", why: "สะท้อนกำลังกล้ามเนื้อขาส่วนล่างที่ลดลง" }, { id: "B11", text: "ทรงตัวผ่าน 2 จาก 4 ท่า ยืนต่อเท้าไม่ครบ 10 วินาที", why: "หนึ่งในสัญญาณเสี่ยงตาม CDC 4-Stage Balance Test" }] } };
const conf = Object.assign({}, pend, { id: "a2", pending: true, confirmed: { by: "physio", verdict: "confirm", finding: "กำลังขาและการทรงตัวลดลงจากครั้งก่อน", recommend: "ออกกำลังกายตามโปรแกรม Otago ที่บ้าน 3 วันต่อสัปดาห์ และนัดประเมินซ้ำใน 30 วัน", at: iso(now), seen: true } });
const withPend = Object.assign({}, BASE, { assessments: BASE.assessments.concat([pend]) });
const withConf = Object.assign({}, BASE, { assessments: BASE.assessments.concat([conf]) });

const SHOTS = [
  { n: "01-intro", data: null, intro: false, js: "" },
  { n: "02-reg", data: null, intro: true, js: "" },
  { n: "03-home", data: BASE, js: "go('home')" },
  { n: "04-me", data: BASE, js: "go('me')" },
  { n: "05-safety", data: BASE, js: "startTest()" },
  { n: "06-ftsst", data: BASE, js: "startTest(); S.step=FLOW.indexOf('ftsst'); S.sw={k:'ftsst',t:null,t0:0,val:13.9}; render()" },
  { n: "07-balance-choice", data: BASE, js: "startTest(); S.step=FLOW.indexOf('balance'); S.draft.balStages=[10,10]; S.sw={k:'balance',t:null,t0:0,val:4.1}; render(); setTimeout(function(){var w=document.querySelector('#view .warn'); if(w) document.getElementById('view').scrollTop=w.offsetTop-190;},50)" },
  { n: "08-meds", data: BASE, js: "go('meds')" },
  { n: "09-result-pending", data: withPend, js: "S.last=D.assessments[1]; go('result')" },
  { n: "10-result-confirmed", data: withConf, js: "S.last=D.assessments[1]; go('result')" },
  { n: "11-history", data: withConf, js: "go('history')" },
  { n: "12-doc", data: withConf, js: "S.last=D.assessments[1]; go('doc')" },
  { n: "13-fall", data: BASE, js: "go('fall')" },
  { n: "14-cloud", data: BASE, js: "go('cloud')" }
];

const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--user-data-dir=" + OUT + "prof", "about:blank"], { stdio: "ignore" });
let target;
for (let i = 0; i < 30 && !target; i++) { await sleep(400); try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json(); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl); let id = 0; const wait = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m.result || m.error); wait.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = (expr) => send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 412, height: 860, deviceScaleFactor: 2, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true });
await send("Page.navigate", { url: URL }); await sleep(2500);
for (const s of SHOTS) {
  await ev(`localStorage.clear(); localStorage.setItem("cs3:a2hs","no"); ${s.data ? `localStorage.setItem("cs3:data", ${JSON.stringify(JSON.stringify(s.data))}); localStorage.setItem("cs3:intro","1");` : (s.intro ? `localStorage.setItem("cs3:intro","1");` : "")} 1`);
  await send("Page.navigate", { url: URL }); await sleep(2600);
  if (s.js) { await ev(`S.elder="e1"; ${s.js}; 1`); await sleep(900); }
  await ev(`document.fonts.ready.then(()=>1)`); await sleep(300);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(OUT + s.n + ".png", Buffer.from(shot.data, "base64"));
  console.log("shot", s.n);
}
ws.close(); chrome.kill(); process.exit(0);

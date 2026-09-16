/* แคปหน้าจอ CareSignal ด้วย Chrome headless ผ่าน CDP → ไฟล์ PNG จริง
   จับเฉพาะพื้นที่หน้าจอ (ไม่ใช่ทั้งหน้ายาว) เพราะเอาไว้ให้ผู้ถูกสัมภาษณ์ดูว่าหน้าตาแอปเป็นอย่างไร */
import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = "file:///C:/Users/KruSam/Downloads/caresignal/";
const OUT = "C:/Users/KruSam/AppData/Local/Temp/claude/C--Users-KruSam-Downloads-caresignal/2bbcefbd-336d-4eda-91c4-c16e36c3379d/scratchpad/shots/";
const LOG = OUT + "log.txt";
const PORT = 9344;

const SHOTS = [
  { n: "01-overview", u: "index.html", w: 1280, h: 860 },
  { n: "02-app-welcome", u: "CareSignal-App.html", w: 412, h: 850, m: 1 },
  { n: "03-app-home", u: "CareSignal-App.html", w: 412, h: 850, m: 1, js: 'go("home")' },
  { n: "04-app-assess", u: "CareSignal-App.html", w: 412, h: 850, m: 1, js: 'go("assessHub")' },
  { n: "05-app-intro", u: "CareSignal-App.html", w: 412, h: 850, m: 1, js: 'go("assessIntro")' },
  { n: "06-app-safety", u: "CareSignal-App.html", w: 412, h: 850, m: 1, js: 'go("safety")' },
  { n: "07-app-family", u: "CareSignal-App.html", w: 412, h: 850, m: 1, js: 'go("family")' },
  { n: "08-vision", u: "CareSignal-Vision.html", w: 1280, h: 860 },
  { n: "09-vision-assess", u: "CareSignal-Vision.html", w: 1280, h: 860, js: 'go("assessHub")' },
  { n: "10-staff", u: "CareSignal-Staff.html?demo=1", w: 1280, h: 860 },
  { n: "11-dashboard", u: "CareSignal-Portfolio-Dashboard.html?demo=1", w: 1280, h: 860 },
  { n: "12-journey", u: "CareSignal-Journey.html", w: 1280, h: 860 },
];

const log = (s) => { appendFileSync(LOG, s + "\n"); console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cap = (p, ms, tag) => Promise.race([p, sleep(ms).then(() => ({ __timeout: tag }))]);

function client(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const waiting = new Map(), events = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m.result || {}); waiting.delete(m.id); }
    if (m.method && events.has(m.method)) { events.get(m.method)(); events.delete(m.method); }
  });
  return {
    ready: new Promise((r) => ws.addEventListener("open", r)),
    send: (method, params = {}) => new Promise((r) => { const i = ++id; waiting.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }),
    once: (method) => new Promise((r) => events.set(method, r)),
    close: () => ws.close(),
  };
}

mkdirSync(OUT, { recursive: true });
writeFileSync(LOG, "");
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu", "--hide-scrollbars",
  "--allow-file-access-from-files", "--no-first-run", "--user-data-dir=" + OUT + "profile2", "about:blank",
], { stdio: "ignore" });

let target;
for (let i = 0; i < 30 && !target; i++) {
  await sleep(400);
  try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json(); } catch { /* รอ */ }
}
if (!target) { log("เปิด Chrome ไม่สำเร็จ"); chrome.kill(); process.exit(1); }

const c = client(target.webSocketDebuggerUrl);
await c.ready;
await c.send("Page.enable");
await c.send("Runtime.enable");
log("เชื่อมต่อแล้ว");

for (const s of SHOTS) {
  try {
    await cap(c.send("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 1.5, mobile: !!s.m }), 5000, "metrics");
    const loaded = c.once("Page.loadEventFired");
    await cap(c.send("Page.navigate", { url: ROOT + s.u }), 8000, "navigate");
    await cap(loaded, 8000, "load");
    await sleep(2000);
    if (s.js) {
      const r = await cap(c.send("Runtime.evaluate", { expression: `try{${s.js};"ok"}catch(e){"ERR "+e.message}` }), 6000, "eval");
      if (String(r?.result?.value || "").startsWith("ERR")) log(s.n + " js → " + r.result.value);
      await sleep(1200);
    }
    const shot = await cap(c.send("Page.captureScreenshot", { format: "png" }), 20000, "capture");
    if (!shot?.data) { log(s.n + " ไม่ได้ภาพ " + JSON.stringify(shot).slice(0, 80)); continue; }
    const buf = Buffer.from(shot.data, "base64");
    writeFileSync(OUT + s.n + ".png", buf);
    log(s.n + "  " + Math.round(buf.length / 1024) + " KB");
  } catch (e) {
    log(s.n + " พลาด: " + e.message);
  }
}

log("เสร็จ");
c.close();
chrome.kill();
process.exit(0);

/* ทดสอบฐานความรู้ยา cs-meds.js · node audit/test_meds_kb.mjs
   1. ทุกตัวยามีรหัส ATC รูปแบบถูก ไม่ซ้ำ และมีข้อมูลประกอบครบ
   2. ชื่อค้นหาไม่ชนกันข้ามตัวยาที่กลุ่มเสี่ยงต่างกัน (ชนแล้วจะจัดกลุ่มผิด)
   3. กลุ่มเสี่ยงหกล้มในไฟล์ตรงกับกฎ cs_atc_to_frid ฝั่งเซิร์ฟเวอร์
      ยกเว้นรายการที่จงใจ ซึ่งต้องมีเหตุผลกำกับทุกตัว
   4. ข้อความข้อควรระวังไม่มีคำสั่งหยุดหรือปรับยา */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const M = require("../cs-meds.js");
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("  ตก: " + n + (x !== undefined ? " — " + JSON.stringify(x).slice(0, 400) : "")); } };

/* สำเนากฎจาก supabase/16_drug_registry.sql + 25_drug_monograph.sql (ข้อยกเว้นที่เพิ่ม) */
function atcToFrid(atc) {
  const a = String(atc || "").toUpperCase();
  if (!/^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(a)) return "unknown";
  if (["R06AE07", "R06AX13", "R06AX26", "R06AX27", "R06AX28", "N07CA01", "G04BD12"].includes(a)) return "none";
  if (["R05DA01", "R05DA04", "R05DA08", "R05DA20"].includes(a)) return "opioid";
  if (a.startsWith("N03AE")) return "bzd";
  if (a === "R06AX07") return "antihist";
  if (/^N05B[A]|^N05C[DF]/.test(a)) return "bzd";
  if (a.startsWith("N06A")) return "antidep";
  if (a.startsWith("N05A") && !a.startsWith("N05AN")) return "antipsy";
  if (a.startsWith("N03A")) return "anticonv";
  if (a.startsWith("N02A") || a.startsWith("N07BC")) return "opioid";
  if (/^N04A[ABC]|^A03B[AB]|^A03AA/.test(a)) return "anticho";
  if (a.startsWith("M03B")) return "relax";
  if (/^R06A[ABD]|^R05DA|^N07CA/.test(a) || ["R06AE03", "R06AE05", "R06AX02", "N05BB01"].includes(a)) return "antihist";
  if (/^C03|^C09BA|^C09DA|^C07B|^C07C/.test(a)) return "diuretic";
  if (/^C02CA|^G04CA/.test(a)) return "alpha";
  if (a.startsWith("G04BD")) return "bladder";
  if (/^C01DA|^C02|^C07|^C08|^C09/.test(a)) return "antihtn";
  return "none";
}
/* ข้อยกเว้นที่จงใจ — กฎตามหมวด ATC ให้ผลต่างจากความจริงทางคลินิก */
const EXCEPT = {
  "amlodipine valsartan": "C09DB เป็นสูตรผสม CCB+ARB ไม่มียาขับปัสสาวะ — กฎเซิร์ฟเวอร์ให้ antihtn เหมือนกันอยู่แล้ว",
  "insulin": "รหัสระดับกลุ่ม A10A — เซิร์ฟเวอร์คืน unknown แล้วส่งเภสัชกร",
  "calcium": "รหัสระดับกลุ่ม", "vitamin d": "รหัสระดับกลุ่ม", "ferrous": "รหัสระดับกลุ่ม", "vitamin b complex": "รหัสระดับกลุ่ม"
};

const D = M.DRUGS;
ok("จำนวนตัวยาอย่างน้อย 350", D.length >= 350, D.length);
const inns = D.map((d) => d[0]);
ok("ชื่อตัวยาไม่ซ้ำ", new Set(inns).size === inns.length, inns.filter((x, i) => inns.indexOf(x) !== i));
const badAtc = D.filter((d) => !/^[A-Z]\d{2}[A-Z]{1,2}(\d{2})?$/.test(d[1]));
ok("รหัส ATC รูปแบบถูกต้อง", !badAtc.length, badAtc.map((d) => d[0] + ":" + d[1]));
ok("กลุ่ม FRID ทุกตัวอยู่ในรายการที่กำหนด", D.every((d) => M.FRID[d[2]]), D.filter((d) => !M.FRID[d[2]]).map((d) => d[0]));
ok("ทุกตัวยามีข้อมูลประกอบ (ชื่อไทย กลุ่ม ใช้รักษา)", D.every((d) => { const i = M.info(d[0]); return i && i.th && i.cls && i.use; }), D.filter((d) => !M.info(d[0]) || !M.info(d[0]).cls).map((d) => d[0]));
ok("ไม่มีข้อมูลประกอบของตัวยาที่ไม่มีอยู่", Object.keys(M.INFO).every((k) => M.BY_INN[k]));
const nFrid = D.filter((d) => d[2] !== "none").length, nNone = D.length - nFrid;
ok("มีทั้งยาที่เพิ่มความเสี่ยงหกล้ม และยาที่ไม่เพิ่ม", nFrid >= 150 && nNone >= 150, { nFrid, nNone });
ok("ยาเสี่ยงหกล้มทุกตัวมีข้อควรระวัง", D.filter((d) => d[2] !== "none").every((d) => M.info(d[0]).note), D.filter((d) => d[2] !== "none" && !M.info(d[0]).note).map((d) => d[0]));

/* ชื่อค้นหาชนกันข้ามตัวยาที่กลุ่มต่างกัน = อันตราย (ชนในกลุ่มเดียวกัน เช่น calcium/calcium carbonate ยอมได้) */
const own = {}, clash = [];
D.forEach((d) => [d[0]].concat(d[3] || [], [M.INFO[d[0]][0]]).forEach((k) => {
  const n = M.norm(k); if (n.length < 3) return;
  if (own[n] && own[n].inn !== d[0] && own[n].frid !== d[2]) clash.push(k + ": " + own[n].inn + "/" + d[0]);
  if (!own[n]) own[n] = { inn: d[0], frid: d[2] };
}));
ok("ชื่อค้นหาไม่ชนกันข้ามกลุ่มเสี่ยง", !clash.length, clash);

const mismatch = D.filter((d) => /^[A-Z]\d{2}[A-Z]{2}\d{2}$/.test(d[1]) && atcToFrid(d[1]) !== d[2] && !EXCEPT[d[0]]);
ok("กลุ่มเสี่ยงตรงกับกฎ ATC ฝั่งเซิร์ฟเวอร์ (นอกจากข้อยกเว้นที่มีเหตุผล)", !mismatch.length, mismatch.map((d) => d[0] + " " + d[1] + " ไฟล์=" + d[2] + " กฎ=" + atcToFrid(d[1])));

const bad = Object.entries(M.INFO).filter(([k, v]) => v[2] && /(ให้|ควร|กรุณา)(หยุด|ลด|เพิ่ม)ยา/.test(v[2]));
ok("ข้อควรระวังไม่มีคำสั่งหยุดหรือปรับยา", !bad.length, bad.map((x) => x[0]));
ok("trihexyphenidyl = N04AA01 (N04AA02 คือ biperiden)", M.BY_INN.trihexyphenidyl.atc === "N04AA01" && M.BY_INN.biperiden.atc === "N04AA02");

/* การจับคู่ยังทำงาน รวมชื่อไทยที่เพิ่ม */
const t = [["Lexotan 3 mg", "bromazepam"], ["Jardiance", "empagliflozin"], ["ริวาร็อกซาแบน", "rivaroxaban"], ["Stemetil", "prochlorperazine"], ["Betmiga", "mirabegron"], ["Amlodipine", "amlodipine"]];
t.forEach(([q, inn]) => { const r = M.extract(q).candidates[0]; ok("จับคู่ \"" + q + "\" → " + inn, r && r.inn === inn, r); });
ok("mirabegron ไม่อยู่ในกลุ่มเสี่ยง (ไม่ใช่ต้านโคลิเนอร์จิก)", M.classify("mirabegron").lv === 0);
ok("prochlorperazine เป็นยาต้านโรคจิต ระดับ 2", M.classify("prochlorperazine").lv === 2);
const sum = M.summarize([{ inn: "bromazepam" }, { inn: "amlodipine" }, { inn: "metformin" }]);
ok("สรุปคะแนนยาเสี่ยง: สูง 1 × 2 + ปานกลาง 1 = 3", sum.total === 3 && sum.high === 1 && sum.mod === 1, sum);

console.log("  ฐานยา: " + D.length + " ตัว (เสี่ยงหกล้ม " + nFrid + " · ไม่เสี่ยง " + nNone + ")");
console.log("  " + pass + " ผ่าน / " + fail + " ตก");
process.exit(fail ? 1 : 0);

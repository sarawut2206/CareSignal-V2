/* สร้าง supabase/25_drug_monograph.sql จาก cs-meds.js — ให้ฐานข้อมูลกับไฟล์ในแอปตรงกันเสมอ
   node tools/make-drug-sql.mjs
   · drug_monograph: ข้อมูลประกอบรายตัว (ชื่อไทย กลุ่ม ใช้รักษา ข้อควรระวัง) ทุกตัวยา
   · drug_alias: เพิ่มชื่อค้นหาใหม่ · แถว curated เดิมอัปเดตตามไฟล์ · แถวที่เภสัชกรยืนยันไม่ถูกแตะ
   · cs_atc_to_frid: เพิ่มข้อยกเว้น mirabegron (ไม่ใช่ต้านโคลิเนอร์จิก) และ triprolidine (ยาแก้แพ้รุ่นแรก) */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const ROOT = new URL("../", import.meta.url);
const M = require("../cs-meds.js");
const q = (s) => s == null ? "null" : "'" + String(s).replace(/'/g, "''") + "'";
const key = (s) => String(s).toLowerCase().trim().replace(/\s+/g, " ");

/* ฟังก์ชันกฎ ATC เดิม + ข้อยกเว้นใหม่ */
const m16 = readFileSync(new URL("supabase/16_drug_registry.sql", ROOT), "utf8");
let fn = m16.slice(m16.indexOf("create or replace function public.cs_atc_to_frid"), m16.indexOf("$fn$;", m16.indexOf("create or replace function public.cs_atc_to_frid")) + 5);
const anchor = "  -- betahistine ไม่กดประสาท";
if (!fn.includes(anchor)) throw new Error("ไม่พบจุดแทรกข้อยกเว้นใน cs_atc_to_frid");
fn = fn.replace(anchor,
  "  -- mirabegron (G04BD12) เป็น beta-3 agonist ไม่ใช่ยาต้านโคลิเนอร์จิกเหมือนยาอื่นในหมวด G04BD\n" +
  "  elsif a = 'G04BD12' then\n    return query select 'none'::text, 0::smallint; return;\n" +
  "  -- triprolidine (R06AX07) เป็นยาแก้แพ้รุ่นแรกที่ทำให้ง่วง แม้อยู่หมวด R06AX\n" +
  "  elsif a = 'R06AX07' then\n    return query select 'antihist'::text, 1::smallint; return;\n" + anchor);

const mono = M.DRUGS.map((d) => {
  const i = M.info(d[0]);
  return "  (" + [q(d[0]), q(d[1]), q(d[2]), M.FRID[d[2]].lv, q(i.th), q(i.cls), q(i.use), q(i.note)].join(", ") + ")";
});
const seen = {}, alias = [];
M.DRUGS.forEach((d) => {
  const i = M.info(d[0]);
  [d[0]].concat(d[3] || [], [i.th]).forEach((a) => {
    const k = key(a); if (k.length < 2 || seen[k]) return; seen[k] = 1;
    alias.push("  (" + [q(k), q(d[0]), q(d[1]), q(d[2]), M.FRID[d[2]].lv].join(", ") + ", 'curated')");
  });
});

const sql = `-- ============================================================
-- 25_drug_monograph.sql — ฐานความรู้ยาฉบับขยาย (สร้างอัตโนมัติจาก cs-meds.js)
-- ------------------------------------------------------------
-- อย่าแก้ไฟล์นี้ด้วยมือ — แก้ cs-meds.js แล้วรัน node tools/make-drug-sql.mjs
-- ตัวยา ${M.DRUGS.length} ตัว (เพิ่มความเสี่ยงหกล้ม ${M.DRUGS.filter((d) => d[2] !== "none").length} · ไม่เพิ่ม ${M.DRUGS.filter((d) => d[2] === "none").length}) · ชื่อค้นหา ${alias.length} ชื่อ
-- กลุ่มเสี่ยงหกล้มตาม STOPPFall 2021 · ข้อควรระวังที่ขึ้นต้น "Beers 2023:" จาก AGS Beers Criteria 2023
-- ทดสอบความตรงกันของกลุ่มกับกฎ ATC: node audit/test_meds_kb.mjs
-- รันซ้ำได้
-- ============================================================

create table if not exists public.drug_monograph (
  inn          text primary key,
  atc          text,
  frid_group   text not null,
  frid_level   smallint,
  th_name      text,
  class_th     text,
  use_th       text,
  caution_th   text,
  updated_at   timestamptz not null default now()
);
comment on table public.drug_monograph is
  'ข้อมูลประกอบรายตัวยา: ชื่อไทย กลุ่มการรักษา ใช้รักษา ข้อควรระวังที่เกี่ยวกับการล้ม — ไม่มีข้อความสั่งหยุดหรือปรับยา';
alter table public.drug_monograph enable row level security;
drop policy if exists mono_read on public.drug_monograph;
create policy mono_read on public.drug_monograph for select using (auth.uid() is not null);
revoke insert, update, delete on public.drug_monograph from anon, authenticated;

insert into public.drug_monograph (inn, atc, frid_group, frid_level, th_name, class_th, use_th, caution_th) values
${mono.join(",\n")}
on conflict (inn) do update set atc = excluded.atc, frid_group = excluded.frid_group, frid_level = excluded.frid_level,
  th_name = excluded.th_name, class_th = excluded.class_th, use_th = excluded.use_th, caution_th = excluded.caution_th, updated_at = now();

-- ชื่อค้นหา: แถว curated อัปเดตตามไฟล์ (เช่น แก้ ATC trihexyphenidyl เป็น N04AA01)
-- แถวที่เภสัชกรยืนยัน (source = 'pharmacist') ไม่ถูกแตะ
insert into public.drug_alias (alias, inn, atc, frid_group, frid_level, source) values
${alias.join(",\n")}
on conflict (alias) do update set inn = excluded.inn, atc = excluded.atc, frid_group = excluded.frid_group, frid_level = excluded.frid_level
  where public.drug_alias.source = 'curated';

${fn}

-- ข้อมูลรายตัวสำหรับคอนโซลเภสัชกรและใบส่งต่อ
create or replace function public.cs_drug_info(p_inn text)
returns setof public.drug_monograph language sql stable security definer set search_path = public as $fn$
  select * from public.drug_monograph where inn = lower(trim(p_inn))
$fn$;
grant execute on function public.cs_drug_info(text) to authenticated;
`;
writeFileSync(new URL("supabase/25_drug_monograph.sql", ROOT), sql);
console.log("เขียน supabase/25_drug_monograph.sql · ตัวยา " + M.DRUGS.length + " · ชื่อค้นหา " + alias.length);

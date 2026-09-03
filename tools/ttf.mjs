/* ============================================================
   ttf.mjs — อ่านไฟล์ฟอนต์ TrueType เท่าที่ PDF ต้องใช้
   ------------------------------------------------------------
   ทำไมต้องเขียนเอง
     PDF ไม่มีฟอนต์ไทยติดมาให้ ฟอนต์มาตรฐานทั้งสิบสี่ตัวเป็นอักษรละตินล้วน
     ถ้าจะพิมพ์คำอธิบายภาษาไทยลงแผ่นป้าย ต้องฝังฟอนต์ลงไปในไฟล์เอง
     และการฝังต้องรู้สามอย่างจากตัวฟอนต์: รหัสอักขระแมปไปกลิฟไหน (cmap)
     กลิฟแต่ละตัวกว้างเท่าไร (hmtx) และหน่วยต่อ em เท่าไร (head)

   ขอบเขตที่ตั้งใจให้แคบ
     อ่านเฉพาะ cmap รูปแบบ 4 (ระนาบพื้นฐาน) ซึ่งครอบคลุมอักษรไทยและละติน
     ไม่ทำ subsetting — ฝังทั้งไฟล์ไปเลย เพราะ Leelawadee หนักเพียง 95 KB
     และการตัด glyf/loca ให้ถูกต้องมีโอกาสพลาดสูงกว่าประโยชน์ที่ได้
     ไม่อ่าน GSUB/GPOS จึงไม่มีการจัดวางสระและวรรณยุกต์ตามหลักการเรียงพิมพ์
     ข้อความบนแผ่นจึงตั้งใจให้สั้นและเป็นคำที่ไม่ซับซ้อน
   ============================================================ */
import { readFileSync } from "node:fs";

export function readTTF(path) {
  const buf = readFileSync(path);
  const u16 = (o) => buf.readUInt16BE(o);
  const i16 = (o) => buf.readInt16BE(o);
  const u32 = (o) => buf.readUInt32BE(o);

  const numTables = u16(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    tables[buf.toString("latin1", off, off + 4).trim()] =
      { off: u32(off + 8), len: u32(off + 12) };
  }
  const need = ["head", "maxp", "hhea", "hmtx", "cmap"];
  for (const t of need) if (!tables[t]) throw new Error("ฟอนต์ขาดตาราง " + t);

  const head = tables.head.off;
  const unitsPerEm = u16(head + 18);
  const bbox = [i16(head + 36), i16(head + 38), i16(head + 40), i16(head + 42)];

  const numGlyphs = u16(tables.maxp.off + 4);
  const numHM = u16(tables.hhea.off + 34);
  const ascent = i16(tables.hhea.off + 4);
  const descent = i16(tables.hhea.off + 6);

  /* ความกว้างของกลิฟ — หลังรายการที่ numHM กลิฟที่เหลือใช้ความกว้างตัวสุดท้าย */
  const widths = new Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < numGlyphs; g++) {
    if (g < numHM) last = u16(tables.hmtx.off + g * 4);
    widths[g] = last;
  }

  /* ---- cmap: หาตารางย่อยของ Windows Unicode BMP ---- */
  const cm = tables.cmap.off;
  let sub = -1;
  const nSub = u16(cm + 2);
  for (let i = 0; i < nSub; i++) {
    const p = u16(cm + 4 + i * 8), e = u16(cm + 6 + i * 8), o = u32(cm + 8 + i * 8);
    if ((p === 3 && (e === 1 || e === 10)) || (p === 0 && sub < 0)) sub = cm + o;
  }
  if (sub < 0) throw new Error("ฟอนต์ไม่มี cmap ที่รองรับ Unicode");
  if (u16(sub) !== 4) throw new Error("รองรับเฉพาะ cmap รูปแบบ 4 แต่พบรูปแบบ " + u16(sub));

  const segX2 = u16(sub + 6), seg = segX2 / 2;
  const endO = sub + 14, startO = endO + segX2 + 2;
  const deltaO = startO + segX2, rangeO = deltaO + segX2;
  const map = new Map();
  for (let i = 0; i < seg; i++) {
    const end = u16(endO + i * 2), start = u16(startO + i * 2);
    const delta = i16(deltaO + i * 2), ro = u16(rangeO + i * 2);
    if (start === 0xffff) continue;
    for (let c = start; c <= end && c !== 0x10000; c++) {
      let g;
      if (ro === 0) g = (c + delta) & 0xffff;
      else {
        const gi = rangeO + i * 2 + ro + (c - start) * 2;
        if (gi + 1 >= buf.length) continue;
        g = u16(gi);
        if (g !== 0) g = (g + delta) & 0xffff;
      }
      if (g) map.set(c, g);
    }
  }

  return {
    buf, unitsPerEm, numGlyphs, widths, ascent, descent, bbox, map,
    /** แปลงข้อความเป็นรายการกลิฟ พร้อมความกว้างรวมในหน่วย 1/1000 em */
    glyphs(text) {
      const gids = [];
      let w = 0;
      for (const ch of text) {
        const cp = ch.codePointAt(0);
        const g = map.get(cp);
        if (g === undefined) continue;            /* ตัวที่ฟอนต์ไม่มี ข้ามไป ไม่วาดกล่องว่าง */
        gids.push(g);
        w += widths[g] * 1000 / unitsPerEm;
      }
      return { gids, width: w };
    }
  };
}

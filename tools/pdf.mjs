/* ============================================================
   pdf.mjs — เขียนไฟล์ PDF ขนาดเล็กที่ฝังฟอนต์ไทยได้
   ------------------------------------------------------------
   ทำไมเขียนเอง ไม่ใช้ไลบรารี
     สิ่งที่ต้องวาดมีแค่สี่เหลี่ยมทึบ เส้นตรง และข้อความ ซึ่ง PDF ทำได้ตรง ๆ
     ด้วยคำสั่งไม่กี่ตัว · การดึงไลบรารีเข้ามาเพื่อเรื่องนี้ทำให้โครงการมี
     dependency ที่ต้องดูแลตลอดไป แลกกับโค้ดสองร้อยกว่าบรรทัดที่อ่านจบได้

   หัวใจของงานคือ "ขนาดต้องตรง"
     ทั้งแผ่นมีไว้เพื่อให้ป้ายที่พิมพ์ออกมากว้างตามที่ระบบคาดไว้จริง
     PDF ใช้หน่วยพอยต์ (1/72 นิ้ว) ทุกพิกัดจึงแปลงจากมิลลิเมตรด้วย
     72/25.4 และไม่มีการปรับสเกลใด ๆ ระหว่างทาง

   หมายเหตุเรื่องภาษาไทย
     ฝังฟอนต์แบบ Identity-H คือส่งหมายเลขกลิฟตรง ๆ ไม่ผ่านการจัดวาง
     สระและวรรณยุกต์ตามหลัก (GSUB/GPOS) ข้อความบนแผ่นจึงตั้งใจให้สั้น
     และหลีกเลี่ยงคำที่มีวรรณยุกต์ซ้อนสระบน
   ============================================================ */

export const MM = 72 / 25.4;              /* มิลลิเมตร → พอยต์ */
export const A4 = { w: 210 * MM, h: 297 * MM };

/** สร้างหน้ากระดาษหนึ่งหน้า — คำสั่งวาดสะสมไว้ในรายการเดียว */
export class Page {
  constructor(font) { this.ops = []; this.font = font; }

  /** สี่เหลี่ยมทึบ · x,y นับจากมุมซ้ายล่างตามระบบพิกัดของ PDF */
  rect(x, y, w, h, gray) {
    const g = gray === undefined ? 0 : gray;
    this.ops.push(`${g} ${g} ${g} rg ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f`);
    return this;
  }
  /** กรอบเส้น ไม่ทึบ */
  frame(x, y, w, h, lw, gray, dash) {
    const g = gray === undefined ? 0 : gray;
    this.ops.push(`q ${g} ${g} ${g} RG ${f(lw)} w ${dash ? `[${f(dash)} ${f(dash)}] 0 d ` : ""}` +
                  `${f(x)} ${f(y)} ${f(w)} ${f(h)} re S Q`);
    return this;
  }
  line(x1, y1, x2, y2, lw, gray, dash) {
    const g = gray === undefined ? 0 : gray;
    this.ops.push(`q ${g} ${g} ${g} RG ${f(lw)} w ${dash ? `[${f(dash)} ${f(dash)}] 0 d ` : ""}` +
                  `${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S Q`);
    return this;
  }
  /** วงรี ใช้เส้นโค้งเบซิเยร์สี่ท่อน — ใช้วาดรอยเท้าในหน้าแนะนำท่ายืน */
  ellipse(cx, cy, rx, ry, lw, gray) {
    const k = 0.5523;
    const g = gray === undefined ? 0 : gray;
    this.ops.push(
      `q ${g} ${g} ${g} RG ${f(lw)} w ${f(cx + rx)} ${f(cy)} m ` +
      `${f(cx + rx)} ${f(cy + ry * k)} ${f(cx + rx * k)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} c ` +
      `${f(cx - rx * k)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ry * k)} ${f(cx - rx)} ${f(cy)} c ` +
      `${f(cx - rx)} ${f(cy - ry * k)} ${f(cx - rx * k)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)} c ` +
      `${f(cx + rx * k)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ry * k)} ${f(cx + rx)} ${f(cy)} c S Q`);
    return this;
  }

  /** ความกว้างข้อความเป็นพอยต์ ใช้จัดกึ่งกลางเองเพราะ PDF ไม่จัดให้ */
  textWidth(s, size) { return this.font.glyphs(s).width * size / 1000; }

  /** ข้อความ · align: "l" ซ้าย, "c" กึ่งกลางที่ x, "r" ชิดขวาที่ x */
  text(s, x, y, size, gray, align) {
    const { gids, width } = this.font.glyphs(s);
    if (!gids.length) return this;
    const w = width * size / 1000;
    const px = align === "c" ? x - w / 2 : align === "r" ? x - w : x;
    const g = gray === undefined ? 0 : gray;
    const hex = gids.map((n) => n.toString(16).padStart(4, "0")).join("");
    this.ops.push(`BT ${g} ${g} ${g} rg /F1 ${f(size)} Tf ${f(px)} ${f(y)} Td <${hex}> Tj ET`);
    return this;
  }
  /** ข้อความหลายบรรทัด ตัดคำตามความกว้างที่กำหนด คืนตำแหน่ง y บรรทัดถัดไป */
  paragraph(s, x, y, size, width, leading, gray) {
    const words = s.split(" ");
    let line = "", cy = y;
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (this.textWidth(t, size) > width && line) {
        this.text(line, x, cy, size, gray); cy -= leading; line = w;
      } else line = t;
    }
    if (line) { this.text(line, x, cy, size, gray); cy -= leading; }
    return cy;
  }
  content() { return this.ops.join("\n"); }
}

const f = (n) => (Math.round(n * 1000) / 1000).toString();

/** ประกอบไฟล์ PDF จากหน้าที่วาดไว้ พร้อมฝังฟอนต์ */
export function buildPDF(pages, font, meta) {
  const objs = [];                       /* objs[i] = เนื้อของวัตถุหมายเลข i+1 */
  const add = (body) => { objs.push(body); return objs.length; };

  const nCatalog = add(null), nPages = add(null);
  const pageNums = [], contentNums = [];
  for (const p of pages) {
    const c = Buffer.from(p.content(), "latin1");
    contentNums.push(add(`<</Length ${c.length}>>\nstream\n${c.toString("latin1")}\nendstream`));
    pageNums.push(add(null));
  }
  const nFontFile = add(null);           /* เนื้อเป็นไบนารี จัดการตอนเขียนจริง */
  const nDescr = add(null), nCID = add(null), nFont = add(null);

  const up = font.unitsPerEm, sc = (v) => Math.round(v * 1000 / up);
  /* ความกว้างของทุกกลิฟ — ฟอนต์ไทยตัวนี้มี 352 กลิฟ ใส่ทั้งหมดได้สบาย */
  const W = "[0 [" + font.widths.map((w) => sc(w)).join(" ") + "]]";

  objs[nCatalog - 1] = `<</Type/Catalog/Pages ${nPages} 0 R>>`;
  objs[nPages - 1] = `<</Type/Pages/Kids[${pageNums.map((n) => n + " 0 R").join(" ")}]` +
                     `/Count ${pageNums.length}>>`;
  pages.forEach((p, i) => {
    objs[pageNums[i] - 1] =
      `<</Type/Page/Parent ${nPages} 0 R/MediaBox[0 0 ${f(A4.w)} ${f(A4.h)}]` +
      `/Resources<</Font<</F1 ${nFont} 0 R>>>>/Contents ${contentNums[i]} 0 R>>`;
  });
  objs[nDescr - 1] =
    `<</Type/FontDescriptor/FontName/EmbeddedThai/Flags 4` +
    `/FontBBox[${sc(font.bbox[0])} ${sc(font.bbox[1])} ${sc(font.bbox[2])} ${sc(font.bbox[3])}]` +
    `/ItalicAngle 0/Ascent ${sc(font.ascent)}/Descent ${sc(font.descent)}` +
    `/CapHeight ${sc(font.ascent)}/StemV 80/FontFile2 ${nFontFile} 0 R>>`;
  objs[nCID - 1] =
    `<</Type/Font/Subtype/CIDFontType2/BaseFont/EmbeddedThai` +
    `/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>` +
    `/FontDescriptor ${nDescr} 0 R/DW 1000/W ${W}/CIDToGIDMap/Identity>>`;
  objs[nFont - 1] =
    `<</Type/Font/Subtype/Type0/BaseFont/EmbeddedThai/Encoding/Identity-H` +
    `/DescendantFonts[${nCID} 0 R]>>`;

  /* ---- เขียนออกเป็นไบต์ พร้อมตาราง xref ---- */
  const chunks = [];
  let pos = 0;
  const push = (b) => { const x = Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1");
                        chunks.push(x); pos += x.length; };
  const offsets = new Array(objs.length + 1).fill(0);

  push(`%PDF-1.4\n%\xe2\xe3\xcf\xd3\n`);
  for (let i = 1; i <= objs.length; i++) {
    offsets[i] = pos;
    if (i === nFontFile) {
      push(`${i} 0 obj\n<</Length ${font.buf.length}/Length1 ${font.buf.length}>>\nstream\n`);
      push(font.buf);
      push(`\nendstream\nendobj\n`);
    } else {
      push(`${i} 0 obj\n${objs[i - 1]}\nendobj\n`);
    }
  }
  const xref = pos;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++)
    x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  const info = meta && meta.title
    ? `/Title(${meta.title.replace(/[()\\]/g, "")})` : "";
  x += `trailer\n<</Size ${objs.length + 1}/Root ${nCatalog} 0 R` +
       (info ? `/Info<<${info}>>` : "") + `>>\nstartxref\n${xref}\n%%EOF\n`;
  push(x);

  return Buffer.concat(chunks);
}

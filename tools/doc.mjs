/* ============================================================
   doc.mjs — เอกสารหลายหน้าแบบไหลต่อเนื่อง สำหรับคู่มือ
   ------------------------------------------------------------
   ต่อยอดจาก pdf.mjs ซึ่งทำหน้าที่เดียวคือ "ขนาดต้องตรง" สำหรับแผ่นป้าย
   คู่มือต้องการอีกสี่อย่างที่แผ่นป้ายไม่ต้องการ
     1. สี — ระดับความเสี่ยงในระบบมีสีประจำ คู่มือต้องใช้สีเดียวกัน
     2. ตัวหนา — หัวข้อกับเนื้อความต้องแยกกันด้วยน้ำหนัก ไม่ใช่ขนาดอย่างเดียว
     3. ตัดบรรทัดภาษาไทย — ไทยไม่มีช่องว่างระหว่างคำ ใช้ Intl.Segmenter ของ ICU
        แบ่งคำก่อน แล้วค่อยตัดบรรทัด ไม่งั้นจะตัดกลางคำ
     4. ไหลข้ามหน้า — เนื้อหายาวกว่าหนึ่งหน้า ต้องขึ้นหน้าใหม่เอง ใส่เลขหน้า
        และเก็บสารบัญได้
   ทั้งหมดนี้อยู่ที่นี่ ไม่แตะ pdf.mjs เพื่อให้แผ่นป้ายและเทสต์ของมันคงเดิม
   ============================================================ */
import { MM, A4 } from "./pdf.mjs";
export { MM, A4 };

const f = (n) => (Math.round(n * 1000) / 1000).toString();
const rgb = (c) => Array.isArray(c) ? c.map(f).join(" ") : `${f(c)} ${f(c)} ${f(c)}`;
const SEG = new Intl.Segmenter("th", { granularity: "word" });

/* ---------- สีของระบบ (0–1) — ตรงกับ --c1..--c4 และ --brand ในคอนโซล ---------- */
export const C = {
  ink: [0.086, 0.137, 0.231], ink2: [0.31, 0.373, 0.471], ink3: [0.482, 0.541, 0.631],
  line: [0.851, 0.882, 0.925], line2: [0.918, 0.937, 0.961], surf2: [0.969, 0.976, 0.988],
  brand: [0.114, 0.306, 0.604], brand2: [0.078, 0.227, 0.455], brandt: [0.91, 0.941, 0.984],
  c1: [0.863, 0.149, 0.149], c2: [0.918, 0.345, 0.047], c3: [0.851, 0.467, 0.024], c4: [0.086, 0.639, 0.29],
  c1t: [0.996, 0.886, 0.886], c3t: [0.996, 0.953, 0.78], c4t: [0.863, 0.988, 0.906],
  white: [1, 1, 1], black: [0, 0, 0]
};

/** หน้าหนึ่งหน้า — วาดด้วยสีได้ และมีสองฟอนต์ (ปกติ/หนา) */
export class DocPage {
  constructor(fonts) { this.ops = []; this.fonts = fonts; }
  rect(x, y, w, h, color) { this.ops.push(`${rgb(color == null ? 0 : color)} rg ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f`); return this; }
  /* สี่เหลี่ยมมุมมน — ใช้กับการ์ด ป้าย และปุ่มในภาพจำลองหน้าจอ */
  rrect(x, y, w, h, r, fill, stroke, lw) {
    const k = 0.5523, o = this.ops;
    const path = `${f(x + r)} ${f(y)} m ${f(x + w - r)} ${f(y)} l ${f(x + w - r + r * k)} ${f(y)} ${f(x + w)} ${f(y + r - r * k)} ${f(x + w)} ${f(y + r)} c ` +
      `${f(x + w)} ${f(y + h - r)} l ${f(x + w)} ${f(y + h - r + r * k)} ${f(x + w - r + r * k)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} c ` +
      `${f(x + r)} ${f(y + h)} l ${f(x + r - r * k)} ${f(y + h)} ${f(x)} ${f(y + h - r + r * k)} ${f(x)} ${f(y + h - r)} c ` +
      `${f(x)} ${f(y + r)} l ${f(x)} ${f(y + r - r * k)} ${f(x + r - r * k)} ${f(y)} ${f(x + r)} ${f(y)} c h`;
    if (fill != null) o.push(`q ${rgb(fill)} rg ${path} f Q`);
    if (stroke != null) o.push(`q ${rgb(stroke)} RG ${f(lw || 0.6)} w ${path} S Q`);
    return this;
  }
  frame(x, y, w, h, lw, color, dash) {
    this.ops.push(`q ${rgb(color == null ? 0 : color)} RG ${f(lw)} w ${dash ? `[${f(dash)} ${f(dash)}] 0 d ` : ""}${f(x)} ${f(y)} ${f(w)} ${f(h)} re S Q`);
    return this;
  }
  line(x1, y1, x2, y2, lw, color, dash) {
    this.ops.push(`q ${rgb(color == null ? 0 : color)} RG ${f(lw)} w 1 J 1 j ${dash ? `[${f(dash)} ${f(dash)}] 0 d ` : ""}${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S Q`);
    return this;
  }
  /* เส้นหลายจุด — ใช้วาดคน ลูกศร และเส้นทางเดิน */
  poly(pts, lw, color, close) {
    const p = pts.map((q, i) => `${f(q[0])} ${f(q[1])} ${i ? "l" : "m"}`).join(" ");
    this.ops.push(`q ${rgb(color == null ? 0 : color)} RG ${f(lw)} w 1 J 1 j ${p} ${close ? "h " : ""}S Q`);
    return this;
  }
  polyFill(pts, color) {
    const p = pts.map((q, i) => `${f(q[0])} ${f(q[1])} ${i ? "l" : "m"}`).join(" ");
    this.ops.push(`q ${rgb(color)} rg ${p} h f Q`);
    return this;
  }
  ellipse(cx, cy, rx, ry, lw, color, fill) {
    const k = 0.5523;
    const path = `${f(cx + rx)} ${f(cy)} m ` +
      `${f(cx + rx)} ${f(cy + ry * k)} ${f(cx + rx * k)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} c ` +
      `${f(cx - rx * k)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ry * k)} ${f(cx - rx)} ${f(cy)} c ` +
      `${f(cx - rx)} ${f(cy - ry * k)} ${f(cx - rx * k)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)} c ` +
      `${f(cx + rx * k)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ry * k)} ${f(cx + rx)} ${f(cy)} c`;
    if (fill != null) this.ops.push(`q ${rgb(fill)} rg ${path} f Q`);
    if (lw) this.ops.push(`q ${rgb(color == null ? 0 : color)} RG ${f(lw)} w ${path} S Q`);
    return this;
  }
  /* ลูกศร — ใช้บอกทิศทางเดิน ระยะ และลำดับขั้น */
  arrow(x1, y1, x2, y2, lw, color) {
    this.line(x1, y1, x2, y2, lw, color);
    const a = Math.atan2(y2 - y1, x2 - x1), s = 2.2 * MM;
    this.polyFill([[x2, y2], [x2 - s * Math.cos(a - 0.5), y2 - s * Math.sin(a - 0.5)], [x2 - s * Math.cos(a + 0.5), y2 - s * Math.sin(a + 0.5)]], color == null ? 0 : color);
    return this;
  }
  font(bold) { return bold ? this.fonts.bold : this.fonts.reg }
  textWidth(s, size, bold) { return this.font(bold).glyphs(s).width * size / 1000; }
  text(s, x, y, size, color, align, bold) {
    const { gids, width } = this.font(bold).glyphs(s);
    if (!gids.length) return this;
    const w = width * size / 1000;
    const px = align === "c" ? x - w / 2 : align === "r" ? x - w : x;
    const hex = gids.map((n) => n.toString(16).padStart(4, "0")).join("");
    this.ops.push(`BT ${rgb(color == null ? 0 : color)} rg /${bold ? "F2" : "F1"} ${f(size)} Tf ${f(px)} ${f(y)} Td <${hex}> Tj ET`);
    return this;
  }
  /* แบ่งข้อความเป็นบรรทัดตามความกว้าง — แบ่งคำไทยด้วย ICU ก่อน
     ช่องว่างในต้นฉบับยังเป็นจุดตัดที่ดีที่สุด แต่ไม่ใช่จุดเดียวอีกต่อไป */
  wrap(s, size, width, bold) {
    const out = []; let line = "";
    for (const part of s.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { line += " "; continue; }
      for (const seg of SEG.segment(part)) {
        const w = seg.segment;
        if (this.textWidth(line + w, size, bold) <= width || !line.trim()) line += w;
        else { out.push(line.trimEnd()); line = w; }
      }
    }
    if (line.trim()) out.push(line.trimEnd());
    return out;
  }
  paragraph(s, x, y, size, width, leading, color, bold) {
    let cy = y;
    for (const ln of this.wrap(s, size, width, bold)) { this.text(ln, x, cy, size, color, "l", bold); cy -= leading; }
    return cy;
  }
  content() { return this.ops.join("\n"); }
}

/* ============================================================
   Doc — ตัวไหลเนื้อหา: จำตำแหน่งปัจจุบัน ขึ้นหน้าใหม่เอง ใส่หัว/ท้ายหน้า
   ทุกหน่วยเป็นมิลลิเมตรที่ผิวนอก แล้วแปลงเป็นพอยต์ตอนวาด
   ============================================================ */
export class Doc {
  constructor(fonts, opts) {
    this.fonts = fonts;
    this.o = Object.assign({ margin: 18, top: 24, bottom: 20, header: "", size: 10.5, leading: 5.2 }, opts || {});
    this.pages = []; this.toc = []; this.page = null; this.y = 0;
    this.figN = 0; this.chapter = "";
  }
  get W() { return 210 - 2 * this.o.margin }
  get x() { return this.o.margin }
  mm(v) { return v * MM }
  newPage(plain) {
    this.page = new DocPage(this.fonts); this.pages.push({ page: this.page, plain: !!plain, chapter: this.chapter });
    this.y = 297 - this.o.top;
    return this.page;
  }
  /* ต้องมีที่เหลือเท่านี้ ไม่งั้นขึ้นหน้าใหม่ — กันหัวข้อไปค้างท้ายหน้าโดยไม่มีเนื้อตาม */
  need(h) { if (!this.page || this.y - h < this.o.bottom) this.newPage(); }
  gap(h) { this.y -= h }
  /* ---------- หัวข้อ ---------- */
  h1(t, sub) {
    this.chapter = t;
    this.newPage();
    const p = this.page;
    p.rect(this.mm(0), this.mm(297 - 46), this.mm(210), this.mm(46), C.brand2);
    p.rect(this.mm(0), this.mm(297 - 46), this.mm(210), this.mm(1.2), C.c3);
    p.text(t, this.mm(this.x), this.mm(297 - 30), 24, C.white, "l", true);
    if (sub) p.text(sub, this.mm(this.x), this.mm(297 - 39), 11, [0.85, 0.9, 0.97], "l");
    this.toc.push({ level: 1, t, page: this.pages.length });
    this.y = 297 - 58;
  }
  h2(t) {
    this.need(34);
    this.gap(4);
    const p = this.page;
    p.rect(this.mm(this.x), this.mm(this.y - 7.2), this.mm(1.6), this.mm(8), C.brand);
    p.text(t, this.mm(this.x + 4), this.mm(this.y - 5.5), 14.5, C.brand2, "l", true);
    this.toc.push({ level: 2, t, page: this.pages.length });
    this.y -= 12;
  }
  h3(t) {
    this.need(16);
    this.gap(2);
    this.page.text(t, this.mm(this.x), this.mm(this.y - 4.5), 11.5, C.ink, "l", true);
    this.y -= 8;
  }
  /* ---------- เนื้อความ ---------- */
  p(t, opts) {
    opts = opts || {};
    const size = opts.size || this.o.size, lead = opts.leading || this.o.leading;
    const x = this.x + (opts.indent || 0), w = this.W - (opts.indent || 0);
    const lines = new DocPage(this.fonts).wrap(t, size, this.mm(w), opts.bold);
    let i = 0;
    while (i < lines.length) {
      this.need(lead * 2);
      const fit = Math.max(1, Math.floor((this.y - this.o.bottom) / lead));
      const chunk = lines.slice(i, i + fit);
      for (const ln of chunk) { this.page.text(ln, this.mm(x), this.mm(this.y - lead + 1.2), size, opts.color || C.ink, "l", opts.bold); this.y -= lead; }
      i += chunk.length;
    }
    this.y -= opts.after == null ? 2.2 : opts.after;
  }
  bullets(items, opts) {
    opts = opts || {};
    for (const it of items) {
      const isObj = typeof it === "object";
      const label = isObj ? it.b : null, body = isObj ? it.t : it;
      this.need(this.o.leading * 2);
      this.page.ellipse(this.mm(this.x + 2.2), this.mm(this.y - this.o.leading + 2.6), this.mm(0.8), this.mm(0.8), 0, null, opts.color || C.brand);
      const yStart = this.y;
      if (label) {
        const lw = this.page.textWidth(label + " ", this.o.size, true) / MM;
        this.page.text(label, this.mm(this.x + 6), this.mm(this.y - this.o.leading + 1.2), this.o.size, C.ink, "l", true);
        /* บรรทัดแรกต่อจากชื่อหัวข้อ บรรทัดถัดไปย่อหน้าเท่ากัน */
        const lines = new DocPage(this.fonts).wrap(body, this.o.size, this.mm(this.W - 6 - lw));
        if (lines.length) { this.page.text(lines[0], this.mm(this.x + 6 + lw), this.mm(this.y - this.o.leading + 1.2), this.o.size, C.ink); this.y -= this.o.leading; }
        const rest = lines.slice(1).join(" ");
        if (rest) this.p(rest, { indent: 6, after: 0 });
      } else this.p(body, { indent: 6, after: 0 });
      this.y -= 1.2;
    }
    this.y -= 1.5;
  }
  /* ขั้นตอนมีเลข — วงกลมน้ำเงินเลขขาว แบบเดียวกับหน้าเว็บ */
  steps(items) {
    let n = 0;
    for (const it of items) {
      n++;
      const label = typeof it === "object" ? it.b : null, body = typeof it === "object" ? it.t : it;
      this.need(12);
      const cy = this.y - 3.6;
      this.page.ellipse(this.mm(this.x + 3.6), this.mm(cy), this.mm(3.6), this.mm(3.6), 0, null, C.brand);
      this.page.text(String(n), this.mm(this.x + 3.6), this.mm(cy - 1.3), 9.5, C.white, "c", true);
      if (label) { this.page.text(label, this.mm(this.x + 10), this.mm(this.y - 4.2), this.o.size + 0.5, C.ink, "l", true); this.y -= this.o.leading + 0.6; }
      this.p(body, { indent: 10, after: 2.5 });
    }
  }
  /* กล่องหมายเหตุ — note (ฟ้า) · warn (เหลือง) · stop (แดง) · ok (เขียว) */
  callout(kind, title, body) {
    const col = { note: [C.brandt, C.brand], warn: [C.c3t, C.c3], stop: [C.c1t, C.c1], ok: [C.c4t, C.c4] }[kind] || [C.brandt, C.brand];
    const lines = new DocPage(this.fonts).wrap(body, this.o.size - 0.5, this.mm(this.W - 12));
    const h = 8 + lines.length * (this.o.leading - 0.3) + (title ? 5.5 : 0);
    this.need(h + 3);
    const p = this.page, y0 = this.y - h;
    p.rrect(this.mm(this.x), this.mm(y0), this.mm(this.W), this.mm(h), this.mm(2), col[0], null);
    p.rect(this.mm(this.x), this.mm(y0), this.mm(1.6), this.mm(h), col[1]);
    let cy = this.y - 5.5;
    if (title) { p.text(title, this.mm(this.x + 6), this.mm(cy - 1), this.o.size + 0.5, col[1], "l", true); cy -= 5.5; }
    for (const ln of lines) { p.text(ln, this.mm(this.x + 6), this.mm(cy - 1), this.o.size - 0.5, C.ink); cy -= this.o.leading - 0.3; }
    this.y = y0 - 3.5;
  }
  /* ภาพประกอบ — draw(page, x, y, w, h) วาดในกรอบที่ให้ (พอยต์) แล้วใส่คำบรรยายมีเลขภาพ */
  figure(hMM, caption, draw) {
    const capLines = caption ? new DocPage(this.fonts).wrap("ภาพ " + (this.figN + 1) + "  " + caption, 9, this.mm(this.W), true) : [];
    const total = hMM + 4 + capLines.length * 4.2;
    this.need(total + 2);
    this.figN++;
    const p = this.page, y0 = this.y - hMM;
    p.rrect(this.mm(this.x), this.mm(y0), this.mm(this.W), this.mm(hMM), this.mm(2), C.white, C.line, 0.6);
    draw(p, this.mm(this.x + 3), this.mm(y0 + 3), this.mm(this.W - 6), this.mm(hMM - 6));
    let cy = y0 - 4.2;
    capLines.forEach((ln, i) => {
      p.text(ln, this.mm(this.x), this.mm(cy), 9, C.ink2, "l", true);
      cy -= 4.2;
    });
    this.y = cy - 1;
  }
  /* ตารางง่าย ๆ หัวเทา เส้นบาง — cols: [{t,w(mm)}] rows: [[...]] */
  table(cols, rows, opts) {
    opts = opts || {};
    const size = opts.size || this.o.size - 1, lead = opts.leading || 4.6;
    const widths = cols.map((c) => c.w);
    const drawHead = () => {
      this.need(9);
      this.page.rect(this.mm(this.x), this.mm(this.y - 7), this.mm(this.W), this.mm(7), C.surf2);
      let cx = this.x;
      cols.forEach((c, i) => { this.page.text(c.t, this.mm(cx + 2), this.mm(this.y - 4.8), size - 0.5, C.ink2, "l", true); cx += widths[i]; });
      this.page.line(this.mm(this.x), this.mm(this.y - 7), this.mm(this.x + this.W), this.mm(this.y - 7), 0.6, C.line);
      this.y -= 7;
    };
    drawHead();
    for (const r of rows) {
      const cells = r.map((cell, i) => new DocPage(this.fonts).wrap(String(cell == null ? "—" : cell), size, this.mm(widths[i] - 4)));
      const nLines = Math.max(...cells.map((c) => c.length));
      const h = nLines * lead + 3;
      if (this.y - h < this.o.bottom) { this.newPage(); drawHead(); }
      let cx = this.x;
      cells.forEach((lines, i) => {
        let cy = this.y - lead + 0.6;
        for (const ln of lines) { this.page.text(ln, this.mm(cx + 2), this.mm(cy), size, C.ink, "l", i === 0 && opts.boldFirst); cy -= lead; }
        cx += widths[i];
      });
      this.y -= h;
      this.page.line(this.mm(this.x), this.mm(this.y), this.mm(this.x + this.W), this.mm(this.y), 0.4, C.line2);
    }
    this.y -= 3;
  }
  /* ---------- หัว/ท้ายหน้า ใส่ตอนท้ายเมื่อรู้เลขหน้าแล้ว ---------- */
  finish(offset) {
    this.pages.forEach((pg, i) => {
      const n = i + 1 + (offset || 0);
      const p = pg.page;
      if (pg.plain) return;
      p.text(this.o.header, this.mm(this.x), this.mm(297 - 12), 8.5, C.ink3);
      if (pg.chapter) p.text(pg.chapter, this.mm(210 - this.x), this.mm(297 - 12), 8.5, C.ink3, "r");
      p.line(this.mm(this.x), this.mm(297 - 14.5), this.mm(210 - this.x), this.mm(297 - 14.5), 0.4, C.line);
      p.text(String(n), this.mm(105), this.mm(10), 9, C.ink2, "c");
    });
    return this.pages.map((x) => x.page);
  }
}

/* ============================================================
   ประกอบไฟล์ PDF — สองฟอนต์ (ปกติ /F1, หนา /F2)
   โครงเดียวกับ pdf.mjs แต่ทรัพยากรฟอนต์มีสองชุด
   ============================================================ */
export function buildDoc(pages, fonts, meta) {
  const objs = []; const add = (b) => { objs.push(b); return objs.length; };
  const nCatalog = add(null), nPages = add(null);
  const pageNums = [], contentNums = [];
  for (const p of pages) {
    const c = Buffer.from(p.content(), "latin1");
    contentNums.push(add(`<</Length ${c.length}>>\nstream\n${c.toString("latin1")}\nendstream`));
    pageNums.push(add(null));
  }
  const fontObjs = {};
  for (const key of ["reg", "bold"]) {
    const font = fonts[key];
    const nFile = add(null), nDescr = add(null), nCID = add(null), nFont = add(null);
    const up = font.unitsPerEm, sc = (v) => Math.round(v * 1000 / up);
    const W = "[0 [" + font.widths.map((w) => sc(w)).join(" ") + "]]";
    const name = key === "reg" ? "EmbeddedThai" : "EmbeddedThaiBold";
    objs[nDescr - 1] = `<</Type/FontDescriptor/FontName/${name}/Flags ${key === "bold" ? 262148 : 4}` +
      `/FontBBox[${sc(font.bbox[0])} ${sc(font.bbox[1])} ${sc(font.bbox[2])} ${sc(font.bbox[3])}]` +
      `/ItalicAngle 0/Ascent ${sc(font.ascent)}/Descent ${sc(font.descent)}/CapHeight ${sc(font.ascent)}/StemV ${key === "bold" ? 140 : 80}/FontFile2 ${nFile} 0 R>>`;
    objs[nCID - 1] = `<</Type/Font/Subtype/CIDFontType2/BaseFont/${name}/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>` +
      `/FontDescriptor ${nDescr} 0 R/DW 1000/W ${W}/CIDToGIDMap/Identity>>`;
    objs[nFont - 1] = `<</Type/Font/Subtype/Type0/BaseFont/${name}/Encoding/Identity-H/DescendantFonts[${nCID} 0 R]>>`;
    fontObjs[key] = { nFile, nFont, buf: font.buf };
  }
  objs[nCatalog - 1] = `<</Type/Catalog/Pages ${nPages} 0 R>>`;
  objs[nPages - 1] = `<</Type/Pages/Kids[${pageNums.map((n) => n + " 0 R").join(" ")}]/Count ${pageNums.length}>>`;
  pages.forEach((p, i) => {
    objs[pageNums[i] - 1] = `<</Type/Page/Parent ${nPages} 0 R/MediaBox[0 0 ${f(A4.w)} ${f(A4.h)}]` +
      `/Resources<</Font<</F1 ${fontObjs.reg.nFont} 0 R/F2 ${fontObjs.bold.nFont} 0 R>>>>/Contents ${contentNums[i]} 0 R>>`;
  });
  const chunks = []; let pos = 0;
  const push = (b) => { const x = Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1"); chunks.push(x); pos += x.length; };
  const offsets = new Array(objs.length + 1).fill(0);
  push(`%PDF-1.4\n%\xe2\xe3\xcf\xd3\n`);
  const fileNums = { [fontObjs.reg.nFile]: fontObjs.reg.buf, [fontObjs.bold.nFile]: fontObjs.bold.buf };
  for (let i = 1; i <= objs.length; i++) {
    offsets[i] = pos;
    if (fileNums[i]) {
      const buf = fileNums[i];
      push(`${i} 0 obj\n<</Length ${buf.length}/Length1 ${buf.length}>>\nstream\n`); push(buf); push(`\nendstream\nendobj\n`);
    } else push(`${i} 0 obj\n${objs[i - 1]}\nendobj\n`);
  }
  const xref = pos;
  let x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) x += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  const info = meta && meta.title ? `/Title(${meta.title.replace(/[()\\]/g, "")})` : "";
  x += `trailer\n<</Size ${objs.length + 1}/Root ${nCatalog} 0 R${info ? `/Info<<${info}>>` : ""}>>\nstartxref\n${xref}\n%%EOF\n`;
  push(x);
  return Buffer.concat(chunks);
}

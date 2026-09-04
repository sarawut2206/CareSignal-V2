/* ============================================================
   manual-art.mjs — ภาพประกอบเวกเตอร์สำหรับคู่มือ
   ------------------------------------------------------------
   ทำไมวาดเอง ไม่ใช้ภาพถ่ายหน้าจอ
     ภาพถ่ายหน้าจอล้าสมัยทันทีที่แอปเปลี่ยน และแสดงข้อมูลจำลองที่คนอ่าน
     อาจเข้าใจว่าเป็นของจริง ภาพวาดบอกได้เฉพาะสิ่งที่ต้องบอก: ท่าที่ถูก
     ระยะที่ถูก และตำแหน่งของป้าย · พิมพ์ขาวดำก็ยังอ่านออก
   ทุกฟังก์ชันรับกรอบ (x, y, w, h) เป็นพอยต์ มุมซ้ายล่างตามระบบ PDF
   และวาดให้พอดีกรอบนั้น ผู้เรียกไม่ต้องรู้ขนาดภายใน
   ============================================================ */
import { MM, C } from "./doc.mjs";
import { markerRects, SHEET } from "./make-marker-pdf.mjs";

const mm = (v) => v * MM;

/* ---------- คน: ท่าต่าง ๆ · scale = ความสูงคนเป็นพอยต์ ---------- */
export function person(p, cx, base, H, o) {
  o = o || {};
  const col = o.color || C.ink, lw = o.lw || Math.max(1.2, H * 0.028);
  const head = H * 0.09, neck = base + H * 0.98 - head * 2;
  const shoulder = neck - H * 0.02, hip = base + H * 0.5, knee = base + H * 0.27;
  const sideOn = o.side !== false;          /* หันข้าง = ค่าเริ่มต้น เพราะกล้องต้องเห็นแบบนี้ */
  p.ellipse(cx, neck + head, head, head, lw, col, o.fill || C.white);
  if (o.sitting) {
    /* นั่ง: ลำตัวตั้ง ต้นขาไปข้างหน้า หน้าแข้งลง */
    const seat = base + H * 0.46, kneeX = cx + H * 0.26;
    p.poly([[cx, shoulder], [cx, seat]], lw, col);
    p.poly([[cx, seat], [kneeX, seat], [kneeX, base]], lw, col);
    if (o.armsCrossed) { p.poly([[cx, shoulder - H * 0.05], [cx + H * 0.14, shoulder - H * 0.12], [cx - H * 0.02, shoulder - H * 0.2]], lw, col); }
    else p.poly([[cx, shoulder - H * 0.04], [kneeX - H * 0.04, shoulder - H * 0.22]], lw, col);
    return;
  }
  /* ยืน */
  p.poly([[cx, shoulder], [cx, hip]], lw, col);
  if (o.armsCrossed) {
    p.poly([[cx, shoulder - H * 0.04], [cx + H * 0.13, shoulder - H * 0.13], [cx - H * 0.04, shoulder - H * 0.2]], lw, col);
    p.poly([[cx, shoulder - H * 0.04], [cx - H * 0.13, shoulder - H * 0.13], [cx + H * 0.04, shoulder - H * 0.2]], lw, col);
  } else if (o.handUp === 1) {
    p.poly([[cx, shoulder - H * 0.04], [cx + H * 0.12, shoulder + H * 0.02], [cx + H * 0.14, shoulder + H * 0.2]], lw, col);
    p.poly([[cx, shoulder - H * 0.04], [cx - H * 0.06, shoulder - H * 0.26]], lw, col);
  } else if (o.handUp === 2) {
    p.poly([[cx, shoulder - H * 0.04], [cx + H * 0.12, shoulder + H * 0.02], [cx + H * 0.14, shoulder + H * 0.2]], lw, col);
    p.poly([[cx, shoulder - H * 0.04], [cx - H * 0.12, shoulder + H * 0.02], [cx - H * 0.14, shoulder + H * 0.2]], lw, col);
  } else if (o.cane) {
    p.poly([[cx, shoulder - H * 0.04], [cx + H * 0.14, shoulder - H * 0.24]], lw, col);
    p.poly([[cx + H * 0.14, shoulder - H * 0.24], [cx + H * 0.16, base]], lw * 0.8, C.ink2);
    p.poly([[cx, shoulder - H * 0.04], [cx - H * 0.05, shoulder - H * 0.26]], lw, col);
  } else {
    p.poly([[cx, shoulder - H * 0.04], [cx + (sideOn ? H * 0.05 : H * 0.14), shoulder - H * 0.26]], lw, col);
    p.poly([[cx, shoulder - H * 0.04], [cx - (sideOn ? H * 0.05 : H * 0.14), shoulder - H * 0.26]], lw, col);
  }
  if (o.oneLeg) {
    /* ยืนขาเดียว: ขาหนึ่งลงพื้น อีกขางอเข่ายกขึ้น */
    p.poly([[cx, hip], [cx + H * 0.02, knee], [cx + H * 0.02, base]], lw, col);
    p.poly([[cx, hip], [cx - H * 0.14, hip - H * 0.16], [cx - H * 0.08, hip - H * 0.36]], lw, col);
  } else {
    const spread = o.spread == null ? (sideOn ? H * 0.03 : H * 0.09) : o.spread;
    p.poly([[cx, hip], [cx - spread, base]], lw, col);
    p.poly([[cx, hip], [cx + spread, base]], lw, col);
  }
  if (o.marker) {                          /* ป้ายบนอก และป้ายบนเอว */
    const s = H * 0.07;
    p.rect(cx - s / 2, shoulder - H * 0.16 - s / 2, s, s, C.ink);
    p.rect(cx - s * 0.3, shoulder - H * 0.16 - s * 0.3, s * 0.6, s * 0.6, C.white);
    p.rect(cx - s / 2, hip + H * 0.03 - s / 2, s, s, C.ink);
    p.rect(cx - s * 0.3, hip + H * 0.03 - s * 0.3, s * 0.6, s * 0.6, C.white);
  }
}
/* ---------- มือถือตั้งพิงผนัง (เห็นจากด้านข้าง) ---------- */
export function phone(p, x, base, h, tilt) {
  const w = h * 0.5, t = tilt == null ? h * 0.18 : tilt;
  p.polyFill([[x, base], [x + w * 0.35, base], [x + w * 0.35 + t, base + h], [x + t, base + h]], C.ink);
  p.polyFill([[x + w * 0.05, base + h * 0.06], [x + w * 0.3, base + h * 0.06], [x + w * 0.3 + t * 0.88, base + h * 0.94], [x + w * 0.05 + t * 0.88, base + h * 0.94]], C.brandt);
  p.ellipse(x + w * 0.18 + t * 0.9, base + h * 0.9, h * 0.025, h * 0.025, 0, null, C.ink);
}
/* ---------- เก้าอี้พนักพิง (ด้านข้าง) ---------- */
export function chair(p, x, base, h) {
  const w = h * 0.55, seat = base + h * 0.48, lw = Math.max(1.2, h * 0.03);
  p.poly([[x, base], [x, seat], [x + w, seat], [x + w, base]], lw, C.ink2);
  p.poly([[x, seat], [x, base + h]], lw, C.ink2);
  p.rect(x - lw / 2, base + h * 0.6, lw * 1.6, h * 0.36, C.ink2);
}
/* ---------- ป้าย ArUco จริงจากพจนานุกรม ย่อส่วน · id = รหัสป้าย ---------- */
export function marker(p, id, x, y, size) {
  const { rects, total } = markerRects(id, 0, 0, 100);
  const k = size / total;
  for (const r of rects) p.rect(x + r.x * k, y + r.y * k, r.w * k, r.h * k, r.white ? C.white : C.ink);
  p.frame(x, y, size, size, 0.4, C.line);
}
/* ---------- ป้ายตั้งพื้น มีฐานพับ (ด้านข้าง) ---------- */
export function standMarker(p, id, x, base, h) {
  p.polyFill([[x, base], [x + h * 0.7, base], [x + h * 0.7, base + h * 0.06], [x, base + h * 0.06]], C.line);
  marker(p, id, x + h * 0.05, base + h * 0.08, h * 0.6);
}
/* ---------- ลูกศรบอกระยะพร้อมข้อความ ---------- */
export function dim(p, x1, x2, y, label) {
  p.arrow(x1 + 4, y, x2 - 4, y, 0.8, C.ink2); p.arrow(x2 - 4, y, x1 + 4, y, 0.8, C.ink2);
  p.line(x1, y - mm(2), x1, y + mm(2), 0.6, C.ink2); p.line(x2, y - mm(2), x2, y + mm(2), 0.6, C.ink2);
  const w = p.textWidth(label, 8.5, true);
  p.rect((x1 + x2) / 2 - w / 2 - 3, y - 4, w + 6, 9, C.white);
  p.text(label, (x1 + x2) / 2, y - 2.5, 8.5, C.ink, "c", true);
}
export function label(p, x, y, t, o) {
  o = o || {};
  const s = o.size || 8.5, w = p.textWidth(t, s, o.bold) + 8, h = s + 5;
  p.rrect(x - (o.align === "c" ? w / 2 : 0), y - 3, w, h, 2, o.bg || C.surf2, o.stroke || C.line, 0.5);
  p.text(t, o.align === "c" ? x : x + 4, y, s, o.color || C.ink, o.align === "c" ? "c" : "l", o.bold);
}

/* ============================================================
   ภาพประกอบสำเร็จรูป — แต่ละอันวาดให้พอดีกรอบ (x, y, w, h)
   ============================================================ */
/* จัดที่: มือถือพิงผนัง ห่างคน 2–3 เมตร เห็นทั้งตัว เก้าอี้ข้างคน */
export function figSetup(p, x, y, w, h) {
  const base = y + h * 0.2, H = h * 0.62;
  p.line(x, base, x + w, base, 0.8, C.line2);
  phone(p, x + w * 0.06, base, H * 0.38);
  /* กรวยมุมมองของกล้อง */
  p.line(x + w * 0.1, base + H * 0.3, x + w * 0.52, base + H * 1.02, 0.6, C.brand, 3);
  p.line(x + w * 0.1, base + H * 0.3, x + w * 0.52, base, 0.6, C.brand, 3);
  chair(p, x + w * 0.62, base, H * 0.55);
  person(p, x + w * 0.84, base, H, { marker: true });
  dim(p, x + w * 0.1, x + w * 0.84, y + h * 0.08, "2–3 เมตร");
  label(p, x + w * 0.06, base + H * 0.5, "มือถือพิงผนัง", { size: 8 });
  label(p, x + w * 0.62, base + H * 0.62, "เห็นตั้งแต่ศีรษะถึงเท้า", { size: 8 });
}
/* ป้ายบนตัว: หน้าอก และเอว */
export function figStraps(p, x, y, w, h) {
  const H = h * 0.9, cx = x + w * 0.3;
  person(p, cx, y + h * 0.05, H, { side: false, marker: true });
  const ms = w * 0.16;
  marker(p, 0, x + w * 0.58, y + h * 0.52, ms); label(p, x + w * 0.58 + ms + 6, y + h * 0.52 + ms * 0.4, "ป้ายหน้าอก · รหัส 0", { size: 8.5, bold: true });
  marker(p, 1, x + w * 0.58, y + h * 0.1, ms); label(p, x + w * 0.58 + ms + 6, y + h * 0.1 + ms * 0.4, "ป้ายเอว · รหัส 1", { size: 8.5, bold: true });
  p.line(cx + H * 0.035, y + h * 0.05 + H * 0.5 + H * 0.03, x + w * 0.58, y + h * 0.1 + ms / 2, 0.5, C.ink3, 2);
  p.line(cx + H * 0.035, y + h * 0.05 + H * 0.96 - H * 0.16 - H * 0.02, x + w * 0.58, y + h * 0.52 + ms / 2, 0.5, C.ink3, 2);
}
/* ลุกนั่ง 5 ครั้ง: นั่งกอดอก → ยืนกอดอก */
export function figSitToStand(p, x, y, w, h) {
  const base = y + h * 0.18, H = h * 0.62;
  p.line(x, base, x + w, base, 0.8, C.line2);
  chair(p, x + w * 0.16, base, H * 0.55);
  person(p, x + w * 0.22, base, H, { sitting: true, armsCrossed: true });
  p.arrow(x + w * 0.44, base + H * 0.55, x + w * 0.56, base + H * 0.55, 1.2, C.brand);
  chair(p, x + w * 0.66, base, H * 0.55);
  person(p, x + w * 0.79, base, H, { armsCrossed: true });
  label(p, x + w * 0.22, y + h * 0.04, "นั่งพิงพนัก กอดอก", { align: "c", size: 8 });
  label(p, x + w * 0.79, y + h * 0.04, "ลุกยืนจนสุด แล้วนั่งลง ×5", { align: "c", size: 8 });
}
/* เส้นทาง TUG: เก้าอี้ · ป้าย 0 ม. · 1 ม. · 3 ม. · หมุนกลับตรงป้าย */
export function figTUG(p, x, y, w, h) {
  const base = y + h * 0.3, H = h * 0.5;
  p.line(x, base, x + w, base, 0.8, C.line2);
  chair(p, x + w * 0.05, base, H * 0.55);
  person(p, x + w * 0.2, base, H, { cane: true, marker: true });
  const pos = [[0.13, 4, "จุดเริ่มต้น"], [0.4, 5, "จุด 1 เมตร"], [0.88, 3, "จุด 3 เมตร"]];
  for (const [t, id, nm] of pos) { standMarker(p, id, x + w * t, base, H * 0.42); label(p, x + w * t + H * 0.15, y + h * 0.06, nm, { align: "c", size: 8 }); }
  /* ทางไป (บน) และทางกลับ (ล่าง) */
  p.arrow(x + w * 0.27, base + H * 1.12, x + w * 0.86, base + H * 1.12, 1, C.brand);
  p.arrow(x + w * 0.86, base + H * 1.0, x + w * 0.27, base + H * 1.0, 1, C.c4);
  p.ellipse(x + w * 0.905, base + H * 1.06, H * 0.12, H * 0.12, 1, C.c1, null);
  label(p, x + w * 0.905, base + H * 1.3, "หมุนกลับตรงป้าย", { align: "c", size: 8, bold: true, color: C.c1, stroke: C.c1 });
  dim(p, x + w * 0.13 + H * 0.15, x + w * 0.88 + H * 0.15, y + h * 0.16, "3 เมตร (วัดด้วยตลับเมตร)");
}
/* สี่ท่าทรงตัว: มุมมองจากด้านบนของเท้าสองข้าง + คนหันข้าง */
export function figStances(p, x, y, w, h) {
  const names = ["1 เท้าชิด", "2 กึ่งต่อเท้า", "3 ต่อเท้าเป็นเส้นตรง", "4 ยืนขาเดียว"];
  const cw = w / 4;
  for (let i = 0; i < 4; i++) {
    const cx = x + cw * i + cw / 2, base = y + h * 0.42, H = h * 0.44;
    person(p, cx, base, H, { oneLeg: i === 3, spread: i === 0 ? H * 0.02 : H * 0.04 });
    /* รอยเท้า (มองจากบน) */
    const fy = y + h * 0.24, fl = cw * 0.2, fw = fl * 0.42;
    const foot = (fx, fyy) => { p.ellipse(fx, fyy, fw / 2, fl / 2, 0.7, C.ink2, C.surf2); p.ellipse(fx, fyy + fl * 0.34, fw * 0.36, fl * 0.16, 0.5, C.ink2, C.surf2); };
    if (i === 0) { foot(cx - fw * 0.6, fy); foot(cx + fw * 0.6, fy); }
    if (i === 1) { foot(cx - fw * 0.6, fy - fl * 0.25); foot(cx + fw * 0.6, fy + fl * 0.25); }
    if (i === 2) { foot(cx, fy - fl * 0.5); foot(cx, fy + fl * 0.5); }
    if (i === 3) { foot(cx, fy); p.ellipse(cx + fw * 1.4, fy + fl * 0.2, fw / 2, fl / 2, 0.6, C.line, null); }
    p.text(names[i], cx, y + h * 0.92, 8.5, C.ink, "c", true);
    if (i === 3) label(p, cx, y + h * 0.82, "ต้องมีคนอยู่ข้าง ๆ", { align: "c", size: 7.5, color: C.c1, stroke: C.c1, bg: C.c1t });
  }
  p.text("ยืนหันข้างให้กล้อง · ลืมตา · ไม่จับสิ่งใด · ท่าละ 10 วินาที", x + w / 2, y + h * 0.04, 8, C.ink2, "c");
}
/* คำสั่งด้วยมือ: ยกมือเดียว / ยกสองมือ */
export function figHands(p, x, y, w, h) {
  const base = y + h * 0.18, H = h * 0.62;
  person(p, x + w * 0.25, base, H, { side: false, handUp: 1 });
  person(p, x + w * 0.72, base, H, { side: false, handUp: 2 });
  label(p, x + w * 0.25, y + h * 0.04, "ยกมือเดียวค้าง 1 วินาที = คำสั่งหลัก (เริ่ม/บันทึก/ผ่าน)", { align: "c", size: 7.5 });
  label(p, x + w * 0.72, y + h * 0.04, "ยกสองมือ = คำสั่งตรงข้าม (ไม่ผ่าน/ทำใหม่/หยุด)", { align: "c", size: 7.5 });
}
/* ปุ่มหยุดทันทีบนจอมือถือ */
export function figStop(p, x, y, w, h) {
  const pw = w * 0.26, ph = h * 0.92, px = x + w * 0.1, py = y + h * 0.04;
  p.rrect(px, py, pw, ph, 6, C.ink, null);
  p.rrect(px + 3, py + 3, pw - 6, ph - 6, 4, C.white, null);
  p.rect(px + 3, py + ph - 3 - ph * 0.42, pw - 6, ph * 0.42, C.ink2);
  p.text("กล้อง", px + pw / 2, py + ph - ph * 0.24, 8, C.white, "c");
  p.rrect(px + 8, py + ph * 0.3, pw - 16, ph * 0.12, 3, C.c1, null);
  p.text("■ หยุดทันที", px + pw / 2, py + ph * 0.34, 8, C.white, "c", true);
  p.rrect(px + 8, py + ph * 0.12, pw - 16, ph * 0.1, 3, C.brand, null);
  p.text("เริ่มท่าที่ 2", px + pw / 2, py + ph * 0.155, 7.5, C.white, "c", true);
  const tx = x + w * 0.45;
  p.text("ปุ่มหยุดอยู่บนจอตลอด ตั้งแต่ตอนจัดท่า", tx, y + h * 0.78, 9.5, C.ink, "l", true);
  const reasons = ["เสียสมดุล เซ หรือจะล้ม", "เวียนศีรษะ หน้ามืด", "ต้องจับพยุงหรือยึดเกาะ", "เจ็บ ปวด หรือไม่สบาย", "เหนื่อย ขอพัก"];
  reasons.forEach((r, i) => { p.ellipse(tx + 3, y + h * (0.64 - i * 0.11) + 2, 1.5, 1.5, 0, null, C.c1); p.text(r, tx + 9, y + h * (0.64 - i * 0.11), 8.5, C.ink); });
  p.text("กดแล้วนาฬิกาหยุดก่อน จึงค่อยถามเหตุผล · จบทั้งชุด ไม่ไปท่าถัดไป", tx, y + h * 0.06, 8, C.ink2);
}
/* หน้ารายการมาตรฐาน: หัวหน้า · KPI · ตาราง (ภาพจำลองหน้าจอ) */
export function figScreenList(p, x, y, w, h) {
  p.rrect(x, y, w, h, 3, C.surf2, C.line, 0.6);
  const side = w * 0.17;
  p.rect(x, y, side, h, C.white); p.line(x + side, y, x + side, y + h, 0.5, C.line);
  ["บอร์ดวันนี้", "งานของฉัน", "คิวงาน", "ติดตามการส่งต่อ", "ทบทวนยา", "พอร์ต", "รายงาน", "บันทึกตรวจสอบ"].forEach((t, i) => {
    const yy = y + h - 12 - i * 9;
    if (i === 2) p.rrect(x + 3, yy - 3, side - 6, 8, 1.5, C.brandt, null);
    p.text(t, x + 7, yy, 6.5, i === 2 ? C.brand : C.ink2, "l", i === 2);
  });
  const cx = x + side + 6, cw = w - side - 12;
  p.text("งานวันนี้", cx, y + h - 11, 10, C.ink, "l", true);
  label(p, cx + cw - 78, y + h - 11, "🏥 หน่วยบริการ", { size: 6 }); label(p, cx + cw - 36, y + h - 11, "รายการ 5", { size: 6 }); label(p, cx + cw - 12, y + h - 11, "11:02", { size: 6 });
  const tones = [C.c1, C.c2, C.c1, C.c3, C.c3, C.ink3], nums = ["1", "3", "1", "2", "2", "1"], labs = ["เคสแดงใหม่", "ต้องติดต่อวันนี้", "เกินกำหนด", "รอผลส่งต่อ", "รอทบทวนยา", "ติดต่อไม่ได้"];
  const kw = (cw - 10) / 6;
  for (let i = 0; i < 6; i++) {
    const kx = cx + i * (kw + 2), ky = y + h - 34;
    p.rrect(kx, ky, kw, 16, 1.5, C.white, C.line, 0.4); p.rect(kx, ky, 1.6, 16, tones[i]);
    p.text(nums[i], kx + 5, ky + 7, 9, tones[i], "l", true); p.text(labs[i], kx + 5, ky + 2.5, 5, C.ink2);
  }
  const ty = y + h - 40, th = ty - (y + 4);
  p.rrect(cx, y + 4, cw, th, 1.5, C.white, C.line, 0.4);
  p.rect(cx, ty - 7, cw, 7, C.surf2);
  p.rrect(cx + 3, ty - 6, cw * 0.32, 5, 1, C.white, C.line, 0.3); p.text("ค้นหา รหัส ชื่อ", cx + 6, ty - 4.6, 5, C.ink3);
  const cols = ["ระดับ", "รหัส", "ผู้เอาประกัน", "ขั้นตอน", "งานถัดไป", "กำหนด", "การกระทำ"], cwid = [0.11, 0.09, 0.17, 0.14, 0.2, 0.12, 0.17];
  let hx = cx + 3; const hy = ty - 12;
  p.rect(cx, hy - 2, cw, 6, C.surf2);
  cols.forEach((c, i) => { p.text(c, hx, hy, 5, C.ink2, "l", true); hx += cw * cwid[i]; });
  const rows = [[C.c1, "ต้องทบทวนด่วน", "P-0412", "สมชาย ใ.", "ทบทวนสัญญาณ", "ส่งเภสัชกรทบทวนยา", "เกินกำหนด 5 ชม.", true],
                [C.c1, "ต้องทบทวนด่วน", "P-0501", "บุญมี จ.", "ทบทวนสัญญาณ", "โทรติดต่อ", "ภายใน 3 ชม.", false],
                [C.c2, "ต้องทบทวน", "P-0377", "ประนอม ว.", "ติดต่อ/วางแผน", "โทรติดต่อ", "ภายใน 20 ชม.", false],
                [C.c3, "เฝ้าสังเกต", "P-0288", "สมหญิง ก.", "ส่งต่อ", "รอผลส่งต่อ", "ภายใน 60 ชม.", false],
                [C.c4, "ตามรอบ", "P-0190", "วิชัย ส.", "ติดตามผล", "โทรติดตาม", "ภายใน 4 วัน", false]];
  rows.forEach((r, ri) => {
    const ry = hy - 9 - ri * 8.2;
    if (r[7]) p.rect(cx, ry - 3, cw, 8, C.c1t);
    let rx = cx + 3;
    p.rrect(rx, ry - 1.5, cw * 0.09, 4.5, 2.2, r[0], null); p.text(r[1], rx + cw * 0.045, ry - 0.3, 3.8, C.white, "c", true); rx += cw * cwid[0];
    p.text(r[2], rx, ry, 5, C.ink, "l", true); rx += cw * cwid[1];
    p.text(r[3], rx, ry, 5, C.ink); rx += cw * cwid[2];
    p.text(r[4], rx, ry, 5, C.ink); rx += cw * cwid[3];
    p.text(r[5], rx, ry, 5, C.ink); rx += cw * cwid[4];
    p.text(r[6], rx, ry, 5, r[7] ? C.c1 : C.ink, "l", r[7]); rx += cw * cwid[5];
    p.rrect(rx, ry - 1.5, cw * 0.07, 4.5, 1, C.brand, null); p.text("เปิดเคส", rx + cw * 0.035, ry - 0.3, 3.8, C.white, "c", true);
  });
}
/* บอร์ดวอร์ด: การ์ดเคสหัวสีระดับ */
export function figWard(p, x, y, w, h) {
  p.rrect(x, y, w, h, 3, [0.933, 0.949, 0.969], C.line, 0.6);
  p.rect(x, y + h - 12, w, 12, C.white); p.rect(x, y + h - 12.8, w, 0.8, C.brand);
  p.text("CareSignal Staff", x + 5, y + h - 8, 7.5, C.brand2, "l", true);
  p.text("เคสค้าง 6 · เกินกำหนด 1", x + 50, y + h - 8, 6, C.ink2);
  p.rrect(x + w - 34, y + h - 12, 34, 12, 0, C.brand2, null); p.text("ทดสอบทีม", x + w - 17, y + h - 8, 6.5, C.white, "c", true);
  const stages = ["ทั้งหมด 6", "ทบทวนสัญญาณ 2", "ติดต่อ/วางแผน 2", "ส่งต่อ 1", "ติดตามผล 1"];
  stages.forEach((t, i) => { const sx = x + i * (w / 5); p.text(t, sx + w / 10, y + h - 19, 5.5, i === 0 ? C.brand : C.ink2, "c", i === 0); if (i === 0) p.rect(sx, y + h - 23, w / 5, 0.8, C.brand); });
  const cards = [[C.c1, "P-0412", "สมชาย ใ.", "78 ปี · เคสใหม่", "ส่งเภสัชกรทบทวนยา", "เกินกำหนด 5 ชม.", C.c1],
                 [C.c1, "P-0501", "บุญมี จ.", "75 ปี · กำลังทบทวน", "โทรติดต่อ", "ติดต่อไม่ได้ 2 ครั้ง", C.c3],
                 [C.c2, "P-0377", "ประนอม ว.", "71 ปี · ติดต่อแล้ว", "โทรติดต่อ", "ภายใน 20 ชม.", C.ink2],
                 [C.c3, "P-0288", "สมหญิง ก.", "83 ปี · ส่งต่อแล้ว", "รอผลส่งต่อ", "ภายใน 60 ชม.", C.ink2],
                 [C.c3, "P-0233", "อำพร น.", "80 ปี · ตกลงแผนแล้ว", "โทรติดต่อ", "ภายใน 40 ชม.", C.ink2],
                 [C.c4, "P-0190", "วิชัย ส.", "69 ปี · ถึงกำหนดติดตาม", "โทรติดตามผล", "ติดต่อแล้ว", C.c4]];
  const cw = (w * 0.74 - 14) / 3, ch = (h - 40) / 2 - 3;
  cards.forEach((c, i) => {
    const cx = x + 4 + (i % 3) * (cw + 3), cy = y + h - 28 - Math.floor(i / 3) * (ch + 3) - ch;
    p.rrect(cx, cy, cw, ch, 1.5, C.white, C.line, 0.4);
    p.rect(cx, cy + ch - 6, cw, 6, c[0]); p.rect(cx, cy + ch - 6, cw * 0.36, 6, C.brand2);
    p.text(c[1], cx + 2, cy + ch - 4.2, 5, C.white, "l", true);
    p.text(c[2], cx + 3, cy + ch - 12, 6.5, C.ink, "l", true); p.text(c[3], cx + 3, cy + ch - 17, 4.5, C.ink2);
    p.text(c[4], cx + 3, cy + ch - 23, 5, C.ink, "l", true); p.text(c[5], cx + 3, cy + ch - 28, 4.5, c[6]);
  });
  const sx = x + w * 0.76 + 2, sw = w * 0.24 - 6;
  p.rrect(sx, y + 4, sw, h - 30, 1.5, C.white, C.line, 0.4);
  p.text("ภาพรวมพอร์ต", sx + 3, y + h - 31, 5, C.ink3, "l", true);
  [["2", "ต้องทบทวนด่วน", C.c1], ["1", "ต้องทบทวน", C.c2], ["2", "เฝ้าสังเกต", C.c3], ["1", "ตามรอบ", C.c4]].forEach((k, i) => {
    const kx = sx + 3 + (i % 2) * (sw / 2 - 2), ky = y + h - 46 - Math.floor(i / 2) * 13;
    p.rrect(kx, ky, sw / 2 - 5, 11, 1, C.surf2, C.line2, 0.3); p.text(k[0], kx + 2, ky + 4.5, 7.5, k[2], "l", true); p.text(k[1], kx + 2, ky + 1.2, 3.8, C.ink2);
  });
  p.text("ต้องดูก่อน", sx + 3, y + h - 60, 5, C.ink3, "l", true);
  p.text("P-0412 · ต้องทบทวนด่วน", sx + 3, y + h - 66, 4.5, C.c1, "l", true); p.text("ส่งเภสัชกรทบทวนยา", sx + 3, y + h - 70.5, 4.2, C.ink2);
  p.text("P-0501 · ต้องทบทวนด่วน", sx + 3, y + h - 77, 4.5, C.c1, "l", true); p.text("โทรติดต่อ", sx + 3, y + h - 81.5, 4.2, C.ink2);
  p.rect(x, y, w, 9, [0.867, 0.89, 0.925]);
  ["คิวเคส", "ติดตามการส่งต่อ", "ทบทวนยา", "พอร์ตความเสี่ยง", "รายงาน"].forEach((t, i) => { const bx = x + 3 + i * 26; p.rrect(bx, y + 1.8, 24, 5.4, 1, i === 0 ? C.brand2 : C.white, C.line, 0.3); p.text(t, bx + 12, y + 3.4, 4.2, i === 0 ? C.white : C.ink, "c"); });
}
/* วงจรงาน: สัญญาณ → ทีมดูแล → ผู้เชี่ยวชาญ → ผลกลับ → เว็บ */
export function figPipeline(p, x, y, w, h, steps, active) {
  const n = steps.length, bw = (w - (n - 1) * 8) / n;
  steps.forEach((s, i) => {
    const bx = x + i * (bw + 8), on = active == null || i <= active;
    p.rrect(bx, y + h * 0.25, bw, h * 0.5, 3, on ? C.brandt : C.surf2, on ? C.brand : C.line, 0.6);
    p.ellipse(bx + 8, y + h * 0.5, 4.2, 4.2, 0, null, on ? C.brand : C.line);
    p.text(String(i + 1), bx + 8, y + h * 0.5 - 1.6, 7, C.white, "c", true);
    const lines = p.wrap(s, 7.5, bw - 20, true);
    lines.forEach((ln, li) => p.text(ln, bx + 16, y + h * 0.5 + 1.5 - li * 8, 7.5, on ? C.ink : C.ink3, "l", true));
    if (i < n - 1) p.arrow(bx + bw + 1, y + h * 0.5, bx + bw + 7, y + h * 0.5, 0.8, C.ink3);
  });
}
/* บทบาททั้งห้าล้อมรอบผู้เอาประกัน */
export function figRoles(p, x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) * 0.36;
  p.ellipse(cx, cy, R * 0.42, R * 0.42, 1, C.brand, C.brandt);
  p.text("ผู้เอาประกัน", cx, cy + 3, 8.5, C.brand2, "c", true); p.text("และครอบครัว", cx, cy - 5, 7.5, C.brand2, "c");
  const roles = [["บริษัทประกัน", "พ่วงกับกรมธรรม์ · เห็นภาพรวมกลุ่ม"], ["ทีมดูแล (Care Manager)", "รับสัญญาณ ติดต่อ วางแผน ส่งต่อ"], ["ผู้เชี่ยวชาญ", "แพทย์ เภสัชกร กายภาพ พยาบาล"], ["ผู้ดูแลระบบ", "ออกรหัส จัดการบัญชี"]];
  roles.forEach((r, i) => {
    const a = Math.PI / 2 - i * (Math.PI / 2), rx = cx + Math.cos(a) * R * 1.05, ry = cy + Math.sin(a) * R * 0.95;
    p.line(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45, rx - Math.cos(a) * 26, ry - Math.sin(a) * 12, 0.6, C.ink3);
    p.rrect(rx - 34, ry - 8, 68, 16, 3, C.white, C.line, 0.6);
    p.text(r[0], rx, ry + 2, 7.5, C.ink, "c", true); p.text(r[1], rx, ry - 4.5, 5.5, C.ink2, "c");
  });
}
/* แถบผู้ป่วยบนหน้าเคส */
export function figPatientBand(p, x, y, w, h) {
  p.rrect(x, y + h * 0.3, w, h * 0.45, 3, C.white, C.line, 0.6); p.rect(x, y + h * 0.3, 3, h * 0.45, C.c1);
  p.text("P-0412", x + 10, y + h * 0.5, 13, C.brand2, "l", true);
  p.text("สมชาย ใจดี", x + 52, y + h * 0.5, 9.5, C.ink, "l", true);
  p.text("อายุ 78 ปี · ชาย · เชียงใหม่ · เปิดเคส 3 ก.ย. 69 · กำหนด เกินกำหนด 5 ชม.", x + 10, y + h * 0.37, 6.5, C.ink2);
  p.rrect(x + w - 86, y + h * 0.46, 46, 9, 4.5, C.c1, null); p.text("🔴 ต้องทบทวนด่วน", x + w - 63, y + h * 0.49, 5.5, C.white, "c", true);
  p.rrect(x + w - 36, y + h * 0.46, 32, 9, 2, C.white, C.line, 0.5); p.text("← กลับคิวงาน", x + w - 20, y + h * 0.49, 5.5, C.ink, "c");
  const stg = ["ทบทวนสัญญาณ", "ติดต่อ/วางแผน", "ส่งต่อ", "ติดตามผล"];
  stg.forEach((s, i) => { const sx = x + i * (w / 4 + 1); p.rrect(sx, y + h * 0.08, w / 4 - 2, h * 0.16, 2, i === 0 ? C.brand : C.surf2, C.line2, 0.4); p.text(s, sx + w / 8 - 1, y + h * 0.13, 6, i === 0 ? C.white : C.ink3, "c", i === 0); });
}
/* หน้าเว็บ: ผลที่ผู้เชี่ยวชาญยืนยันแล้ว */
export function figResultsWeb(p, x, y, w, h) {
  p.rrect(x, y, w, h, 3, C.white, C.line, 0.6);
  p.text("ผลตรวจของท่าน", x + 6, y + h - 10, 9, C.ink, "l", true); p.text("ผลที่ผู้เชี่ยวชาญยืนยันแล้ว", x + 6, y + h - 16, 6.5, C.ink2);
  const st = ["ส่งให้ทีมดูแลแล้ว", "ผู้เชี่ยวชาญรับเรื่องแล้ว", "ผู้เชี่ยวชาญส่งผลกลับแล้ว", "ปิดเรื่องแล้ว"];
  st.forEach((s, i) => { const sx = x + 6 + i * ((w - 12) / 4 + 1); p.rrect(sx, y + h - 28, (w - 12) / 4 - 2, 8, 2, i < 2 ? C.c4t : (i === 2 ? C.brand : C.surf2), C.line2, 0.4); p.text(s, sx + (w - 12) / 8 - 1, y + h - 25, 5.2, i === 2 ? C.white : (i < 2 ? C.c4 : C.ink3), "c", i === 2); });
  p.rrect(x + 6, y + 8, w - 12, h - 42, 2, C.c4t, [0.733, 0.969, 0.816], 0.6);
  p.text("ผลจากผู้เชี่ยวชาญ · 5 ก.ย. 69", x + 10, y + h - 40, 7, [0.082, 0.502, 0.239], "l", true);
  [["ข้อค้นพบ", "ยาสองรายการเพิ่มความเสี่ยงหกล้มเมื่อใช้ร่วมกัน"], ["คำแนะนำ", "ให้แพทย์พิจารณาปรับขนาดยา นัดติดตาม 2 สัปดาห์"], ["ขั้นตอนถัดไป", "ส่งต่อแพทย์"]].forEach((r, i) => {
    p.text(r[0], x + 10, y + h - 49 - i * 8, 6, C.ink3); p.text(r[1], x + 40, y + h - 49 - i * 8, 6.5, C.ink, "l", i === 2);
  });
}

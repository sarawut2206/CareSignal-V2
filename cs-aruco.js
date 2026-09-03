/* ============================================================
   cs-aruco.js — ตรวจจับป้ายสัญลักษณ์ ArUco จากภาพกล้อง
   ------------------------------------------------------------
   ทำไมเขียนเอง ไม่ดึงไลบรารีมาใช้
     แอปเป็น PWA ที่ต้องเปิดได้ตอนไม่มีเน็ต ไฟล์ทุกไฟล์ถูก precache
     ไว้ใน service worker · OpenCV.js ใหญ่ 8-10 MB ซึ่งเกินกว่าจะยัดลงไป
     และการพึ่ง CDN แปลว่าถ้าเน็ตบ้านผู้ใช้ล่ม การตรวจก็ล่มตาม
     โค้ดนี้ทั้งหมดราว 20 KB ไม่มี dependency

   ทำไมสร้างพจนานุกรมป้ายเอง ไม่ใช้ชุดมาตรฐาน ARUCO_4X4_50
     เพราะแอปเป็นทั้งคนพิมพ์ป้ายและคนอ่านป้าย ถ้าสร้างเองทั้งสองฝั่ง
     จะไม่มีทางเกิดกรณี "ผู้ใช้ไปโหลดป้ายจากเว็บอื่นมาแล้วอ่านไม่ออก"
     ชุดนี้ตรวจแล้วว่าระยะแฮมมิงต่ำสุดระหว่างป้ายทุกคู่ทุกการหมุน
     มากพอที่จะไม่สับสนกัน (ทดสอบไว้ใน test_aruco.js)

   ข้อจำกัดที่ต้องรู้
     * คืนตำแหน่งและมุมบน "ระนาบภาพ" เท่านั้น ไม่ได้คืน 6-DoF pose จริง
       เพราะการหา pose ต้องรู้ค่า intrinsics ของกล้อง ซึ่งเบราว์เซอร์
       ไม่เปิดให้อ่าน · ระยะที่คืนมาเป็นค่าประมาณจากขนาดป้ายในภาพ
       เทียบกับขนาดที่พิมพ์จริง ใช้ดูแนวโน้มเข้า-ออกได้ แต่ไม่ใช่ระยะวัด
     * ป้ายต้องกว้างอย่างน้อยราว 24 พิกเซลในภาพจึงจะอ่านรหัสได้
       ที่ระยะ 2.5-3 เมตรกับกล้อง 1080 พิกเซล แปลว่าต้องพิมพ์ไม่ต่ำกว่า
       9 เซนติเมตร · เล็กกว่านั้นไม่ใช่แม่นน้อยลง แต่คือไม่เจอเลย
   ============================================================ */
(function (root) {
  "use strict";

  var GRID = 4;              /* บิตข้อมูล 4x4 */
  var BORDER = 1;            /* ขอบดำหนา 1 ช่อง */
  var CELLS = GRID + BORDER * 2;   /* รวมเป็นตาราง 6x6 */

  /* ============================================================
     พจนานุกรมป้าย
     ------------------------------------------------------------
     สร้างแบบกำหนดผลตายตัว (ไล่จากเลขน้อยไปมาก) จึงได้ชุดเดิมทุกครั้ง
     ทั้งฝั่งพิมพ์และฝั่งอ่าน ไม่ต้องเก็บตารางไว้ในไฟล์
     เงื่อนไขที่ป้ายหนึ่งจะถูกรับเข้าชุด
       1. การหมุนสี่ทิศต้องให้ค่าต่างกันหมด ไม่งั้นบอกทิศไม่ได้
       2. ต้องมีทั้งบิต 0 และ 1 พอสมควร ป้ายที่ขาวล้วนหรือดำล้วน
          จะไปปนกับพื้นผิวเรียบ ๆ ในบ้าน เช่น กระเบื้องหรือผนัง
       3. ระยะแฮมมิงถึงป้ายอื่นทุกตัวทุกการหมุน ต้องไม่น้อยกว่า MIN_DIST
          เพื่อให้อ่านผิดหนึ่งบิตแล้วยังกู้กลับได้ ไม่ใช่กลายเป็นป้ายอื่น
     ============================================================ */
  var MIN_DIST = 6;
  var DICT_SIZE = 12;

  function bitsOf(word) {           /* เลข 16 บิต → ตาราง 4x4 (1 = ขาว) */
    var g = [], i, r, c;
    for (r = 0; r < GRID; r++) { g.push([]); for (c = 0; c < GRID; c++) {
      i = r * GRID + c; g[r].push((word >> (GRID * GRID - 1 - i)) & 1);
    } }
    return g;
  }
  function wordOf(g) {
    var w = 0, r, c;
    for (r = 0; r < GRID; r++) for (c = 0; c < GRID; c++) w = (w << 1) | (g[r][c] & 1);
    return w >>> 0;
  }
  function rot90(g) {               /* หมุนตามเข็มนาฬิกา */
    var o = [], r, c;
    for (r = 0; r < GRID; r++) { o.push([]); for (c = 0; c < GRID; c++) o[r].push(g[GRID - 1 - c][r]); }
    return o;
  }
  function rotations(word) {
    var g = bitsOf(word), out = [wordOf(g)], i;
    for (i = 0; i < 3; i++) { g = rot90(g); out.push(wordOf(g)); }
    return out;                     /* [0°, 90°, 180°, 270°] */
  }
  function popcount(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    return (x * 0x01010101) >> 24;
  }
  function hamming(a, b) { return popcount((a ^ b) >>> 0); }

  var DICT = (function () {
    var list = [], w, i, j, rots, ok, ones;
    for (w = 0; w < 65536 && list.length < DICT_SIZE; w++) {
      rots = rotations(w);
      /* ข้อ 1: สี่ทิศต้องต่างกันหมด */
      ok = true;
      for (i = 0; i < 4 && ok; i++) for (j = i + 1; j < 4; j++) if (rots[i] === rots[j]) { ok = false; break; }
      if (!ok) continue;
      /* ข้อ 2: อย่าขาวหรือดำจนเกินไป */
      ones = popcount(w);
      if (ones < 5 || ones > 11) continue;
      /* ข้อ 3: ห่างจากทุกป้ายที่รับไว้แล้ว ในทุกการหมุน */
      for (i = 0; i < list.length && ok; i++) {
        var other = rotations(list[i]);
        for (j = 0; j < 4; j++) {
          var k;
          for (k = 0; k < 4; k++) if (hamming(rots[j], other[k]) < MIN_DIST) { ok = false; break; }
          if (!ok) break;
        }
      }
      if (ok) list.push(w);
    }
    return list;
  })();

  /* บทบาทของแต่ละรหัส — ผูกไว้ที่นี่ที่เดียว ทั้งฝั่งพิมพ์และฝั่งอ่านใช้ร่วมกัน */
  /* ============================================================
     ตำแหน่งของป้ายแต่ละรหัส
     ------------------------------------------------------------
     ทุกจุดที่ต้อง "ระบุตำแหน่งบนพื้น" มีรหัสของตัวเอง ไม่ใช้สีหรือรูปทรง
     เป็นตัวแยก · เหตุผล: สีบนพื้นบ้านจริงไปซ้ำกับพรม กระเบื้อง เงา และ
     สีเสื้อได้ตลอด และเมื่อกล้องสับสน ระบบจะไม่รู้ตัวว่าสับสน
     รหัสในป้ายทำให้ระบบตอบได้ว่า "นี่คือจุดไหน" ไม่ใช่แค่ "เห็นอะไรบางอย่าง"

     จุดเริ่มต้น จุด 1 เมตร และจุด 3 เมตร แยกรหัสกันคนละใบ เพราะถ้าใช้
     รหัสเดียวกันสามใบ ระบบจะบอกไม่ได้ว่าผู้ใช้เดินผ่านจุดไหนไปแล้ว
     ============================================================ */
  var ROLE = { 0: "chest", 1: "waist", 2: "stance", 3: "turn", 4: "start", 5: "mid" };
  var ROLE_NM = { chest: "ป้ายหน้าอก", waist: "ป้ายเอว",
                  stance: "ป้ายท่าทรงตัว", start: "ป้ายจุดเริ่มต้น",
                  mid: "ป้ายจุด 1 เมตร", turn: "ป้ายจุด 3 เมตร" };
  /* ตำแหน่งไหนใช้กับการทดสอบใด — ผูกไว้ที่เดียว ทั้งแผ่นพิมพ์และหน้าจอใช้ร่วมกัน
     ป้ายที่ไม่มีการทดสอบใดใช้ ไม่ควรมีอยู่ เพราะเพิ่มภาระผู้ใช้โดยไม่ได้อะไร */
  var ROLE_USE = {
    chest:  ["ทรงตัว 4 ท่า — วัดการโคลงและการเอียงของลำตัว", "ลุกนั่ง 5 ครั้ง", "ลุกเดิน 3 เมตร"],
    waist:  ["ลุกนั่ง 5 ครั้ง — จับจังหวะขึ้นลง", "ลุกเดิน 3 เมตร"],
    stance: ["ทรงตัว 4 ท่า — จุดยืนและตำแหน่งเท้าทั้งสี่ท่า"],
    start:  ["ลุกเดิน 3 เมตร — จุดเริ่มต้นที่เก้าอี้", "ลุกนั่ง 5 ครั้ง — ตำแหน่งเก้าอี้"],
    mid:    ["ลุกเดิน 3 เมตร — จุดกึ่งกลาง ยืนยันว่าเดินผ่านจริงและวัดความเร็วช่วงแรก"],
    turn:   ["ลุกเดิน 3 เมตร — จุดกลับตัว ยืนยันว่าเดินครบระยะ"]
  };
  /* ป้ายที่วางกับพื้นหรือตั้งพื้น ไม่ได้ติดบนตัว — ใช้แยกวิธีติดตั้งบนแผ่นพิมพ์ */
  var ROLE_FLOOR = ["stance", "start", "mid", "turn"];

  /* ============================================================
     วาดป้ายลงบนแคนวาส สำหรับพิมพ์
     ------------------------------------------------------------
     ต้องมี "ขอบขาว" ล้อมรอบเสมอ กว้างอย่างน้อยหนึ่งช่อง
     เหตุผลเจอตอนทดสอบ: ตัวตรวจหาป้ายจากหยดสีดำที่ต่อกัน ถ้าขอบดำของป้าย
     ไปแตะวัตถุสีดำอื่น เช่น เสื้อสีเข้ม ขอบโต๊ะ หรือเงาที่เข้มจัด
     หยดทั้งสองจะเชื่อมเป็นก้อนเดียว แล้วรูปที่ได้ก็ไม่ใช่สี่เหลี่ยมอีกต่อไป
     ป้ายจะหายไปทั้งที่กล้องเห็นเต็ม ๆ · ขอบขาวกันเรื่องนี้ทั้งหมด
     size คือความกว้างของส่วนที่เป็นรหัส ไม่รวมขอบขาว
     ============================================================ */
  var QUIET = 1;                     /* ขอบขาว หน่วยเป็นช่อง */
  function render(ctx, id, x, y, size) {
    var word = DICT[id];
    if (word == null) return false;
    var g = bitsOf(word), cell = size / CELLS, r, c;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - QUIET * cell, y - QUIET * cell,
                 size + 2 * QUIET * cell, size + 2 * QUIET * cell);
    ctx.fillStyle = "#000";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#fff";
    for (r = 0; r < GRID; r++) for (c = 0; c < GRID; c++) {
      if (g[r][c]) ctx.fillRect(x + (c + BORDER) * cell, y + (r + BORDER) * cell, cell, cell);
    }
    return true;
  }
  /* ความกว้างรวมขอบขาว เทียบกับความกว้างของรหัส — ใช้ตอนคำนวณขนาดกระดาษ */
  function totalSize(codeSize) { return codeSize * (CELLS + 2 * QUIET) / CELLS; }

  /* ============================================================
     ขั้นที่ 1 — เทาและตัดขาวดำแบบปรับตามพื้นที่
     ------------------------------------------------------------
     ใช้ค่าเฉลี่ยเฉพาะถิ่นแทนค่าคงที่ เพราะแสงในบ้านไม่สม่ำเสมอ
     ครึ่งห้องสว่างจากหน้าต่าง อีกครึ่งอยู่ในเงา · ค่าคงที่ค่าเดียว
     จะทำให้ครึ่งหนึ่งของภาพกลายเป็นสีเดียวทั้งแผ่น
     ใช้ integral image เพื่อให้คิดค่าเฉลี่ยหน้าต่างได้ในเวลาคงที่
     ============================================================ */
  function grayscale(img) {
    var n = img.width * img.height, g = new Uint8Array(n), d = img.data, i;
    for (i = 0; i < n; i++) g[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 151 + d[i * 4 + 2] * 28) >> 8;
    return g;
  }
  function threshold(gray, w, h, win, bias) {
    win = win || Math.max(7, (Math.round(w / 12) | 1));
    if (win % 2 === 0) win++;
    bias = bias == null ? 7 : bias;
    var integ = new Float64Array((w + 1) * (h + 1)), x, y;
    for (y = 0; y < h; y++) {
      var rowSum = 0;
      for (x = 0; x < w; x++) {
        rowSum += gray[y * w + x];
        integ[(y + 1) * (w + 1) + (x + 1)] = integ[y * (w + 1) + (x + 1)] + rowSum;
      }
    }
    var bin = new Uint8Array(w * h), r = win >> 1;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var x0 = x - r < 0 ? 0 : x - r, y0 = y - r < 0 ? 0 : y - r;
      var x1 = x + r >= w ? w - 1 : x + r, y1 = y + r >= h ? h - 1 : y + r;
      var area = (x1 - x0 + 1) * (y1 - y0 + 1);
      var s = integ[(y1 + 1) * (w + 1) + (x1 + 1)] - integ[y0 * (w + 1) + (x1 + 1)]
            - integ[(y1 + 1) * (w + 1) + x0] + integ[y0 * (w + 1) + x0];
      /* 1 = ดำ เพราะสิ่งที่เราตามหาคือหยดสีดำ (ขอบป้าย) */
      bin[y * w + x] = gray[y * w + x] * area < s - bias * area ? 1 : 0;
    }
    return bin;
  }

  /* ============================================================
     ขั้นที่ 2 — หาหยดสีดำแล้วไล่ขอบ
     ------------------------------------------------------------
     ใช้ flood fill หาองค์ประกอบที่ต่อกัน แล้วไล่ขอบแบบ Moore
     เก็บเฉพาะหยดที่ใหญ่พอ · หยดเล็กคือสัญญาณรบกวนหรือตัวอักษรบนพื้น
     ============================================================ */
  function components(bin, w, h, minArea) {
    var lab = new Int32Array(w * h), out = [], id = 0;
    var stack = new Int32Array(w * h), i, p, x, y;
    for (i = 0; i < w * h; i++) {
      if (!bin[i] || lab[i]) continue;
      id++;
      var sp = 0, area = 0, minX = w, maxX = -1, minY = h, maxY = -1, seed = i;
      stack[sp++] = i; lab[i] = id;
      while (sp > 0) {
        p = stack[--sp]; area++;
        x = p % w; y = (p / w) | 0;
        if (x < minX) { minX = x; }
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) { maxY = y; }
        if (y * w + x < seed) seed = y * w + x;
        if (x > 0     && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
        if (y > 0     && bin[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
      }
      if (area < minArea) continue;
      /* ป้ายที่เอียงมากที่สุดยังควรกินพื้นที่กรอบไม่ต่ำกว่าราวหนึ่งในสี่
         กรองเส้นบาง ๆ เช่น ขอบโต๊ะหรือสายไฟออกตั้งแต่ตรงนี้ */
      var bw = maxX - minX + 1, bh = maxY - minY + 1;
      if (bw < 8 || bh < 8) continue;
      if (area < bw * bh * 0.2) continue;
      out.push({ id: id, seed: seed, minX: minX, maxX: maxX, minY: minY, maxY: maxY, area: area });
    }
    return { lab: lab, blobs: out };
  }

  /* ไล่ขอบแบบ Moore-neighbour เริ่มจากพิกเซลบนสุด-ซ้ายสุดของหยด */
  var DIRS = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
  function trace(lab, w, h, blob) {
    var startX = blob.seed % w, startY = (blob.seed / w) | 0, id = blob.id;
    var cx = startX, cy = startY, dir = 0, pts = [], guard = 0;
    var maxSteps = 4 * (blob.maxX - blob.minX + blob.maxY - blob.minY + 4) + 64;
    do {
      pts.push([cx, cy]);
      var found = false, k, nd, nx, ny;
      for (k = 0; k < 8; k++) {
        nd = (dir + 6 + k) % 8;            /* ย้อนกลับไปทางซ้ายมือก่อน */
        nx = cx + DIRS[nd][0]; ny = cy + DIRS[nd][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (lab[ny * w + nx] === id) { cx = nx; cy = ny; dir = nd; found = true; break; }
      }
      if (!found) break;
      guard++;
    } while ((cx !== startX || cy !== startY) && guard < maxSteps);
    return pts;
  }

  /* ============================================================
     ขั้นที่ 3 — ลดรูปขอบให้เหลือสี่มุม
     ------------------------------------------------------------
     Douglas-Peucker แล้วเก็บเฉพาะรูปที่เหลือสี่จุดพอดีและเป็นรูปนูน
     ============================================================ */
  function perpDist(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var den = Math.sqrt(dx * dx + dy * dy);
    if (den < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / den;
  }
  function dp(pts, keep, a, b, eps) {
    var stack = [[a, b]];
    while (stack.length) {
      var seg = stack.pop(), s0 = seg[0], s1 = seg[1], best = -1, bd = eps, i;
      for (i = s0 + 1; i < s1; i++) {
        var d = perpDist(pts[i], pts[s0], pts[s1]);
        if (d > bd) { bd = d; best = i; }
      }
      if (best > 0) { keep[best] = 1; stack.push([s0, best], [best, s1]); }
    }
  }
  /* ขอบที่ได้จากการไล่รอยเป็น "วงปิด" จุดแรกกับจุดสุดท้ายอยู่ติดกัน
     ถ้าเอา Douglas-Peucker มาใช้ตรง ๆ โดยยึดสองจุดนั้นเป็นปลายทั้งสอง
     เส้นฐานจะยาวเกือบศูนย์ และอัลกอริทึมจะหามุมไม่เจอเลย
     จึงต้องตัดวงออกเป็นสองส่วนที่จุดไกลสุดจากจุดเริ่มก่อน */
  function simplify(pts, eps, wantIdx) {
    if (pts.length < 4) return wantIdx ? [] : pts.slice();
    var n = pts.length, far = 0, fd = -1, i, d;
    for (i = 1; i < n; i++) {
      d = (pts[i][0] - pts[0][0]) * (pts[i][0] - pts[0][0]) +
          (pts[i][1] - pts[0][1]) * (pts[i][1] - pts[0][1]);
      if (d > fd) { fd = d; far = i; }
    }
    var keep = new Uint8Array(n);
    keep[0] = 1; keep[far] = 1; keep[n - 1] = 1;
    dp(pts, keep, 0, far, eps);
    dp(pts, keep, far, n - 1, eps);
    var out = [], idx = [];
    for (i = 0; i < n; i++) if (keep[i]) { out.push(pts[i]); idx.push(i); }
    /* จุดสุดท้ายอยู่ติดกับจุดแรกเสมอ ถ้าใกล้กันมากให้ตัดทิ้งหนึ่งจุด */
    if (out.length > 1) {
      var a = out[0], b = out[out.length - 1];
      if (Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1) { out.pop(); idx.pop(); }
    }
    return wantIdx ? idx : out;
  }
  function isConvexQuad(q) {
    var sign = 0, i;
    for (i = 0; i < 4; i++) {
      var a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
      var cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (Math.abs(cr) < 1e-6) continue;
      if (sign === 0) sign = cr > 0 ? 1 : -1;
      else if ((cr > 0 ? 1 : -1) !== sign) return false;
    }
    return sign !== 0;
  }
  function quadOf(pts, blob) {
    var span = Math.max(blob.maxX - blob.minX, blob.maxY - blob.minY);
    var eps, s;
    /* ลองหลายค่าความหยาบ ป้ายที่เบลอต้องใช้ค่าหยาบกว่าป้ายที่คมชัด */
    for (var k = 0; k < 4; k++) {
      eps = span * (0.03 + k * 0.02);
      var idx = simplify(pts, eps, true);
      idx = pruneToQuad(pts, idx, span);
      if (!idx) continue;
      s = idx.map(function (i) { return pts[i] });
      if (isConvexQuad(s)) return refineCorners(pts, idx, s);
    }
    return null;
  }

  /* ============================================================
     ตัดจุดที่ไม่ใช่มุมจริงออกจนเหลือสี่จุด
     ------------------------------------------------------------
     จุดเริ่มของการไล่ขอบคือพิกเซลบนสุด-ซ้ายสุดของหยด ซึ่งมักตกอยู่
     "กลางด้าน" ไม่ใช่ที่มุม · Douglas-Peucker บังคับเก็บจุดเริ่มไว้เสมอ
     ผลจึงออกมาห้าจุด คือสี่มุมจริงบวกจุดเริ่มที่ไม่ได้เป็นมุม
     เคยทำให้ป้ายที่วางเกือบตรงแนวแกนตรวจไม่เจอเป็นช่วง ๆ
     วิธีแก้: ทยอยตัดจุดที่ "ตรงที่สุด" (ห่างจากเส้นเชื่อมเพื่อนบ้านน้อยที่สุด)
     ออกจนเหลือสี่จุด และถ้าจุดที่จะตัดยังโค้งชัดเจน แปลว่ารูปนี้ไม่ใช่
     สี่เหลี่ยม ให้ยอมแพ้ ไม่ใช่ฝืนตัดจนได้สี่จุด
     ============================================================ */
  function pruneToQuad(pts, idx, span) {
    if (idx.length < 4 || idx.length > 8) return null;
    var list = idx.slice();
    while (list.length > 4) {
      var best = -1, bestD = Infinity, i, n = list.length;
      for (i = 0; i < n; i++) {
        var d = perpDist(pts[list[i]], pts[list[(i - 1 + n) % n]], pts[list[(i + 1) % n]]);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0 || bestD > span * 0.12) return null;
      list.splice(best, 1);
    }
    return list;
  }

  /* ============================================================
     ปรับมุมให้ละเอียดกว่าพิกเซล
     ------------------------------------------------------------
     มุมที่ได้จากการไล่ขอบเป็นพิกัดจำนวนเต็ม และตำแหน่งขอบยังเลื่อนไป
     ตามความคมของภาพและค่าที่ใช้ตัดขาวดำ · ถ้าใช้ค่าดิบ การวัดการโคลง
     จะได้สัญญาณรบกวนระดับพิกเซลปนมาด้วย ซึ่งที่ระยะ 2.5 เมตร
     เท่ากับความคลาดเคลื่อนราว 2 มม. บนตัวผู้ใช้ต่อหนึ่งพิกเซล

     วิธี: ด้านของสี่เหลี่ยมเป็นเส้นตรงจริง ๆ จึงเอาจุดขอบทั้งช่วงของ
     ด้านนั้นมาฟิตเส้นตรงแบบ total least squares แล้วหาจุดตัดของด้าน
     ที่ติดกัน · ตัดจุดใกล้มุมทิ้งไป 20% เพราะบริเวณมุมภาพมักโค้งมน
     ทั้งจากเลนส์และจากการเบลอ ซึ่งจะดึงเส้นให้เอียงผิด
     ============================================================ */
  function fitLine(pts, from, to, n) {
    var cnt = (to - from + n) % n;
    if (cnt < 3) return null;
    var trim = Math.floor(cnt * 0.2), i, k, x, y;
    var sx = 0, sy = 0, m = 0;
    for (i = trim; i <= cnt - trim; i++) {
      k = (from + i) % n; sx += pts[k][0]; sy += pts[k][1]; m++;
    }
    if (m < 3) return null;
    var mx = sx / m, my = sy / m, sxx = 0, syy = 0, sxy = 0;
    for (i = trim; i <= cnt - trim; i++) {
      k = (from + i) % n; x = pts[k][0] - mx; y = pts[k][1] - my;
      sxx += x * x; syy += y * y; sxy += x * y;
    }
    /* ทิศหลักของกลุ่มจุด = เวกเตอร์ลักษณะเฉพาะตัวที่ค่ามากกว่าของเมทริกซ์กระจาย */
    var theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    var dx = Math.cos(theta), dy = Math.sin(theta);
    /* เส้นในรูป a*x + b*y = c โดย (a,b) คือเวกเตอร์ตั้งฉาก */
    return { a: -dy, b: dx, c: -dy * mx + dx * my };
  }
  function meet(l1, l2) {
    var det = l1.a * l2.b - l2.a * l1.b;
    if (Math.abs(det) < 1e-9) return null;
    return [(l1.c * l2.b - l2.c * l1.b) / det, (l1.a * l2.c - l2.a * l1.c) / det];
  }
  function refineCorners(pts, idx, quad) {
    var n = pts.length, lines = [], i;
    for (i = 0; i < 4; i++) {
      var L = fitLine(pts, idx[i], idx[(i + 1) % 4], n);
      if (!L) return quad;
      lines.push(L);
    }
    var out = [], side = 0;
    for (i = 0; i < 4; i++)
      side += Math.hypot(quad[(i + 1) % 4][0] - quad[i][0], quad[(i + 1) % 4][1] - quad[i][1]);
    side /= 4;
    for (i = 0; i < 4; i++) {
      /* มุมที่ i คือจุดตัดของด้านก่อนหน้ากับด้านที่เริ่มจากมุมนี้ */
      var p = meet(lines[(i + 3) % 4], lines[i]);
      /* ถ้าจุดตัดหลุดไปไกลจากมุมเดิม แปลว่าฟิตเพี้ยน ให้ใช้ค่าเดิมแทน */
      if (!p || Math.hypot(p[0] - quad[i][0], p[1] - quad[i][1]) > side * 0.25) return quad;
      out.push(p);
    }
    return out;
  }

  /* ============================================================
     ขั้นที่ 4 — คลี่ภาพสี่เหลี่ยมให้เป็นจัตุรัส แล้วอ่านบิต
     ------------------------------------------------------------
     หา homography จากสี่มุมไปยังจัตุรัสหนึ่งหน่วย แล้วสุ่มอ่านกลางช่อง
     อ่านจากภาพเทาต้นฉบับ ไม่ใช่ภาพขาวดำ เพื่อไม่ให้ผลของการตัดขาวดำ
     รอบแรกมาบังคับผลรอบสอง
     ============================================================ */
  function solve8(A, b) {
    var n = 8, i, j, k;
    for (i = 0; i < n; i++) {
      var piv = i;
      for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-12) return null;
      if (piv !== i) { var t = A[i]; A[i] = A[piv]; A[piv] = t; var tb = b[i]; b[i] = b[piv]; b[piv] = tb; }
      for (j = i + 1; j < n; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < n; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }
  /* homography ที่ส่งจัตุรัส (0,0)-(1,1) ไปยังสี่มุมในภาพ */
  function homography(q) {
    var src = [[0,0],[1,0],[1,1],[0,1]], A = [], b = [], i;
    for (i = 0; i < 4; i++) {
      var u = src[i][0], v = src[i][1], X = q[i][0], Y = q[i][1];
      A.push([u, v, 1, 0, 0, 0, -u * X, -v * X]); b.push(X);
      A.push([0, 0, 0, u, v, 1, -u * Y, -v * Y]); b.push(Y);
    }
    var x = solve8(A, b);
    if (!x) return null;
    return [x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], 1];
  }
  function applyH(H, u, v) {
    var d = H[6] * u + H[7] * v + H[8];
    if (Math.abs(d) < 1e-12) return null;
    return [(H[0] * u + H[1] * v + H[2]) / d, (H[3] * u + H[4] * v + H[5]) / d];
  }
  function sampleCell(gray, w, h, H, cx, cy) {
    /* เฉลี่ยจุดกลางช่อง 3x3 จุด เว้นขอบช่องไว้ 25% กันเลือดสีจากช่องข้าง ๆ */
    var sum = 0, n = 0, i, j;
    for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) {
      var u = (cx + 0.25 + 0.25 * i) / CELLS, v = (cy + 0.25 + 0.25 * j) / CELLS;
      var p = applyH(H, u, v);
      if (!p) continue;
      var px = Math.round(p[0]), py = Math.round(p[1]);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      sum += gray[py * w + px]; n++;
    }
    return n ? sum / n : null;
  }

  function readCode(gray, w, h, quad) {
    var H = homography(quad);
    if (!H) return null;
    var vals = [], r, c, v;
    for (r = 0; r < CELLS; r++) { vals.push([]); for (c = 0; c < CELLS; c++) {
      v = sampleCell(gray, w, h, H, c, r);
      if (v == null) return null;
      vals[r].push(v);
    } }
    /* ระดับตัดขาว-ดำหาจากภาพเอง: ขอบต้องดำ กลางมีทั้งสองสี
       ใช้ค่ากลางระหว่างค่าต่ำสุดกับสูงสุดของทั้งแผ่น จึงทนต่อแสงที่ต่างกัน */
    var lo = Infinity, hi = -Infinity;
    for (r = 0; r < CELLS; r++) for (c = 0; c < CELLS; c++) {
      if (vals[r][c] < lo) lo = vals[r][c];
      if (vals[r][c] > hi) hi = vals[r][c];
    }
    if (hi - lo < 30) return null;          /* ความต่างน้อยเกินไป ไม่ใช่ป้าย */
    var mid = (lo + hi) / 2;

    /* ขอบต้องดำครบทุกช่อง ยอมพลาดได้ไม่เกินหนึ่งช่อง เผื่อเงาหรือรอยพับ */
    var borderBad = 0;
    for (r = 0; r < CELLS; r++) for (c = 0; c < CELLS; c++) {
      if (r === 0 || c === 0 || r === CELLS - 1 || c === CELLS - 1) {
        if (vals[r][c] > mid) borderBad++;
      }
    }
    if (borderBad > 1) return null;

    var g = [], word;
    for (r = 0; r < GRID; r++) { g.push([]); for (c = 0; c < GRID; c++)
      g[r].push(vals[r + BORDER][c + BORDER] > mid ? 1 : 0); }
    word = wordOf(g);

    /* เทียบกับพจนานุกรมทั้งสี่การหมุน ยอมให้ผิดได้ไม่เกินหนึ่งบิต */
    var best = null, i, k;
    for (i = 0; i < DICT.length; i++) {
      var rots = rotations(DICT[i]);
      for (k = 0; k < 4; k++) {
        var d = hamming(word, rots[k]);
        if (d <= 1 && (!best || d < best.dist)) best = { id: i, rot: k, dist: d };
      }
    }
    return best;
  }

  /* ============================================================
     ตรวจหนึ่งเฟรม
     ------------------------------------------------------------
     คืนรายการป้ายที่เจอ พร้อมสี่มุมที่เรียงตามทิศจริงของป้ายแล้ว
     (มุมแรกคือมุมบนซ้ายของป้าย ไม่ใช่มุมบนซ้ายของภาพ)
     ============================================================ */
  function detect(img, opts) {
    opts = opts || {};
    var w = img.width, h = img.height;
    var gray = img.gray || grayscale(img);
    var bin = threshold(gray, w, h, opts.win, opts.bias);
    var minArea = opts.minArea || Math.max(64, (w * h) / 20000);
    var cc = components(bin, w, h, minArea);
    var out = [], i;
    for (i = 0; i < cc.blobs.length; i++) {
      var blob = cc.blobs[i];
      var pts = trace(cc.lab, w, h, blob);
      if (pts.length < 12) continue;
      var quad = quadOf(pts, blob);
      if (!quad) continue;
      var code = readCode(gray, w, h, quad);
      if (!code) continue;
      /* หมุนลำดับมุมให้ตรงกับทิศของป้าย เพื่อให้ corners[0] คือมุมบนซ้ายเสมอ
         ค่า rot คือ "ต้องหมุนป้ายในพจนานุกรมกี่ครั้งจึงตรงกับที่อ่านได้"
         จึงต้องหมุนลำดับมุมกลับทางเท่ากัน */
      var c4 = quad.slice();
      for (var k = 0; k < code.rot; k++) c4.push(c4.shift());
      out.push(make(code.id, c4));
    }
    return out;
  }

  function make(id, c) {
    var cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4;
    var cy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
    /* ความยาวด้านเฉลี่ย ใช้แทน "ขนาดป้ายในภาพ" */
    var side = 0, i;
    for (i = 0; i < 4; i++) side += Math.hypot(c[(i + 1) % 4][0] - c[i][0], c[(i + 1) % 4][1] - c[i][1]);
    side /= 4;
    /* มุมเอียงบนระนาบภาพ วัดจากด้านบนของป้าย (มุม 0 → มุม 1)
       ค่าบวกคือเอียงตามเข็มนาฬิกาเมื่อมองจากกล้อง */
    var ang = Math.atan2(c[1][1] - c[0][1], c[1][0] - c[0][0]) * 180 / Math.PI;
    return { id: id, role: ROLE[id] || null, corners: c, cx: cx, cy: cy, side: side, angle: ang };
  }

  /* ============================================================
     ระยะโดยประมาณจากขนาดป้ายในภาพ
     ------------------------------------------------------------
     ใช้ความสัมพันธ์ตรงไปตรงมา: ขนาดในภาพ ∝ ขนาดจริง / ระยะ
     ต้องรู้ทางยาวโฟกัสเป็นพิกเซล ซึ่งเบราว์เซอร์ไม่บอก จึงประมาณจาก
     มุมมองภาพที่ผู้ใช้ยืนยันตอนสอบเทียบ · ค่าที่ได้จึงเป็นค่าประมาณ
     ห้ามนำไปแสดงเป็นตัวเลขระยะให้ผู้ใช้เห็นเหมือนเป็นการวัดจริง
     ============================================================ */
  function distanceM(sidePx, markerMm, focalPx) {
    if (!sidePx || !markerMm || !focalPx) return null;
    return (focalPx * (markerMm / 1000)) / sidePx;
  }
  /* ทางยาวโฟกัสเป็นพิกเซล จากความกว้างภาพและมุมมองแนวนอน */
  function focalFromFov(widthPx, fovDeg) {
    return (widthPx / 2) / Math.tan((fovDeg * Math.PI / 180) / 2);
  }

  /* ============================================================
     ขนาดป้ายขั้นต่ำที่ควรพิมพ์
     ------------------------------------------------------------
     ย้อนจากเงื่อนไข "ป้ายต้องกว้างอย่างน้อย N พิกเซลในภาพ"
     ใช้บอกผู้ใช้ตรง ๆ ว่าที่ระยะเท่านี้ต้องพิมพ์ใหญ่เท่าไร
     แทนที่จะปล่อยให้พิมพ์เล็กแล้วมางงว่าทำไมระบบไม่เห็น
     ============================================================ */
  var MIN_SIDE_PX = 24;       /* อ่านรหัสได้ */
  var GOOD_SIDE_PX = 48;      /* อ่านมุมได้น่าเชื่อถือ */
  function minMarkerMm(distM, widthPx, fovDeg, sidePx) {
    var f = focalFromFov(widthPx, fovDeg);
    return ((sidePx || MIN_SIDE_PX) * distM / f) * 1000;
  }

  /* ============================================================
     ตัวติดตามป้าย
     ------------------------------------------------------------
     ทำไมต้องมี ไม่เรียก detect() ทั้งเฟรมทุกเฟรม
       วัดแล้วบนเดสก์ท็อป เฟรม 1080x1920 ใช้เวลาราว 46 มิลลิวินาที
       มือถือระดับกลางช้ากว่าราวสามถึงหกเท่า = 140-280 มิลลิวินาทีต่อเฟรม
       เท่ากับ 4-7 เฟรมต่อวินาที และยังต้องแบ่งเครื่องให้ MediaPipe อีก
       ซึ่งไม่พอสำหรับวัดการโคลงที่ต้องการอัตราสูง

     วิธีที่ใช้
       ครั้งแรกสแกนทั้งเฟรมเพื่อหาป้าย · หลังจากนั้นจำกรอบเดิมไว้
       แล้วสแกนเฉพาะบริเวณรอบกรอบนั้น ซึ่งเล็กกว่าเฟรมเต็มหลายสิบเท่า
       ป้ายที่หลุดไปจะถูกตามหาใหม่ด้วยการสแกนเต็มเฟรมเป็นระยะ ไม่ใช่ทุกเฟรม
       เพราะการสแกนเต็มเฟรมถี่ ๆ คือสิ่งที่เรากำลังหลีกเลี่ยงอยู่

     จังหวะที่ยอมให้สแกนเต็มเฟรมได้คือ "ตอนผู้ใช้กำลังจัดท่า" ซึ่งยังไม่จับเวลา
     พอเริ่มจับเวลาแล้วป้ายจะถูกจับไว้แล้ว เหลือแต่การตามกรอบซึ่งถูกมาก

     grab(x, y, w, h) เป็นฟังก์ชันที่ผู้เรียกส่งเข้ามา ให้คืนพิกเซลของกรอบนั้น
     แยกออกจากกันเพื่อให้ทดสอบได้โดยไม่ต้องมีแคนวาสจริง และเพื่อให้ฝั่งแอป
     ขอ getImageData เฉพาะกรอบเล็ก ๆ ได้ ไม่ต้องคัดลอกทั้งเฟรม
     ============================================================ */
  function Tracker(opts) {
    opts = opts || {};
    this.want = opts.want || [0, 1, 2, 3];
    this.pad = opts.pad == null ? 1.1 : opts.pad;   /* ขยายกรอบกี่เท่าของขนาดป้าย */
    this.rescanEvery = opts.rescanEvery == null ? 12 : opts.rescanEvery;
    this.keepFor = opts.keepFor == null ? 8 : opts.keepFor;  /* ยอมให้หายกี่เฟรมก่อนทิ้งกรอบ */
    this.marks = {};       /* id → {cx, cy, side, angle, lost, at} */
    this.frame = 0;
    this.lastFull = -999;
    this.stats = { full: 0, roi: 0 };
  }

  /* ตัดกรอบให้อยู่ในภาพ และคืน null ถ้าเล็กเกินกว่าจะมีป้ายอยู่ */
  function clampRect(x, y, w, h, W, H) {
    var x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    var x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
    if (x1 - x0 < 24 || y1 - y0 < 24) return null;
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  Tracker.prototype.reset = function () { this.marks = {}; this.lastFull = -999; };

  /**
   * เดินหนึ่งเฟรม
   * @param grab  function(x,y,w,h) → ImageData ของกรอบนั้น
   * @param W,H   ขนาดเฟรมเต็ม
   * @returns {ป้ายที่เห็นในเฟรมนี้ (id → ข้อมูล), full: สแกนเต็มเฟรมหรือไม่}
   */
  Tracker.prototype.update = function (grab, W, H) {
    this.frame++;
    var self = this, seen = {}, id, m, i;

    /* ---- 1. ตามกรอบเดิมของแต่ละป้ายก่อน ---- */
    for (id in this.marks) {
      if (!Object.prototype.hasOwnProperty.call(this.marks, id)) continue;
      m = this.marks[id];
      var pad = m.side * this.pad;
      var r = clampRect(m.cx - m.side / 2 - pad, m.cy - m.side / 2 - pad,
                        m.side + 2 * pad, m.side + 2 * pad, W, H);
      if (!r) { m.lost++; continue; }
      var sub = grab(r.x, r.y, r.w, r.h);
      this.stats.roi++;
      var found = detect(sub);
      var hit = null;
      for (i = 0; i < found.length; i++) if (found[i].id === +id) hit = found[i];
      if (hit) {
        seen[id] = shift(hit, r.x, r.y);
        this.marks[id] = { cx: seen[id].cx, cy: seen[id].cy, side: seen[id].side,
                           angle: seen[id].angle, lost: 0, at: this.frame };
      } else m.lost++;
    }

    /* ---- 2. ทิ้งกรอบที่หายนานเกินไป ---- */
    for (id in this.marks) {
      if (!Object.prototype.hasOwnProperty.call(this.marks, id)) continue;
      if (this.marks[id].lost > this.keepFor) delete this.marks[id];
    }

    /* ---- 3. ถ้ายังขาดป้ายที่ต้องการ ค่อยสแกนเต็มเฟรมเป็นครั้งคราว ---- */
    var missing = this.want.filter(function (k) { return !seen[k] });
    var doFull = missing.length > 0 && (this.frame - this.lastFull) >= this.rescanEvery;
    if (doFull) {
      this.lastFull = this.frame;
      this.stats.full++;
      var all = detect(grab(0, 0, W, H));
      for (i = 0; i < all.length; i++) {
        var a = all[i];
        if (this.want.indexOf(a.id) < 0) continue;
        if (seen[a.id]) continue;
        seen[a.id] = a;
        this.marks[a.id] = { cx: a.cx, cy: a.cy, side: a.side, angle: a.angle,
                             lost: 0, at: this.frame };
      }
    }
    return { marks: seen, full: doFull };
  };

  /* เลื่อนพิกัดจากกรอบย่อยกลับไปเป็นพิกัดของเฟรมเต็ม */
  function shift(m, dx, dy) {
    return { id: m.id, role: m.role, cx: m.cx + dx, cy: m.cy + dy,
             side: m.side, angle: m.angle,
             corners: m.corners.map(function (p) { return [p[0] + dx, p[1] + dy] }) };
  }

  root.CSAruco = {
    GRID: GRID, CELLS: CELLS, DICT: DICT, ROLE: ROLE, ROLE_NM: ROLE_NM, ROLE_USE: ROLE_USE, ROLE_FLOOR: ROLE_FLOOR,
    MIN_DIST: MIN_DIST, MIN_SIDE_PX: MIN_SIDE_PX, GOOD_SIDE_PX: GOOD_SIDE_PX,
    bitsOf: bitsOf, wordOf: wordOf, rotations: rotations, hamming: hamming,
    Tracker: Tracker, render: render, totalSize: totalSize, QUIET: QUIET, grayscale: grayscale, threshold: threshold, detect: detect,
    /* เปิดชั้นในไว้ให้ชุดทดสอบเรียกทีละขั้น เวลาผลลัพธ์ผิดจะได้รู้ว่าพังขั้นไหน */
    _stage: { components: components, trace: trace, quadOf: quadOf, readCode: readCode,
              refineCorners: refineCorners, fitLine: fitLine, simplify: simplify, pruneToQuad: pruneToQuad,
              homography: homography, applyH: applyH },
    distanceM: distanceM, focalFromFov: focalFromFov, minMarkerMm: minMarkerMm
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

if (typeof module !== "undefined" && module.exports) module.exports = globalThis.CSAruco;

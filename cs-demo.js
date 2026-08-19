/* ============================================================
   CareSignal — โหมดสาธิต (Demo Mode)
   ------------------------------------------------------------
   เจตนา: ให้อัดวิดีโอสาธิตได้ผลเหมือนกันทุกครั้ง และให้ผู้ชมเห็นว่า
   "ข้อมูลชุดหนึ่งเดินทางจากผู้เอาประกัน ไปถึงผู้ประสานงานและผู้เชี่ยวชาญ
   แล้วกลับมาเป็นแผนดูแลได้อย่างไร"

   ข้อตัดสินใจสำคัญ 3 ข้อ
   ------------------------------------------------------------
   1. ข้อมูลจำลอง "ไม่แตะฐานข้อมูลเลย" — อยู่ในหน่วยความจำของหน้าเว็บเท่านั้น
      เหตุผล: ถ้าเขียนลงฐานจริงแม้ติดธง demo ไว้ ก็ยังเสี่ยงหลุดเข้าไปใน
      รายงานของบริษัทประกันหรือคิวงานจริง ซึ่งเป็นความเสียหายที่แก้ยาก
      ผลพลอยได้: รีเซ็ตทันที ไม่ต้องรอเครือข่าย และผลเหมือนกันทุก take

   2. คำนวณด้วย "เอนจินจริง" ไม่ใช่ผลที่เขียนไว้ล่วงหน้า
      โหมดนี้ป้อนข้อมูลเข้า baselineRisk / trajectory / toSignals ตัวเดียวกับ
      ที่ระบบจริงใช้ แล้วให้มันตัดสินเอง — ถ้าเปลี่ยนกฎ ผลสาธิตต้องเปลี่ยนตาม
      สิ่งที่จำลองคือ "การบันทึกและการตอบกลับของคน" ไม่ใช่การตัดสินของระบบ

   3. ติดป้ายทุกหน้าจอ ไม่ให้เข้าใจผิดว่าเป็นข้อมูลจริง

   ข้อจำกัดที่ต้องบอกตรง ๆ เวลาสาธิต
   ------------------------------------------------------------
   โหมดนี้ไม่ได้พิสูจน์เรื่องสิทธิ์ข้อมูล (RLS) เพราะไม่แตะฐานข้อมูล
   การพิสูจน์เรื่องสิทธิ์อยู่ที่การทดสอบด้วยบัญชีจริง ไม่ใช่ที่โหมดนี้
   และผลลัพธ์หลังติดตามเป็น "ตัวอย่างเพื่อแสดงว่าระบบติดตามผลได้"
   ไม่ใช่ผลการศึกษา
   ============================================================ */
(function (root) {
  "use strict";

  /* ---------- เปิด/ปิดโหมด ---------- */
  var KEY = "cs-demo-mode";
  function on()  { try { return localStorage.getItem(KEY) === "1" ||
                          /[?&#]demo\b/.test(location.href); } catch (e) { return false } }
  function set(v){ try { v ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY) } catch (e) {} }

  /* ---------- ชุดข้อมูลจำลอง ----------
     รูปร่างเหมือนที่ระบบจริงเก็บทุกฟิลด์ เพื่อให้เอนจินคำนวณได้โดยไม่ต้องดัดแปลง
     วันที่คิดย้อนจากวันที่เปิดหน้า เพื่อให้ "แนวโน้ม 90 วัน" สมจริงเสมอ */
  function daysAgo(n) { var d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }

  function mkAssess(o) {
    var parts = { ftsst: o.ftsstPt, falls: o.fallsPt, meds: o.medsPt, adl: o.adlPt, balance: o.bal };
    var sc = parts.ftsst + parts.falls + parts.meds + parts.adl;      /* ฐาน 9 — การทรงตัวไม่รวม */
    return {
      at: o.at, score: sc, max: 9, tier: sc >= 8 ? 4 : sc >= 6 ? 3 : sc >= 4 ? 2 : 1,
      ftsst: o.ftsst, tug: o.tug, parts: parts, method: "camera",
      verified: true, balPassed: o.bal,
      fallsDetail: o.fallsDetail || { count: 0 },
      medsDetail:  o.medsDetail  || { count: 1, purposes: [], items: [] },
      homeDetail:  o.homeDetail  || null,
      steadi:      o.steadi      || {},
      barthelTotal: o.barthel,
      notTested: !!o.notTested,
      safetyVerdict: o.safetyVerdict || null,
      demo: true
    };
  }

  var SCENARIOS = {
    green: {
      key: "green", label: "เขียว — ติดตามตามรอบ", color: "#16A34A",
      member: { name: "มาลี ใจงาม", age: 68, sex: "f", policy: "สุขภาพผู้สูงอายุ" },
      note: "ไม่เคยหกล้ม ค่าที่วัดคงที่ทั้งสองครั้ง — แสดงว่าระบบไม่ได้ตีตราทุกคนว่าเสี่ยง",
      assessments: [
        mkAssess({ at: daysAgo(92), ftsst: 10.2, tug: 9.4, ftsstPt: 3, fallsPt: 2, medsPt: 1, adlPt: 2, bal: 4, barthel: 20 }),
        mkAssess({ at: daysAgo(2),  ftsst: 10.4, tug: 9.6, ftsstPt: 3, fallsPt: 2, medsPt: 1, adlPt: 2, bal: 4, barthel: 20 })
      ]
    },
    yellow: {
      key: "yellow", label: "เหลือง — ควรทบทวน", color: "#CA8A04",
      member: { name: "สมพร แสงทอง", age: 74, sex: "f", policy: "ดูแลระยะยาว (LTC)" },
      note: "เกือบหกล้ม รู้สึกไม่มั่นคง และเวลาลุกเดินเริ่มช้าลง — ยังไม่ถึงขั้นเร่งด่วน",
      /* ตัวเลขต้องต่ำกว่าเกณฑ์ที่ทำให้ขึ้นแดง: อายุ 74 → เกณฑ์ลุกนั่ง 12.1 วิ
         และลุกเดินต้องไม่ถึง 12 วิ มิฉะนั้นจะติด B9/B10 แล้วกลายเป็นเคสด่วน
         ตั้งใจให้เหลืองมาจาก "ความรู้สึกไม่มั่นคงและเกือบล้ม" เป็นหลัก */
      assessments: [
        mkAssess({ at: daysAgo(95), ftsst: 11.2, tug: 10.4, ftsstPt: 2, fallsPt: 2, medsPt: 1, adlPt: 2, bal: 3, barthel: 20 }),
        mkAssess({ at: daysAgo(3),  ftsst: 11.6, tug: 10.9, ftsstPt: 2, fallsPt: 2, medsPt: 1, adlPt: 2, bal: 3, barthel: 20,
                   steadi: { unsteady: true, worried: true },
                   fallsDetail: { count: 0, nearFall: true } })
      ]
    },
    red: {
      key: "red", label: "แดง — ต้องทบทวนด่วน", color: "#DC2626",
      member: { name: "สมชาย ทองดี", age: 72, sex: "m", policy: "ดูแลระยะยาว (LTC)" },
      note: "เส้นทางหลักของการสาธิต — หกล้มซ้ำ เดินช้าลง เปลี่ยนยา กิจวัตรลดลง และบ้านมีอันตราย",
      assessments: [
        mkAssess({ at: daysAgo(90), ftsst: 13.2, tug: 11.8, ftsstPt: 1, fallsPt: 2, medsPt: 1, adlPt: 2, bal: 3, barthel: 18 }),
        mkAssess({
          at: daysAgo(1), ftsst: 14.1, tug: 15.4, ftsstPt: 1, fallsPt: 0, medsPt: 0, adlPt: 1, bal: 2, barthel: 16,
          steadi: { unsteady: true, worried: true },
          fallsDetail: { count: 2, n12: 2, when: 1, injury: 0, loc: 1, getup: 2, nearFall: true },
          medsDetail: { count: 6, changed: ["dose"], symptoms: ["dizzy"],
                        items: [{ inn: "diazepam", frid: "bzd", lv: 2 }, { inn: "amlodipine", frid: "antihtn", lv: 1 },
                                { inn: "furosemide", frid: "diuretic", lv: 1 }],
                        summary: { high: 1, mod: 2, unknown: 0, needsReview: true } },
          homeDetail: { hazards: ["rug", "wet", "light"], helper: "alone" }
        })
      ]
    },
    safety: {
      key: "safety", label: "ธงความปลอดภัย — หยุดการทดสอบ", color: "#EA580C",
      member: { name: "วิชัย มั่นคง", age: 80, sex: "m", policy: "ดูแลระยะยาว (LTC)" },
      note: "หน้ามืดระหว่างเตรียมทดสอบ และไม่มีผู้ดูแลอยู่ใกล้ — ระบบหยุดทดสอบ ไม่คำนวณคะแนน",
      assessments: [
        mkAssess({ at: daysAgo(120), ftsst: 12.9, tug: 12.2, ftsstPt: 1, fallsPt: 1, medsPt: 1, adlPt: 2, bal: 2, barthel: 17 }),
        mkAssess({ at: daysAgo(1), ftsst: null, tug: null, ftsstPt: 0, fallsPt: 1, medsPt: 1, adlPt: 2, bal: null, barthel: 17,
                   notTested: true, safetyVerdict: "stop",
                   steadi: { unsteady: true, worried: true },
                   safety: { chest: false, faint: true, alone: true } })
      ]
    }
  };

  /* ---------- ขั้นตอนของการสาธิต ----------
     ใช้เป็นแถบความคืบหน้าให้ผู้อัดวิดีโอไม่หลงลำดับ
     และให้ผู้ชมเห็นว่าเส้นทางทั้งเส้นมีกี่ขั้น */
  var STEPS = [
    { k: "load",     t: "โหลดข้อมูลผู้เอาประกัน" },
    { k: "screen",   t: "คัดกรองและความยินยอม" },
    { k: "assess",   t: "ประเมินด้วยกล้องและบันทึกยา" },
    { k: "signal",   t: "ระบบเปิดสัญญาณเสี่ยง" },
    { k: "review",   t: "ผู้ประสานงานรับเคส" },
    { k: "refer",    t: "ส่งต่อผู้เชี่ยวชาญ" },
    { k: "returned", t: "ผลทบทวนส่งกลับ" },
    { k: "followup", t: "ตั้งนัดติดตามและบันทึกผล" }
  ];

  var state = { scenario: null, step: 0, refStatus: "none", review: null };

  function load(key) {
    var s = SCENARIOS[key];
    if (!s) throw new Error("ไม่พบสถานการณ์: " + key);
    state = { scenario: key, step: 1, refStatus: "none", review: null };
    save();
    return JSON.parse(JSON.stringify(s));    /* คืนสำเนา — แก้ของผู้เรียกไม่กระทบต้นฉบับ */
  }
  function current() { return state.scenario ? SCENARIOS[state.scenario] : null }
  function step(k) {
    var i = STEPS.findIndex(function (x) { return x.k === k });
    if (i >= 0 && i + 1 > state.step) { state.step = i + 1; save() }
    return state.step;
  }
  function reset() { state = { scenario: null, step: 0, refStatus: "none", review: null }; save() }
  function save() { try { sessionStorage.setItem("cs-demo-state", JSON.stringify(state)) } catch (e) {} }
  function restore() {
    try { var v = sessionStorage.getItem("cs-demo-state"); if (v) state = JSON.parse(v) } catch (e) {}
    return state;
  }

  /* ---------- การส่งต่อจำลอง ----------
     จำลองเฉพาะ "การตอบกลับของคน" — ผู้เชี่ยวชาญรับเคส ทบทวน แล้วส่งผลกลับ
     ไม่ได้จำลองการตัดสินของระบบ */
  var REF_FLOW = ["requested", "accepted", "reviewed"];
  function advanceReferral() {
    var i = REF_FLOW.indexOf(state.refStatus);
    state.refStatus = i < 0 ? "requested" : REF_FLOW[Math.min(i + 1, REF_FLOW.length - 1)];
    if (state.refStatus === "requested") step("refer");
    if (state.refStatus === "reviewed") {
      step("returned");
      state.review = {
        by: "ภก. อารีย์ สุขใจ · สภาเภสัชกรรม",
        finding: "diazepam 5 mg เป็นยากลุ่ม benzodiazepine ที่ใช้ต่อเนื่อง " +
                 "สัมพันธ์กับการทรงตัวที่แย่ลงและอาการง่วงในผู้สูงอายุ " +
                 "ร่วมกับ furosemide อาจทำให้ความดันตกขณะเปลี่ยนท่า",
        recommend: "เสนอให้แพทย์พิจารณาลดขนาดแบบค่อยเป็นค่อยไป และวัดความดันท่านอน–ท่ายืน",
        next_step: "refer_doctor",
        note: "ไม่ควรหยุดยาเอง — ต้องให้แพทย์เป็นผู้ตัดสิน"
      };
    }
    save();
    return state.refStatus;
  }

  /* ---------- ผลลัพธ์หลังติดตาม (ตัวอย่าง) ----------
     ติดป้ายชัดว่าเป็นตัวอย่างเพื่อแสดงว่าระบบติดตามผลได้
     ไม่ใช่ผลการศึกษา และห้ามใช้อ้างประสิทธิผล */
  function outcome() {
    var s = current(); if (!s || s.key !== "red") return null;
    step("followup");
    return {
      simulated: true,
      before: { tug: 15.4, ftsst: 14.1, barthel: 16, falls12m: 2 },
      after:  { tug: 13.1, ftsst: 13.4, barthel: 17, fallsSince: 0 },
      done:   ["เภสัชกรทบทวนยาแล้ว", "แพทย์ปรับขนาดยา", "นักกายภาพให้โปรแกรมฝึกการทรงตัว",
               "ทีมดูแลช่วยจัดบ้าน: เก็บพรม ติดไฟทางเดิน ติดราวจับห้องน้ำ"],
      caveat: "ตัวเลขนี้เป็นตัวอย่างเพื่อแสดงว่าระบบติดตามผลก่อน–หลังได้ " +
              "ไม่ใช่ผลการศึกษา และไม่ใช่หลักฐานว่าระบบลดการหกล้มได้"
    };
  }

  /* ---------- ป้ายกำกับ ----------
     ต้องเห็นทุกหน้าจอ ไม่ว่าผู้ชมจะเข้ามากลางคลิป */
  function banner() {
    if (!on()) return;
    if (document.getElementById("csDemoBar")) return;
    var css = document.createElement("style");
    css.textContent =
      "#csDemoBar{position:fixed;left:0;right:0;top:0;z-index:9999;background:repeating-linear-gradient(" +
      "45deg,#B45309,#B45309 12px,#92400E 12px,#92400E 24px);color:#fff;font:600 12px/1.5 " +
      "'Prompt',system-ui,sans-serif;text-align:center;padding:5px 12px;letter-spacing:.04em;" +
      "box-shadow:0 2px 10px rgba(0,0,0,.25)}" +
      "#csDemoBar b{color:#FDE68A}" +
      "#csDemoBar button{margin-left:10px;border:1px solid rgba(255,255,255,.5);background:rgba(0,0,0,.2);" +
      "color:#fff;font:inherit;font-size:11px;padding:2px 9px;border-radius:99px;cursor:pointer}" +
      "body{padding-top:26px !important}";
    document.head.appendChild(css);
    var bar = document.createElement("div");
    bar.id = "csDemoBar";
    bar.innerHTML = "โหมดสาธิต · <b>ข้อมูลจำลอง ไม่ใช่ข้อมูลผู้ป่วยจริง</b> · ไม่บันทึกลงฐานข้อมูล" +
      '<button id="csDemoOff">ออกจากโหมดสาธิต</button>';
    document.body.appendChild(bar);
    var b = document.getElementById("csDemoOff");
    if (b) b.addEventListener("click", function () { set(false); reset(); location.reload() });
  }

  /* แถบความคืบหน้าของการสาธิต — คืน HTML ให้หน้าจอเอาไปวางเอง */
  function progressHTML() {
    if (!on() || !state.scenario) return "";
    return '<div class="demoprog">' + STEPS.map(function (s, i) {
      var st = i + 1 < state.step ? "done" : i + 1 === state.step ? "now" : "wait";
      return '<span class="dp" data-st="' + st + '">' +
             (st === "done" ? "✓" : (i + 1)) + " " + s.t + "</span>";
    }).join("") + "</div>";
  }

  root.CSDemo = {
    on: on, set: set, SCENARIOS: SCENARIOS, STEPS: STEPS,
    load: load, current: current, step: step, reset: reset, restore: restore,
    state: function () { return JSON.parse(JSON.stringify(state)) },
    advanceReferral: advanceReferral, outcome: outcome,
    banner: banner, progressHTML: progressHTML
  };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module !== "undefined" && module.exports) module.exports = (typeof window !== "undefined" ? window : globalThis).CSDemo;

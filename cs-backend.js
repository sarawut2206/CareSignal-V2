/* ============================================================
   CareSignal Backend Adapter
   ------------------------------------------------------------
   ชั้นเชื่อมต่อ Supabase ที่ใช้ร่วมกันทั้ง App / Vision / Web

   หลักการออกแบบ:
   1) ถ้าไม่ได้ตั้งค่า Supabase หรือเชื่อมต่อไม่ได้ → ระบบตกกลับไปใช้
      localStorage อัตโนมัติ เดโมจึงทำงานได้เสมอแม้เน็ตล่มกลางเวที
   2) ไม่มีฟังก์ชันใดในไฟล์นี้ส่งภาพหรือวิดีโอ — ส่งเฉพาะตัวเลข
   3) ทุกการกระทำที่แตะข้อมูลส่วนบุคคลเขียน audit log ฝั่งเซิร์ฟเวอร์

   การตั้งค่า: แก้ CS_CONFIG ด้านล่างด้วยค่าจาก
   Supabase → Project Settings → API
   ============================================================ */

var CS_CONFIG = {
  url:     "https://runhkdaizcxhaohajrsn.supabase.co",
  /* Publishable key (ชื่อเดิม: anon key) — ปลอดภัยที่จะอยู่ในโค้ดฝั่งหน้าเว็บ
     เพราะ Row Level Security เป็นตัวคุมสิทธิ์จริง ไม่ใช่ตัว key
     ห้ามใส่ Secret key (sb_secret_...) ลงในไฟล์นี้เด็ดขาด */
  anonKey: "sb_publishable_E0EBdKWexniC2JbwpGaUXQ_PIzDdYYh",
  /* โดเมนสังเคราะห์สำหรับแปลงเบอร์โทรเป็นตัวระบุภายในระบบ auth
     ไม่มีการส่งอีเมลจริงไปที่โดเมนนี้ เพราะต้องปิด "Confirm email" ใน Supabase
     (Authentication → Sign In / Providers → Email → Confirm email = OFF)
     เมื่อสลับไปใช้ OTP ทาง SMS จริงแล้ว ส่วนนี้จะถูกเลิกใช้ */
  phoneDomain: "caresignal.app"
};

var CSBackend = (function () {
  var sb = null;              /* Supabase client */
  var ready = false;
  var mode = "local";         /* cloud | local */
  var profile = null;

  /* ---------- โหลดไลบรารี Supabase แบบ dynamic (ไม่บล็อกหน้าเว็บ) ---------- */
  async function init() {
    if (!CS_CONFIG.url || !CS_CONFIG.anonKey) { mode = "local"; return false; }
    try {
      var mod = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
      /* แยกช่องเก็บ session ตามบริบทของหน้า:
         "member" = แอปผู้เอาประกัน (Vision / App) · "staff" = แดชบอร์ดเจ้าหน้าที่ (Web)
         ก่อนหน้านี้ทุกหน้าบน origin เดียวกันแชร์คีย์เดียว ทำให้เปิดแอปสมาชิก
         ค้างไว้แล้วล็อกอินเจ้าหน้าที่อีกแท็บ token ทับกัน — หน้าเจ้าหน้าที่
         จึงอ่านโปรไฟล์ได้เป็นคนละบัญชีกับที่เพิ่งล็อกอิน (บทบาทเพี้ยน) */
      var scope = (typeof window !== "undefined" && window.CS_AUTH_SCOPE) || "member";
      sb = mod.createClient(CS_CONFIG.url, CS_CONFIG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true,
                storageKey: "cs-auth-" + scope }
      });
      /* เก็บกวาดคีย์รวมรุ่นเก่า กัน session ค้างข้ามบริบท */
      try {
        var ref = CS_CONFIG.url.split("//")[1].split(".")[0];
        localStorage.removeItem("sb-" + ref + "-auth-token");
      } catch (e) {}
      ready = true; mode = "cloud";
      return true;
    } catch (e) {
      console.warn("[CareSignal] เชื่อมต่อฐานข้อมูลกลางไม่ได้ ใช้โหมดในเครื่องแทน", e);
      mode = "local"; return false;
    }
  }

  function isCloud() { return ready && mode === "cloud"; }
  function client()  { return sb; }
  function getMode() { return mode; }

  /* ============================================================
     ยืนยันตัวตน
     ------------------------------------------------------------
     ผู้สูงอายุ: เบอร์โทร + PIN 4 หลัก
       เบอร์โทรถูกแปลงเป็นอีเมลสังเคราะห์ภายใน (ไม่ส่งอีเมลจริง)
       เพื่อให้ใช้ระบบ auth มาตรฐานของ Supabase ได้เต็มรูปแบบ
       สลับเป็น OTP ทาง SMS ได้ทันทีเมื่อสมัครผู้ให้บริการ SMS แล้ว
       โดยไม่ต้องแก้โครงสร้างข้อมูล
     เจ้าหน้าที่: อีเมล + รหัสผ่าน (+ TOTP MFA ผ่าน Supabase)
     ============================================================ */
  function phoneToEmail(phone) {
    var digits = String(phone).replace(/\D/g, "");
    return "u" + digits + "@" + (CS_CONFIG.phoneDomain || "caresignal.app");
  }
  function pinToPassword(phone, pin) {
    /* ผูก PIN กับเบอร์โทร เพื่อไม่ให้ PIN สั้น ๆ ซ้ำกันกลายเป็นรหัสผ่านเดียวกัน */
    return "cs:" + String(phone).replace(/\D/g, "") + ":" + String(pin);
  }

  async function signUpUser(phone, pin, meta) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.auth.signUp({
      email: phoneToEmail(phone),
      password: pinToPassword(phone, pin),
      options: { data: { phone: phone, kind: "user" } }
    });
    if (r.error) throw r.error;
    if (meta) await updateProfile(meta);
    return r.data.user;
  }

  async function signInUser(phone, pin) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.auth.signInWithPassword({
      email: phoneToEmail(phone),
      password: pinToPassword(phone, pin)
    });
    if (r.error) throw r.error;
    await loadProfile();
    return r.data.user;
  }

  async function signInStaff(email, password) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.auth.signInWithPassword({ email: email, password: password });
    if (r.error) throw r.error;
    await loadProfile();
    return r.data.user;
  }

  async function signUpStaff(email, password) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.auth.signUp({ email: email, password: password,
      options: { data: { kind: "staff" } } });
    if (r.error) throw r.error;
    return r.data.user;
  }

  async function signOut() { if (isCloud()) await sb.auth.signOut(); profile = null; }

  async function currentUser() {
    if (!isCloud()) return null;
    var r = await sb.auth.getUser();
    return r.data ? r.data.user : null;
  }

  /* ---------- MFA (TOTP) สำหรับเจ้าหน้าที่ ---------- */
  async function mfaEnroll() {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.auth.mfa.enroll({ factorType: "totp" });
    if (r.error) throw r.error;
    return r.data;   /* มี qr_code (SVG) และ secret ให้แสดงบนหน้าจอ */
  }
  async function mfaVerify(factorId, code) {
    var ch = await sb.auth.mfa.challenge({ factorId: factorId });
    if (ch.error) throw ch.error;
    var r = await sb.auth.mfa.verify({ factorId: factorId, challengeId: ch.data.id, code: code });
    if (r.error) throw r.error;
    return r.data;
  }
  async function mfaFactors() {
    if (!isCloud()) return { totp: [] };
    var r = await sb.auth.mfa.listFactors();
    return r.data || { totp: [] };
  }

  /* ============================================================
     โปรไฟล์
     ============================================================ */
  async function loadProfile() {
    if (!isCloud()) return null;
    var u = await currentUser(); if (!u) return null;
    var r = await sb.from("profiles").select("*").eq("id", u.id).single();
    profile = r.data || null;
    return profile;
  }
  function getProfile() { return profile; }

  async function updateProfile(fields) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("profiles").update(fields).eq("id", u.id).select().single();
    if (r.error) throw r.error;
    profile = r.data;
    return profile;
  }

  /* ============================================================
     ความยินยอม — แยกตามวัตถุประสงค์ ถอนได้ทีละอัน
     ============================================================ */
  async function grantConsent(purpose, version, scope) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("consents").insert({
      user_id: u.id, purpose: purpose, version: version || "PDPA-1.0",
      granted: true, scope: scope || null
    }).select().single();
    if (r.error) throw r.error;
    await audit("consent.grant", u.id, "ยินยอมวัตถุประสงค์: " + purpose, { scope: scope });
    return r.data;
  }

  async function revokeConsent(purpose) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("consents").update({ revoked_at: new Date().toISOString(), granted: false })
      .eq("user_id", u.id).eq("purpose", purpose).is("revoked_at", null);
    if (r.error) throw r.error;
    /* ถอนความยินยอมแชร์ข้อมูล = ปิดการแสดงผลในแดชบอร์ดทันที */
    if (purpose === "share_pool") await updateProfile({ share_pool: false });
    await audit("consent.revoke", u.id, "ถอนความยินยอม: " + purpose);
    return true;
  }

  async function listConsents() {
    if (!isCloud()) return [];
    var u = await currentUser(); if (!u) return [];
    var r = await sb.from("consents").select("*").eq("user_id", u.id)
      .order("granted_at", { ascending: false });
    return r.data || [];
  }

  /* ============================================================
     ผลการประเมิน — ส่งเฉพาะตัวเลข ไม่มีภาพ
     ============================================================ */
  async function saveAssessment(a) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var row = {
      user_id: u.id,
      assessed_at: a.at || new Date().toISOString(),
      method: a.method || "manual",
      ftsst_seconds: a.ftsst != null ? a.ftsst : null,
      tug_seconds:   a.tug   != null ? a.tug   : null,
      reps: a.reps != null ? a.reps : null,
      cadence_cv: a.cv != null ? a.cv : null,
      gaps: a.gaps || null,
      score: a.score, score_max: a.max || 12, tier: a.tier,
      parts: a.parts || {},
      falls_source: a.fallsSource || "self_reported",
      meds_source:  a.medsSource  || "self_reported",
      adl_source:   a.adlSource   || "self_reported",
      identity_verified: !!a.verified,
      engine_version: a.engine || "unknown",
      duration_sec: a.durSec != null ? a.durSec : null,
      /* ข้อมูลเชิงลึกของระบบวงจรปิด v2 */
      safety_gate:    a.safetyGate    || null,
      falls_detail:   a.fallsDetail   || null,
      meds_detail:    a.medsDetail    || null,
      test_quality:   a.testQuality   || null,
      baseline_level: a.baselineLevel || null,
      not_tested:     !!a.notTested
    };
    var r = await sb.from("assessments").insert(row).select().single();
    if (r.error) throw r.error;
    await audit("assessment.create", u.id,
      "บันทึกผลประเมิน คะแนน " + a.score + "/" + (a.max || 12) + " วิธี " + row.method);
    return r.data;
  }

  async function listAssessments(limit) {
    if (!isCloud()) return [];
    var u = await currentUser(); if (!u) return [];
    var r = await sb.from("assessments").select("*").eq("user_id", u.id)
      .order("assessed_at", { ascending: true }).limit(limit || 100);
    return r.data || [];
  }

  /* ============================================================
     สัญญาณความเสี่ยง + การส่งต่อ
     ============================================================ */
  async function saveRiskSignal(assessmentId, tr) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("risk_signals").insert({
      user_id: u.id, assessment_id: assessmentId,
      level: tr.level, flags: tr.flags || [], next_days: tr.nextDays,
      engine_version: tr.engine || "unknown"
    }).select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function createReferral(riskSignalId, tr) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("referrals").insert({
      user_id: u.id, risk_signal_id: riskSignalId,
      level: tr.level, action: tr.referral.nm, sla: tr.referral.sla,
      reasons: (tr.flags || []).map(function (f) { return { id: f.id, text: f.text }; }),
      status: "pending"
    }).select().single();
    if (r.error) throw r.error;
    await audit("referral.create", u.id, "สร้างเคสส่งต่อ: " + tr.referral.nm + " " + tr.referral.sla);
    return r.data;
  }

  /* คิวเคสสำหรับเจ้าหน้าที่ — RLS จะคืนค่าว่างถ้าไม่ใช่ care_manager/admin */
  async function listReferralQueue(status) {
    if (!isCloud()) return [];
    var q = sb.from("referrals")
      .select("*, profiles!referrals_user_id_fkey(pseudonym, display_name, birth_year_be, sex)")
      .order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    var r = await q;
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }

  async function decideReferral(id, approved, note) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("referrals").update({
      status: approved ? "approved" : "declined",
      decided_by: u.id, decided_at: new Date().toISOString(), decision_note: note || null
    }).eq("id", id).select().single();
    if (r.error) throw r.error;
    await audit(approved ? "referral.approve" : "referral.decline", r.data.user_id,
      "ผู้เชี่ยวชาญตัดสินเคส " + id);
    return r.data;
  }

  /* ============================================================
     พอร์ตสำหรับบริษัทประกัน — ผ่าน view ที่ไม่มีชื่อ/เบอร์โทร
     ============================================================ */
  async function insurerPortfolio() {
    if (!isCloud()) return [];
    var r = await sb.from("insurer_portfolio").select("*").limit(500);
    if (r.error) { console.warn(r.error); return []; }
    var u = await currentUser();
    if (u) await audit("portfolio.view", null, "เปิดดูพอร์ตความเสี่ยง " + (r.data || []).length + " ราย");
    return r.data || [];
  }

  /* ชั้นวัดผล — รายงานเชิงกลุ่มแถวเดียว ไม่มีข้อมูลรายบุคคลเลย
     ตัวเลขทุกตัวในนี้นับจริงจากฐานข้อมูล ไม่มีการประมาณการทางการเงินปนมา */
  async function insurerOutcomes() {
    if (!isCloud()) return null;
    var r = await sb.from("insurer_outcomes").select("*").limit(1);
    if (r.error) { console.warn(r.error); return null; }
    var row = (r.data || [])[0] || null;
    if (row) await audit("outcomes.view", null, "เปิดดูรายงานผลลัพธ์เชิงกลุ่ม");
    return row;
  }

  /* ============================================================
     Audit log — เขียนได้อย่างเดียว แก้/ลบไม่ได้แม้แต่ admin
     ============================================================ */
  async function audit(action, subjectId, detail, meta) {
    if (!isCloud()) return;
    try {
      var u = await currentUser(); if (!u) return;
      await sb.from("audit_logs").insert({
        actor_id: u.id, actor_role: profile ? profile.role : null,
        action: action, subject_id: subjectId || null,
        detail: detail || null, meta: meta || null
      });
    } catch (e) { /* ห้าม audit ที่ล้มเหลวทำให้ผู้ใช้ทำงานต่อไม่ได้ */ }
  }

  async function listAudit(limit) {
    if (!isCloud()) return [];
    var r = await sb.from("audit_logs").select("*")
      .order("created_at", { ascending: false }).limit(limit || 50);
    return r.data || [];
  }

  /* ============================================================
     ข้อมูลตรวจสอบความแม่นยำเครื่องมือวัด (Preliminary Technical Validation)
     ------------------------------------------------------------
     ผู้เข้าร่วมนำร่องไม่ต้องมีบัญชี — นักวิจัยที่ล็อกอินเป็นผู้บันทึกแทน
     เก็บรหัสผู้เข้าร่วม (P01, P02) ไม่ใช่ชื่อจริง
     ============================================================ */
  async function saveTrial(t) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("validation_trials").insert({
      researcher_id: u.id, site: t.site || null,
      participant_code: t.pid, trial_no: t.trialNo || 1, method: t.method || null,
      cs_seconds: t.csTime != null ? t.csTime : null,
      ref1_seconds: t.ref1 != null ? t.ref1 : null,
      ref2_seconds: t.ref2 != null ? t.ref2 : null,
      reps: t.reps != null ? t.reps : null,
      reps_correct: t.repsCorrect === true ? true : (t.repsCorrect === false ? false : null),
      cadence_cv: t.cv != null ? t.cv : null, gaps: t.gaps || null,
      sit_ref: t.sitRef != null ? t.sitRef : null,
      stand_ref: t.standRef != null ? t.standRef : null,
      setup_sec: t.setupSec != null ? t.setupSec : null,
      tech_fail: !!t.techFail, notes: t.notes || null
    }).select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function listTrials(limit) {
    if (!isCloud()) return [];
    var r = await sb.from("validation_trials").select("*")
      .order("created_at", { ascending: true }).limit(limit || 1000);
    return r.data || [];
  }

  /* ============================================================
     การตรวจสอบกับเวชระเบียน (Medical Record Verification)
     ------------------------------------------------------------
     ขอบเขตรายครั้ง: ระบุโรงพยาบาล ข้อมูลที่ขอ ช่วงเวลา และวัตถุประสงค์
     ฐานข้อมูลจะปฏิเสธถ้าไม่มีความยินยอมที่ยังไม่ถูกถอน
     ============================================================ */
  async function requestMedicalCheck(req) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("mrv_requests").insert({
      user_id: u.id, assessment_id: req.assessmentId || null,
      hospital: req.hospital, data_items: req.items, period: req.period,
      purpose: req.purpose || "underwriting"
    }).select().single();
    if (r.error) throw r.error;
    await audit("mrv.request", u.id,
      "ขอตรวจสอบเวชระเบียนที่ " + req.hospital + " · " + (req.items || []).join(", ") + " · ช่วง " + req.period);
    return r.data;
  }

  async function listMedicalChecks() {
    if (!isCloud()) return [];
    var u = await currentUser(); if (!u) return [];
    var r = await sb.from("mrv_requests").select("*")
      .eq("user_id", u.id).order("requested_at", { ascending: false });
    return r.data || [];
  }

  /* สำหรับเจ้าหน้าที่: บันทึกผลการตรวจสอบ → ระบบปรับธงแหล่งข้อมูลให้อัตโนมัติ */
  async function completeMedicalCheck(id, outcome) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("mrv_requests").update({
      status: "completed", outcome: outcome, handled_by: u.id
    }).eq("id", id).select().single();
    if (r.error) throw r.error;
    await audit("mrv.complete", r.data.user_id, "บันทึกผลตรวจสอบเวชระเบียน: " + JSON.stringify(outcome));
    return r.data;
  }

  /* ============================================================
     ลายเซ็นใบหน้า — ผูกกับบัญชีคลาวด์แต่ "ไม่อัปโหลด"
     ------------------------------------------------------------
     สำคัญ: ตัวลายเซ็นเก็บใน localStorage ของเครื่องเท่านั้น
     ระบบกลางเก็บเพียงผลการยืนยัน (identity_verified) ซึ่งเป็นค่าจริง/เท็จ
     การผูกกับบัญชีทำโดยใช้ user id ของคลาวด์เป็นกุญแจในเครื่อง
     เพื่อให้คนละบัญชีบนเครื่องเดียวกันไม่ปะปนกัน
     ============================================================ */
  function faceKey(uid) { return "cs:faceSig:" + uid; }
  async function faceStoreLocal(sig) {
    var u = await currentUser();
    var uid = u ? u.id : "local";
    try { localStorage.setItem(faceKey(uid), JSON.stringify(sig)); } catch (e) {}
    if (u) await audit("biometric.enroll", u.id,
      "ลงทะเบียนลายเซ็นใบหน้า 6 ค่าไว้ในเครื่องผู้ใช้ · ไม่อัปโหลดภาพหรือลายเซ็นขึ้นระบบกลาง");
  }
  async function faceLoadLocal() {
    var u = await currentUser();
    var uid = u ? u.id : "local";
    try { var s = localStorage.getItem(faceKey(uid)); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  async function faceClearLocal() {
    var u = await currentUser();
    var uid = u ? u.id : "local";
    try { localStorage.removeItem(faceKey(uid)); } catch (e) {}
  }

  /* ============================================================
     สิทธิลบข้อมูลทั้งหมดตาม PDPA
     ------------------------------------------------------------
     ลบ profile แล้ว cascade ลบ consents/assessments/risk_signals/referrals
     audit_logs คงไว้โดยตัด actor เป็น null เพื่อรักษาความครบถ้วนของร่องรอย
     ============================================================ */
  async function deleteAllMyData() {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    await audit("data.erase", u.id, "ผู้ใช้ใช้สิทธิลบข้อมูลทั้งหมดตาม PDPA");
    var r = await sb.from("profiles").delete().eq("id", u.id);
    if (r.error) throw r.error;
    await signOut();
    return true;
  }


  /* ============================================================
     ระบบครอบครัว — เชิญ → ขอเชื่อม → อนุมัติ → กำหนดสิทธิ์
     ------------------------------------------------------------
     สิทธิ์ทั้งหมดบังคับที่ Row Level Security ฝั่งเซิร์ฟเวอร์:
     ครอบครัวที่ยังไม่ถูกอนุมัติ SELECT อะไรไม่ได้เลย ต่อให้แก้โค้ดนี้
     ============================================================ */
  /* ฝั่งผู้เอาประกัน */
  async function createInvite() {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.rpc("cs_create_invite");
    if (r.error) throw r.error;
    return r.data;                       /* {code, expires_at} */
  }
  async function listMyCarers() {
    if (!isCloud()) return [];
    /* ใช้วิว my_carers เพราะ RLS ของ profiles ห้ามอ่านโปรไฟล์ผู้อื่น
       ถ้า join ตรง ๆ ชื่อผู้ขอเชื่อมต่อจะเป็น null ผู้เอาประกันจะตัดสินใจไม่ได้ */
    var r = await sb.from("my_carers").select("*").order("requested_at", { ascending: false });
    if (r.error) { console.warn(r.error); return []; }
    return (r.data || []).map(function (x) {
      x.carer = { display_name: x.carer_name };
      return x;
    });
  }
  async function decideCarer(linkId, approved, permissions) {
    if (!isCloud()) throw new Error("offline");
    var patch = { status: approved ? "approved" : "declined", decided_at: new Date().toISOString() };
    if (approved && permissions) patch.permissions = permissions;
    var r = await sb.from("caregiver_links").update(patch).eq("id", linkId).select().single();
    if (r.error) throw r.error;
    await audit(approved ? "family.approve" : "family.decline", null,
      (approved ? "อนุมัติ" : "ปฏิเสธ") + "คำขอเชื่อมต่อของครอบครัว");
    return r.data;
  }
  async function updateCarerPermissions(linkId, permissions) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("caregiver_links").update({ permissions: permissions })
      .eq("id", linkId).select().single();
    if (r.error) throw r.error;
    await audit("family.permissions", null, "แก้สิทธิ์การเข้าถึงของครอบครัว");
    return r.data;
  }
  async function revokeCarer(linkId) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("caregiver_links")
      .update({ status: "revoked", decided_at: new Date().toISOString() })
      .eq("id", linkId).select().single();
    if (r.error) throw r.error;
    await audit("family.revoke", null, "ยกเลิกการเชื่อมต่อของครอบครัว");
    return r.data;
  }

  /* ฝั่งครอบครัว */
  async function redeemInvite(code, relationship) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.rpc("cs_redeem_invite", { p_code: code, p_relationship: relationship || null });
    if (r.error) throw r.error;
    return r.data;                       /* {member_id, member_name} */
  }
  async function famMembers() {
    if (!isCloud()) return [];
    var r = await sb.from("family_members").select("*");
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function famAssessments(memberId, limit) {
    if (!isCloud()) return [];
    var r = await sb.from("assessments").select("*")
      .eq("user_id", memberId).order("assessed_at", { ascending: false }).limit(limit || 60);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function famRisk(memberId, limit) {
    if (!isCloud()) return [];
    var r = await sb.from("risk_signals").select("*")
      .eq("user_id", memberId).order("created_at", { ascending: false }).limit(limit || 10);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function famReferrals(memberId, limit) {
    if (!isCloud()) return [];
    var r = await sb.from("referrals").select("*")
      .eq("user_id", memberId).order("created_at", { ascending: false }).limit(limit || 5);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function famNotifications(limit) {
    if (!isCloud()) return [];
    var u = await currentUser(); if (!u) return [];
    var r = await sb.from("family_notifications").select("*")
      .eq("carer_id", u.id).order("created_at", { ascending: false }).limit(limit || 40);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function notifRead(id) {
    if (!isCloud()) return;
    await sb.from("family_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  }
  async function famCancelRequest(linkId) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("caregiver_links")
      .update({ status: "revoked" }).eq("id", linkId).select().single();
    if (r.error) throw r.error;
    return r.data;
  }


  /* ---------- แจ้งเตือน 2 ชั้น + บันทึกการเยี่ยม ----------
     ชั้นที่ 1 (สิทธิ์): ผู้เอาประกันเลือกว่าจะให้แจ้งเรื่องอะไร — อยู่บน link
     ชั้นที่ 2 (ช่องทาง): ครอบครัวเลือกว่าจะรับทางไหน — อยู่ที่บัญชีครอบครัว
     สองอย่างนี้แยกกันโดยตั้งใจ เพราะสิทธิ์ในการเปิดเผยข้อมูลกับความ
     ต้องการรับแจ้งเตือน เป็นคนละเรื่องกัน */
  async function updateNotifyTypes(linkId, types) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("caregiver_links").update({ notify_types: types })
      .eq("id", linkId).select().single();
    if (r.error) throw r.error;
    await audit("family.notify_types", null, "แก้ว่าจะให้แจ้งเตือนครอบครัวเรื่องอะไรบ้าง");
    return r.data;
  }
  async function getNotifyPrefs() {
    if (!isCloud()) return null;
    var u = await currentUser(); if (!u) return null;
    var r = await sb.from("family_notify_prefs").select("*").eq("carer_id", u.id).maybeSingle();
    if (r.error) { console.warn(r.error); return null; }
    return r.data || { carer_id: u.id, channels: { inapp: true, push: false, sms: false } };
  }
  async function saveNotifyPrefs(channels) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("family_notify_prefs")
      .upsert({ carer_id: u.id, channels: channels, updated_at: new Date().toISOString() })
      .select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  async function addCheckin(memberId, note) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("family_checkins")
      .insert({ member_id: memberId, carer_id: u.id, note: note }).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  async function listCheckins(memberId, limit) {
    if (!isCloud()) return [];
    var r = await sb.from("family_checkins").select("*")
      .eq("member_id", memberId).order("created_at", { ascending: false }).limit(limit || 20);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }


  /* ============================================================
     ระบบวงจรปิด — เหตุการณ์ · แผนดูแล · การติดตาม · การส่งต่อ
     ============================================================ */
  async function reportEvent(kind, detail, severity) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    /* ผู้รายงานอาจเป็นครอบครัว จึงต้องระบุ user_id ของเจ้าของข้อมูลแยกจากผู้รายงาน */
    var owner = (detail && detail.memberId) || u.id;
    var r = await sb.from("care_events").insert({
      user_id: owner, reporter_id: u.id, kind: kind,
      detail: detail || null, severity: severity || "medium"
    }).select().single();
    if (r.error) throw r.error;
    await audit("event." + kind, owner, "รายงานเหตุการณ์: " + kind);
    return r.data;
  }
  async function listEvents(userId, limit) {
    if (!isCloud()) return [];
    var u = await currentUser(); if (!u) return [];
    var r = await sb.from("care_events").select("*")
      .eq("user_id", userId || u.id).order("created_at", { ascending: false }).limit(limit || 30);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function savePlan(plan) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var r = await sb.from("care_plans").insert({
      user_id: u.id, assessment_id: plan.assessmentId || null,
      level: plan.level, items: plan.items || [], due_at: plan.dueAt || null
    }).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  async function latestPlan(userId) {
    if (!isCloud()) return null;
    var u = await currentUser(); if (!u) return null;
    var r = await sb.from("care_plans").select("*")
      .eq("user_id", userId || u.id).order("created_at", { ascending: false }).limit(1);
    if (r.error) { console.warn(r.error); return null; }
    return (r.data || [])[0] || null;
  }
  async function updatePlanItems(planId, items) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("care_plans").update({ items: items }).eq("id", planId).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  async function scheduleFollowUps(planId, list) {
    if (!isCloud()) throw new Error("offline");
    var u = await currentUser(); if (!u) throw new Error("no session");
    var rows = list.map(function (f) {
      return { user_id: u.id, plan_id: planId, kind: f.kind, due_at: f.dueAt };
    });
    var r = await sb.from("follow_ups").insert(rows).select();
    if (r.error) throw r.error;
    return r.data;
  }
  async function listFollowUps(userId, limit) {
    if (!isCloud()) return [];
    var u = await currentUser(); if (!u) return [];
    var r = await sb.from("follow_ups").select("*")
      .eq("user_id", userId || u.id).order("due_at", { ascending: true }).limit(limit || 20);
    if (r.error) { console.warn(r.error); return []; }
    return r.data || [];
  }
  async function completeFollowUp(id, note) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("follow_ups")
      .update({ status: "done", done_at: new Date().toISOString(), note: note || null })
      .eq("id", id).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  async function completeReferral(id, note) {
    if (!isCloud()) throw new Error("offline");
    var r = await sb.from("referrals")
      .update({ completed_at: new Date().toISOString(), completed_note: note || null })
      .eq("id", id).select().single();
    if (r.error) throw r.error;
    await audit("referral.completed", null, "ยืนยันว่าไปพบผู้เชี่ยวชาญแล้ว");
    return r.data;
  }

  return {
    init: init, isCloud: isCloud, mode: getMode, client: client,
    signUpUser: signUpUser, signInUser: signInUser,
    signUpStaff: signUpStaff, signInStaff: signInStaff,
    signOut: signOut, currentUser: currentUser,
    mfaEnroll: mfaEnroll, mfaVerify: mfaVerify, mfaFactors: mfaFactors,
    loadProfile: loadProfile, getProfile: getProfile, updateProfile: updateProfile,
    grantConsent: grantConsent, revokeConsent: revokeConsent, listConsents: listConsents,
    saveAssessment: saveAssessment, listAssessments: listAssessments,
    saveRiskSignal: saveRiskSignal, createReferral: createReferral,
    listReferralQueue: listReferralQueue, decideReferral: decideReferral,
    insurerPortfolio: insurerPortfolio, insurerOutcomes: insurerOutcomes,
    createInvite: createInvite, listMyCarers: listMyCarers, decideCarer: decideCarer,
    updateCarerPermissions: updateCarerPermissions, revokeCarer: revokeCarer,
    redeemInvite: redeemInvite, famMembers: famMembers, famAssessments: famAssessments,
    famRisk: famRisk, famReferrals: famReferrals, famNotifications: famNotifications,
    notifRead: notifRead, famCancelRequest: famCancelRequest,
    reportEvent: reportEvent, listEvents: listEvents,
    savePlan: savePlan, latestPlan: latestPlan, updatePlanItems: updatePlanItems,
    scheduleFollowUps: scheduleFollowUps, listFollowUps: listFollowUps,
    completeFollowUp: completeFollowUp, completeReferral: completeReferral,
    updateNotifyTypes: updateNotifyTypes, getNotifyPrefs: getNotifyPrefs,
    saveNotifyPrefs: saveNotifyPrefs, addCheckin: addCheckin, listCheckins: listCheckins,
    saveTrial: saveTrial, listTrials: listTrials,
    requestMedicalCheck: requestMedicalCheck, listMedicalChecks: listMedicalChecks,
    completeMedicalCheck: completeMedicalCheck,
    faceStoreLocal: faceStoreLocal, faceLoadLocal: faceLoadLocal, faceClearLocal: faceClearLocal,
    audit: audit, listAudit: listAudit,
    deleteAllMyData: deleteAllMyData
  };
})();

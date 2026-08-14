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
      sb = mod.createClient(CS_CONFIG.url, CS_CONFIG.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
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
      duration_sec: a.durSec != null ? a.durSec : null
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
    insurerPortfolio: insurerPortfolio,
    audit: audit, listAudit: listAudit,
    deleteAllMyData: deleteAllMyData
  };
})();

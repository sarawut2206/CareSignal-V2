# CareSignal — รายงานการตรวจสอบความสอดคล้อง

| | |
|---|---|
| วันที่ตรวจ | 2026-08-18 02:16 |
| เวอร์ชันที่ตรวจ | 2.1.0-vision |
| ขอบเขต | requirements · workflow · scope · rules engine · สิทธิ์ข้อมูล |
| ผู้ตรวจ | เครื่องมืออัตโนมัติ (อ่านอย่างเดียว ไม่แก้ระบบ) |
| **ผลรวม** | **PASS** |

> ตัวตรวจนี้ตรวจ "ความสอดคล้องระหว่างโปรแกรมกับแผนงาน" เท่านั้น
> **ไม่ใช่การรับรองทางคลินิก และไม่ใช่การยืนยันว่าระบบพร้อมใช้งานจริง**
> ข้อที่ตรวจด้วยการอ่านโค้ดไม่ได้ ถูกรายงานเป็น UNVERIFIABLE ไม่นับเป็นผ่าน

## สรุปตัวเลข

| สถานะ | จำนวน |
|---|---:|
| PASS | 52 |
| PARTIAL | 0 |
| MISSING | 0 |
| VIOLATION | 0 |
| UNVERIFIABLE | 6 |

| ความรุนแรงของสิ่งที่พบ | จำนวน |
|---|---:|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

## ชั้นที่ 1 — ความครบถ้วนของฟีเจอร์

| รหัส | ข้อกำหนด | สถานะ | หลักฐาน |
|---|---|---|---|
| F-01 | Consent — มีหน้าขอความยินยอมและบันทึกเวลา | PASS | CareSignal-App.html:726 · CareSignal-Vision.html:1144 · cs-backend.js:177 |
| F-02 | Falls history — บันทึกย้อนหลัง 12 เดือน | PASS | CareSignal-App.html:889 · CareSignal-Vision.html:467 · supabase/07_closed_loop.sql:17 |
| F-03 | Medication risk — OCR + ผู้ใช้ยืนยัน + ส่งเภสัชกร | PASS | CareSignal-App.html:2370 · CareSignal-Vision.html:3303 · CareSignal-App.html:2511 |
| F-04 | FTSST / TUG — มี safety gate ก่อนทดสอบ และบันทึกผล | PASS | CareSignal-App.html:865 · CareSignal-Vision.html:443 · supabase/01_schema.sql:79 |
| F-05 | Barthel ADL — คำนวณและแสดงแนวโน้ม | PASS | CareSignal-App.html:2669 · CareSignal-Vision.html:3177 · CareSignal-App.html:1925 |
| F-06 | Risk engine — Green/Yellow/Red ตามกฎที่ประกาศ | PASS | CareSignal-App.html:1150 · CareSignal-Vision.html:712 · CareSignal-App.html:953 |
| F-07 | Case workflow — สถานะเปลี่ยนตามลำดับที่กำหนด | PASS | CareSignal-Staff.html:229 · supabase/09_insurtech.sql:20 |
| F-08 | Referral — บันทึกผู้รับผิดชอบและสถานะส่งต่อ | PASS | supabase/01_schema.sql:129 · supabase/02_rls.sql:106 · supabase/01_schema.sql:22 |
| F-09 | Follow-up — มี due date และการเตือนเมื่อเกินกำหนด | PASS | supabase/07_closed_loop.sql:42 · supabase/08_outcomes.sql:69 · supabase/11_dashboards.sql:47 |
| F-10 | Audit log — ตรวจย้อนได้ว่าใครทำอะไรเมื่อใด | PASS | supabase/01_schema.sql:7 · supabase/02_rls.sql:12 · cs-backend.js:589 |
| F-11 | Insurer dashboard — aggregate / de-identified เท่านั้น | PASS | supabase/08_outcomes.sql:16 · supabase/11_dashboards.sql:215 · supabase/11_dashboards.sql:16 |
| F-12 | Case ownership — บันทึกว่าใครรับผิดชอบเคส | PASS | supabase/09_insurtech.sql:48 · supabase/11_dashboards.sql:72 · cs-backend.js:300 |

## ชั้นที่ 2 — Workflow แบบ End-to-End

| รหัส | ข้อกำหนด | สถานะ | หลักฐาน |
|---|---|---|---|
| W-01 | ระบบรับข้อมูลครบ (safety gate → falls → meds → FTSST → TUG → ADL) | PASS | ตรวจพบในซอร์ส |
| W-02 | สร้าง Red signal จากเอนจิน | PASS | ตรวจพบในซอร์ส |
| W-03 | เปิดเคสให้ Care Manager อัตโนมัติ | PASS | ตรวจพบในซอร์ส |
| W-04 | แสดงเหตุผลของระดับ (อธิบายได้) | PASS | ตรวจพบในซอร์ส |
| W-05 | มีผู้รับผิดชอบเคส | PASS | ตรวจพบในซอร์ส |
| W-06 | มีวันครบกำหนดติดต่อ (SLA) | PASS | ตรวจพบในซอร์ส |
| W-07 | ส่งต่อเภสัชกร/แพทย์ได้ | PASS | ตรวจพบในซอร์ส |
| W-08 | แจ้งครอบครัวตาม consent | PASS | ตรวจพบในซอร์ส |
| W-09 | บันทึกผลการตรวจโดยผู้เชี่ยวชาญ | PASS | ตรวจพบในซอร์ส |
| W-10 | สร้างงานติดตาม (follow-up) | PASS | ตรวจพบในซอร์ส |
| W-12 | มี audit log ทุกขั้นตอนสำคัญ | PASS | ตรวจพบในซอร์ส |
| W-11 | ปิดเคสต้องผ่านคน ไม่มีทางปิดอัตโนมัติ | PASS | จุดที่เปลี่ยนเป็น stable/closed: cs-backend.js:348 · RLS cases_staff: true |
| W-13 | สถานะใน UI ต้องมีอยู่จริงในฐานข้อมูล | PASS | UI: new,reviewing,contacted,care_plan_agreed,referred,appointment_booked,service_completed,follow_up_due,intervention · DB: new,reviewing,contacted,re · สถานะที่มีใน DB แต่ UI ไม่ใช้: stable |

## ชั้นที่ 3 — ขอบเขตของระบบ

| รหัส | ข้อกำหนด | สถานะ | หลักฐาน |
|---|---|---|---|
| S-01 | ต้องไม่มี: ระบบวินิจฉัยโรค | PASS | ไม่พบ |
| S-02 | ต้องไม่มี: ระบบยืนยันว่าจะหกล้มแน่นอน | PASS | ไม่พบ |
| S-03 | ต้องไม่มี: ระบบสั่งหยุดยา | PASS | ไม่พบ |
| S-04 | ต้องไม่มี: ระบบสั่งปรับขนาดยาเอง | PASS | ไม่พบ |
| S-05 | ต้องไม่มี: ระบบอนุมัติหรือปฏิเสธเคลม | PASS | ไม่พบ |
| S-06 | ต้องไม่มี: ระบบคำนวณเบี้ยจากความเสี่ยง | PASS | ไม่พบ |
| S-07 | ต้องไม่มี: ระบบให้ส่วนลดหรือปรับสิทธิประโยชน์ | PASS | ไม่พบ |
| S-08 | ต้องไม่มี: ระบบกำหนดหรือปรับระยะรอคอย | PASS | ไม่พบ |
| S-09 | ต้องไม่มี: เปิดเผยข้อมูลรายคนให้บริษัทประกันเกินจำเป็น | PASS | insurer_portfolio ไม่มีคอลัมน์คลินิก/ระบุตัวตน |
| S-10 | ต้องไม่มี: AI ตัดสิน balance pass/fail เอง | PASS | ปุ่มยืนยันโดยคน: true · ไม่อยู่ในคะแนนหลัก: true · ไม่ใช้ลำตัวตัดสิน: true |

## ชั้นที่ 4 — Rules Engine (รันจริง)

| รหัส | ข้อกำหนด | สถานะ | หลักฐาน |
|---|---|---|---|
| E-01 | ไม่เคยหกล้ม ผลคงที่ → เขียว | PASS | level=stable signals=[] rules=[] |
| E-02 | หกล้ม 1 ครั้ง ไม่มีสัญญาณอื่น → อย่างน้อยเฝ้าสังเกต | PASS | level=watch signals=[S1] rules=[B7] |
| E-03 | หกล้ม 2 ครั้งใน 12 เดือน → เร่งด่วน (ตั้งแต่ครั้งแรก) | PASS | level=urgent signals=[S2] rules=[B1] |
| E-04 | ล้มแล้วลุกเองไม่ได้ → เร่งด่วน | PASS | level=urgent signals=[S2,S1] rules=[B4,B7] |
| E-05 | TUG ≥ 12 วินาที → เปิดสัญญาณการเดิน (S5) | PASS | level=watch signals=[S5] rules=[R10,B10] |
| E-06 | ยากลุ่มเสี่ยงสูง 2 กลุ่ม + ทรงตัวบกพร่อง → S3 ส่งเภสัชกร | PASS | level=urgent signals=[S3] rules=[B6,B12,B13] |
| E-07 | Safety gate หยุดทดสอบ → S7 ธงแดงความปลอดภัย | PASS | level=urgent signals=[S7] rules=[B5] |
| E-08 | ADL ลดลงจากครั้งก่อน → S6 ส่งพยาบาล | PASS | level=urgent signals=[S6] rules=[R6] |
| E-09 | ทุกระดับที่ไม่ใช่เขียว ต้องเปิดเคส | PASS | level=urgent signals=[S2] rules=[B1] |
| E-10 | การทรงตัวไม่มีผลต่อคะแนนรวม | PASS | score(balance=0) === score(balance=3) |

## ชั้นที่ 5 — สิทธิ์และข้อมูลส่วนบุคคล

| รหัส | ข้อกำหนด | สถานะ | หลักฐาน |
|---|---|---|---|
| P-01 | ทุกตารางข้อมูลส่วนบุคคลเปิด RLS | PASS | ครบ 11 ตาราง |
| P-02 | บริษัทประกันเข้าไม่ถึงคิวงานรายเคส | PASS | cm_worklist มี cs_is_staff() และ cs_is_staff ไม่รวม insurer |
| P-03 | ครอบครัวเห็นข้อมูลเฉพาะที่ได้รับอนุญาตรายข้อ | PASS | policy ตรวจ permissions รายคีย์ + ต้อง approved |
| P-04 | รูปซองยาเก็บใน bucket ส่วนตัว path ผูกกับเจ้าของ | PASS | bucket private + path ขึ้นต้นด้วย user_id |
| P-05 | การแยกกลุ่มระดับพอร์ตกดตัวเลขเมื่อกลุ่มเล็ก | PASS | insurer_strata ใช้ cs_min_cell() และมีธง suppressed |
| P-06 | ทุกการเปิดดูข้อมูลผู้อื่นเขียน audit log | PASS | พบ: portfolio.view,case.open,worklist.view,case.queue |
| P-07 | ความยินยอมถอนได้และมีบันทึกเวลา | PASS | พบเส้นทางถอนความยินยอม |

## ชั้นที่ 6 — สิ่งที่ตรวจยืนยันไม่ได้

| รหัส | ข้อกำหนด | สถานะ | หลักฐาน |
|---|---|---|---|
| U-01 | ความแม่นยำของ OCR กับฉลากยาไทยของจริง | UNVERIFIABLE | - · ทดสอบกับภาพสังเคราะห์เท่านั้น ยังไม่มีชุดภาพฉลากจริงที่มีเฉลย |
| U-02 | ความแม่นยำของการตรวจจับท่าทางเทียบผู้เชี่ยวชาญ | UNVERIFIABLE | - · ยังไม่มีการวัดคู่ขนานกับนักกายภาพบำบัด |
| U-03 | ความถูกต้องของการจัดระดับความเสี่ยงในทางคลินิก | UNVERIFIABLE | - · กฎมาจากวรรณกรรม แต่ยังไม่ได้ validate กับผลลัพธ์จริงในประชากรไทย |
| U-04 | ประสิทธิผลในการลดการหกล้มหรือลดการเคลม | UNVERIFIABLE | - · ยังไม่มีข้อมูลนำร่องและไม่มีกลุ่มเปรียบเทียบ |
| U-05 | ความปลอดภัยของการให้ผู้สูงอายุทดสอบเองที่บ้าน | UNVERIFIABLE | - · มี Safety Gate แต่ยังไม่มีข้อมูลเหตุการณ์ไม่พึงประสงค์จากการใช้จริง |
| U-06 | ความทนทานของระบบรู้จำเสียงกับสำเนียงและเสียงรบกวนจริง | UNVERIFIABLE | - · ทดสอบด้วยข้อความจำลอง ยังไม่มีการทดสอบภาคสนาม |

## สิ่งที่พบและข้อเสนอแก้ไข

ไม่พบข้อขัดแย้งกับแผนงานในรอบนี้

## เกณฑ์การตัดสิน

- **FAIL** — พบ Critical อย่างน้อย 1 ข้อ
- **CONDITIONAL PASS** — ไม่มี Critical แต่มี High/Medium หรือมีข้อที่ยืนยันไม่ได้ในจุดสำคัญ
- **PASS** — ไม่พบข้อขัดแย้งเลย

## ข้อจำกัดของการตรวจนี้ (ประกาศไว้ให้ชัด)

1. ตรวจจากซอร์สโค้ดและสคีมา **ไม่ได้ตรวจระบบที่กำลังรันจริงกับผู้ใช้จริง**
2. **ไม่ได้ตรวจความถูกต้องทางคลินิก** ของเกณฑ์ที่ใช้ — ตรวจเพียงว่าระบบทำตามเกณฑ์ที่ประกาศไว้
3. การไม่พบรูปแบบต้องห้าม **ไม่ได้แปลว่าไม่มีทางเกิดขึ้นได้** เพียงแปลว่าไม่พบด้วยวิธีที่ใช้
4. ผลนี้**ใช้แทนการตรวจโดยผู้เชี่ยวชาญไม่ได้** และไม่ใช่หลักฐานว่าผ่าน clinical validation

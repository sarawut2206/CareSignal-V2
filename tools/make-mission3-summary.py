# -*- coding: utf-8 -*-
"""
make-mission3-summary.py — ใบสรุปผลการสำรวจ ภารกิจที่ 3 (หนึ่งหน้า) + ภาคผนวกข้อมูลผู้ให้ข้อมูล
-----------------------------------------------------------------------------------------
python tools/make-mission3-summary.py
  → validation/สรุปผลการสำรวจ-ภารกิจ3-CareSignal-ฉบับ2.docx และ .pdf   (1 หน้า)
  → validation/ภาคผนวก-ข้อมูลผู้ให้ข้อมูล-ภารกิจ3-ฉบับ2.docx และ .pdf   (1 หน้า)

ตัวเลขของกลุ่มลูกหลานคำนวณจาก PEOPLE ซึ่งถอดจากคำตอบจริงที่ผู้ใช้ส่งมาเมื่อ 16 ก.ย. 2569
กลุ่มผู้สูงอายุมีเพียงข้อสรุปภาพรวม (ELDER_FINDINGS) จึงเขียนเชิงคุณภาพ ไม่แปลงเป็นตัวเลขหรือคะแนน
ห้ามเพิ่มคนหรือเติมคำตอบที่ไม่ได้ถาม — ค่าที่ไม่ได้ถามเป็น None

ถ้อยคำต้องตรงกับสิ่งที่ CareSignal ทำจริง: ประเมินเป็นรอบด้วยแบบทดสอบหน้ากล้อง
ไม่ใช่ระบบตรวจจับการล้มอัตโนมัติ ไม่วินิจฉัยโรค ไม่แทนการตรวจที่โรงพยาบาล
"""
import os, sys, importlib.util
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("kit", os.path.join(HERE, "make-bangkhae-kit.py"))
kit = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(kit)
for _k in ("para", "rich", "table", "box", "h1", "h2", "set_font", "BRAND", "INK2", "WARN",
           "FONT", "FEATURES", "ROOT", "OUT_DIR"):
    globals()[_k] = getattr(kit, _k)

OUT = os.path.join(OUT_DIR, "สรุปผลการสำรวจ-ภารกิจ3-CareSignal-ฉบับ2")
OUT_APX = os.path.join(OUT_DIR, "ภาคผนวก-ข้อมูลผู้ให้ข้อมูล-ภารกิจ3-ฉบับ2")

LONG = {
    "F1": "ประเมินความเสี่ยงด้านการเคลื่อนไหวและการหกล้มจากที่บ้านผ่านกล้องมือถือ",
    "F2": "ทราบระดับความเสี่ยงต่อการหกล้มได้ทันที พร้อมเหตุผล",
    "F7": "ดูผลย้อนหลังและแนวโน้มว่าความเสี่ยงดีขึ้นหรือแย่ลง",
}
SHORT = {
    "F1": "ประเมินความเสี่ยงจากที่บ้านผ่านกล้องมือถือ",
    "F2": "รู้ผลทันทีว่าเสี่ยงระดับไหน พร้อมเหตุผล",
    "F3": "ลูกหลานได้รับแจ้งเมื่อผลแย่ลง",
    "F4": "เจ้าหน้าที่โทรกลับใน 1–3 วัน",
    "F5": "เภสัชกรช่วยดูยาที่เสี่ยงล้ม",
    "F6": "ส่งต่อนักกายภาพพร้อมข้อมูล",
    "F7": "ดูย้อนหลังว่าดีขึ้นหรือแย่ลง",
    "F8": "ภาพไม่ออกจากเครื่อง ลบข้อมูลได้",
}

# กลุ่ม ข ลูกหลานผู้ดูแล · ครูที่มีพ่อแม่อายุ 60+ · ถอดจากคำตอบจริง · None = ไม่ได้ถาม
PEOPLE = [
    dict(code="R01", method="แบบสอบถามตอบเอง", parent_age=75, living=None,
         fell_or_near=True, fell_detail="ตอบว่า เคย (ข้อคำถามรวมล้มและเกือบล้ม)",
         assessed=False, worry="กังวลมาก", setup="ต้องมีคนช่วย",
         understood_as="โปรแกรมแจ้งเตือนและตรวจจับความผิดปกติ",
         helps="ยังไม่แน่ใจ", obstacle="การเข้าใช้โปรแกรม",
         on_alert=None, spend=None, daily=None,
         top3=["F2", "F7", "F1"]),
    dict(code="R02", method="สัมภาษณ์ตัวต่อตัว", parent_age=76, living="อยู่บ้านเดียวกัน",
         fell_or_near=True, fell_detail="คุณพ่อเคยล้มประมาณ 3 ครั้ง เมื่อต้นปี 2569",
         assessed=False, worry=None, setup=None,
         understood_as="โปรแกรมที่บ่งบอกและประเมินสุขภาพ",
         helps=None, obstacle=None,
         on_alert="พาไปพบแพทย์", spend="เวลาและเงินค่ารักษา และยาบำรุง",
         daily="สุขภาพไม่แข็งแรง มีโรคประจำตัว เวลาอยากรู้อาการจะโทรถามพ่อแม่",
         top3=["F1", "F2", "F7"]),
]

# กลุ่ม ก ผู้สูงอายุ (แม่บ้านอายุ 60+) · สัมภาษณ์ · ผู้ใช้สรุปมาเป็นภาพรวม ยังไม่มีคำตอบรายคน
ELDERS_N = 3
ELDER_FINDINGS = {
    "falls": "บางรายเคยหกล้มมากกว่าปีละครั้ง บางรายประมาณ 3–4 ครั้งต่อปี",
    "worry": "กังวลเรื่องการหกล้ม การเจ็บป่วย และการล้มจนกลายเป็นผู้ป่วยติดเตียง",
    "checkup": "อย่างน้อย 1 ใน 3 คนไม่เคยตรวจสุขภาพประจำปี",
    "apps": "หลายคนติดตั้งหรือจัดการแอปเองไม่ได้ ต้องให้ลูกหลานช่วย",
    "wants": "ต้องการให้แจ้งลูกหลานเมื่อพบความเสี่ยงหรือเกิดเหตุ · ประเมินได้จากที่บ้าน · รู้ผลทันทีว่าเสี่ยงระดับไหน",
}


def scores():
    s = {f: 0 for f, _ in FEATURES}
    picks = {f: 0 for f, _ in FEATURES}
    for p in PEOPLE:
        for i, f in enumerate(p["top3"][:3]):
            s[f] += 3 - i
            picks[f] += 1
    order = sorted(s, key=lambda f: (-s[f], -picks[f], f))
    return s, picks, order


def count(key, val=True):
    asked = [p for p in PEOPLE if p[key] is not None]
    return sum(1 for p in asked if p[key] == val), len(asked)


def setup_doc(footer):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(1.8)
    sec.top_margin, sec.bottom_margin = Cm(1.2), Cm(1.0)
    sec.footer_distance = Cm(0.45)
    st = doc.styles["Normal"]; st.font.name = FONT; st.font.size = Pt(13)
    st.element.rPr.rFonts.set(qn("w:cs"), FONT); st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(fp.add_run(footer), 10, False, INK2)
    return doc


def bullet(doc, parts, size=13):
    rich(doc, [("•  ", True, BRAND)] + parts, size=size, after=0, indent=0.3)


def build_summary():
    nf = len(PEOPLE)
    s, picks, order = scores()
    fell, fell_n = count("fell_or_near")
    never = sum(1 for p in PEOPLE if p["assessed"] is False)
    never_n = sum(1 for p in PEOPLE if p["assessed"] is not None)
    methods = {}
    for p in PEOPLE:
        methods[p["method"]] = methods.get(p["method"], 0) + 1
    fam_methods = " · ".join(f"{k} {v} คน" for k, v in methods.items())

    doc = setup_doc("ทีม CareSignal · OIC InsurTech Award 2026 · ภารกิจที่ 3 Idea Validation · ข้อมูลจากผู้ให้ข้อมูลจริง ไม่มีการเติมหรือประมาณค่า")
    h1(doc, "CareSignal – Idea Validation",
       "OIC InsurTech Award 2026 · ประเภทบุคคลทั่วไป · เก็บข้อมูลวันที่ 15–16 กันยายน 2569", first=True)
    box(doc, "สิ่งที่นำไปทดสอบ",
        "ประเมินและเฝ้าระวังความเสี่ยงหกล้มเบื้องต้นจากที่บ้าน ด้วยแบบทดสอบสั้น ๆ หน้ากล้องมือถือเป็นรอบ เทียบกับผลครั้งก่อนของตัวเอง "
        "แล้วส่งข้อมูลให้ครอบครัวดำเนินการต่อได้เร็วขึ้น — ไม่วินิจฉัยโรค ไม่แทนการตรวจที่โรงพยาบาล")

    h2(doc, f"1. กลุ่มเป้าหมายและผู้ให้ข้อมูล · รวม {ELDERS_N + nf} คน")
    bullet(doc, [("ผู้สูงอายุ 60 ปีขึ้นไป ", True, None), (f"{ELDERS_N} คน", True, None),
                 (" (แม่บ้านที่ยังทำงาน) · สัมภาษณ์ตัวต่อตัว", False, None)])
    bullet(doc, [("ลูกหลานผู้ดูแล (Family Caregiver) ", True, None), (f"{nf} คน", True, None),
                 (" (ครูที่มีบิดามารดาอายุ 75–76 ปี) · " + fam_methods, False, None)])

    h2(doc, "2. ปัญหาที่ CareSignal กำลังแก้ พบจริงหรือไม่ — พบจริงในทั้งสองกลุ่ม")
    bullet(doc, [("ผู้สูงอายุ: ", True, None),
                 (ELDER_FINDINGS["falls"] + " · " + ELDER_FINDINGS["worry"] + " · " + ELDER_FINDINGS["checkup"], False, None)])
    bullet(doc, [("ครอบครัว: ", True, None),
                 (f"{fell} จาก {fell_n} ครอบครัว ผู้สูงอายุเคยหกล้มในปีที่ผ่านมา (รายหนึ่งประมาณ 3 ครั้ง) แต่ ", False, None),
                 (f"{never} จาก {never_n} ไม่เคยได้รับการประเมินการทรงตัว", True, None),
                 (" · รายหนึ่งกังวลมาก อีกรายมีภาระทั้งเวลาและค่ารักษา", False, None)])

    h2(doc, "3. Solution ช่วยแก้ปัญหาได้หรือไม่ — เห็นประโยชน์ แต่ต้องสื่อสารให้ชัดขึ้น")
    bullet(doc, [("ทั้งสองกลุ่มเห็นประโยชน์ของการ ", False, None),
                 ("ประเมินจากที่บ้าน รู้ผลทันที และติดตามการเปลี่ยนแปลง", True, None),
                 (" · ถ้าความเสี่ยงเพิ่มขึ้น ผู้ดูแลจะพาไปพบแพทย์", False, None)])
    bullet(doc, [("ผู้ดูแล 1 คน ", False, None), ("\"ยังไม่แน่ใจ\"", True, None),
                 (" ว่าช่วยลดความเสี่ยงได้ · ทั้ง 2 คนเข้าใจคลาดเคลื่อนว่าเป็นระบบแจ้งเตือนหรือตรวจสุขภาพทั่วไป", False, None)])

    h2(doc, "4. Feature ที่ผู้ใช้ให้ความสำคัญ")
    rows = []
    for rank, f in enumerate([f for f in order if s[f] > 0], 1):
        rows.append([str(rank), LONG.get(f, SHORT[f]), f"{s[f]} คะแนน · เลือก {picks[f]}/{nf} คน"])
    table(doc, ["อันดับ", f"ลูกหลานผู้ดูแล {nf} คน · อันดับ 1 = 3 คะแนน · 2 = 2 · 3 = 1", "ผล"],
          rows, [1.6, 11.4, 4.4], size=12.5)
    bullet(doc, [("ผู้สูงอายุ 3 คน ให้ความสำคัญกับ: ", True, None), (ELDER_FINDINGS["wants"], False, None)])
    bullet(doc, [("ข้อสังเกต: ", True, None),
                 ("การแจ้งลูกหลานมาจากกลุ่มผู้สูงอายุ · เภสัชกร นักกายภาพ และเจ้าหน้าที่โทรกลับ ไม่มีผู้ดูแลเลือก", False, None)])

    box(doc, "Insight สำคัญ",
        "ผู้สูงอายุหลายคนติดตั้งหรือใช้แอปเองไม่ได้ และผู้ใช้สนใจว่า \"ถ้ามีความเสี่ยง ใครจะรู้ และรู้เร็วแค่ไหน\" "
        "มากกว่าตัวเทคโนโลยี — ลูกหลานจึงควรเป็นผู้ตั้งค่าและรับข้อมูล ส่วนผู้สูงอายุทำเพียงแบบทดสอบสั้น ๆ",
        fill="FFF7ED", color=WARN)

    h2(doc, "5. ทีมจะนำ Feedback ไปปรับ CareSignal อย่างไร")
    table(doc, ["Feedback", "Product Decision"], [
        ["ผู้สูงอายุใช้แอปเองไม่ได้",
         "เพิ่มโหมดให้ลูกหลานเป็นผู้ตั้งค่าและดูแลแอป ผู้สูงอายุกดปุ่มเดียวเพื่อเริ่มทดสอบตามนัด"],
        ["ผู้สูงอายุต้องการให้แจ้งลูกหลาน",
         "ยกการแจ้งลูกหลานขึ้นเป็นฟีเจอร์หลัก ส่งทันทีเมื่อผลแย่ลงหรือมีการกดแจ้งว่าล้ม"],
        ["ผู้ดูแลเลือกผลทันที ประเมินที่บ้าน แนวโน้ม",
         "หน้าผลบอกระดับความเสี่ยงเป็นสีพร้อมเหตุผลภาษาง่าย และมีกราฟแนวโน้มในมุมมองของลูกหลาน"],
        ["เข้าใจคลาดเคลื่อน / ยังไม่แน่ใจว่าช่วยได้",
         "สื่อสารใหม่ว่า \"วัดแรงขาเป็นรอบ ก่อนล้ม\" พร้อมวิดีโอสาธิต และใบสรุปผลให้พกไปพบแพทย์"],
    ], [5.4, 12.0], size=12.5)
    para(doc, f"ข้อจำกัด: กลุ่มตัวอย่าง {ELDERS_N + nf} คนจากโรงเรียนเดียวกัน ผลนี้ใช้กับผู้ให้ข้อมูลครั้งนี้ ไม่ใช่ข้อสรุปของผู้สูงอายุทั่วไป "
              "· ข้อค้นพบของกลุ่มผู้สูงอายุสรุปเชิงคุณภาพ",
         size=11.5, color=INK2, after=0)
    path = OUT + ".docx"
    doc.save(path)
    return path


def build_appendix():
    doc = setup_doc("ภาคผนวก · ข้อมูลผู้ให้ข้อมูลที่ถอดจากแบบสอบถามและการสัมภาษณ์ · รหัสแทนชื่อจริง")
    h1(doc, "ภาคผนวก · ข้อมูลผู้ให้ข้อมูล",
       "ถอดจากคำตอบจริง ใช้รหัสแทนชื่อ · ช่องขีด (–) คือข้อที่ไม่ได้ถาม · R01–R02 คือลูกหลานผู้ดูแล", first=True)
    labels = [
        ("วิธีเก็บข้อมูล", "method"), ("อายุพ่อหรือแม่", "parent_age"), ("การอยู่อาศัย", "living"),
        ("ชีวิตประจำวันของพ่อแม่", "daily"),
        ("ล้มหรือเกือบล้มในหนึ่งปี", "fell_detail"), ("เคยถูกวัดการทรงตัวหรือกำลังขา", "assessed"),
        ("ความกังวลเรื่องการล้ม", "worry"), ("การติดตั้งแอป", "setup"),
        ("ใช้เวลาหรือเงินกับเรื่องนี้", "spend"), ("ถ้าได้ข้อความว่าผลแย่ลง จะทำอะไร", "on_alert"),
        ("เข้าใจว่าโปรแกรมทำอะไร (คำของผู้ให้ข้อมูล)", "understood_as"),
        ("โปรแกรมช่วยเรื่องความเสี่ยงล้มได้ไหม", "helps"), ("อุปสรรคในการใช้", "obstacle"),
        ("ฟีเจอร์อันดับ 1–3", "top3"),
    ]

    def show(p, k):
        v = p[k]
        if v is None:
            return "–"
        if k == "assessed":
            return "ไม่เคย" if v is False else "เคย"
        if k == "parent_age":
            return f"ประมาณ {v} ปี"
        if k == "top3":
            return "  ".join(f"{i}. {f} {SHORT[f]}" for i, f in enumerate(v, 1))
        return str(v)

    rows = [[lab] + [show(p, k) for p in PEOPLE] for lab, k in labels]
    table(doc, ["หัวข้อ"] + [p["code"] for p in PEOPLE], rows, [5.0, 6.2, 6.2], size=12)
    h2(doc, f"กลุ่มผู้สูงอายุ {ELDERS_N} คน (แม่บ้านอายุ 60 ปีขึ้นไป · สัมภาษณ์) — สรุปรวม")
    for k in ("falls", "worry", "checkup", "apps", "wants"):
        rich(doc, [("•  ", True, BRAND), (ELDER_FINDINGS[k], False, None)], size=12.5, after=0, indent=0.3)
    h2(doc, "ข้อความเต็มของบัตรฟีเจอร์ที่ใช้")
    for f, nm in FEATURES:
        rich(doc, [(f + "  ", True, BRAND), (nm, False, None)], size=12, after=0, indent=0.3)
    para(doc, "", size=4)
    para(doc, "R01 ตอบแบบสอบถามด้วยตนเองหลังอ่านใบอธิบายโปรแกรม · R02 สัมภาษณ์ตัวต่อตัวโดยหัวหน้าทีม "
              "หลังอธิบายโปรแกรมและให้อ่านใบอธิบาย",
         size=11.5, color=INK2, after=0)
    path = OUT_APX + ".docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    for docx in (build_summary(), build_appendix()):
        print("เขียน", os.path.relpath(docx, ROOT))
        if "--no-pdf" not in sys.argv:
            pdf = docx[:-5] + ".pdf"
            print("เขียน", os.path.relpath(pdf, ROOT), "·", kit.to_pdf(docx, pdf), "หน้า")

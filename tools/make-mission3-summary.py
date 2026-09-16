# -*- coding: utf-8 -*-
"""
make-mission3-summary.py — ใบสรุปผลการสำรวจ ภารกิจที่ 3 (หนึ่งหน้า) + ภาคผนวกข้อมูลรายคน
-------------------------------------------------------------------------------------
python tools/make-mission3-summary.py
  → validation/สรุปผลการสำรวจ-ภารกิจ3-CareSignal.docx และ .pdf   (1 หน้า)
  → validation/ภาคผนวก-ข้อมูลรายคน-ภารกิจ3.docx และ .pdf         (1 หน้า)

ตัวเลขทุกตัวคำนวณจาก PEOPLE ด้านล่าง ซึ่งถอดจากคำตอบจริงที่ผู้ใช้ส่งมาเมื่อ 16 ก.ย. 2569
ห้ามเพิ่มคนหรือเติมคำตอบที่ไม่ได้ถาม — ค่าที่ไม่ได้ถามเป็น None
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

OUT = os.path.join(OUT_DIR, "สรุปผลการสำรวจ-ภารกิจ3-CareSignal")
OUT_APX = os.path.join(OUT_DIR, "ภาคผนวก-ข้อมูลรายคน-ภารกิจ3")
FNAME = dict(FEATURES)
SHORT = {
    "F1": "ตรวจร่างกายที่บ้านด้วยกล้องมือถือ",
    "F2": "รู้ผลทันทีว่าเสี่ยงระดับไหน พร้อมเหตุผล",
    "F3": "ลูกหลานได้รับแจ้งเมื่อผลแย่ลง",
    "F4": "เจ้าหน้าที่โทรกลับใน 1–3 วัน",
    "F5": "เภสัชกรช่วยดูยาที่เสี่ยงล้ม",
    "F6": "ส่งต่อนักกายภาพพร้อมข้อมูล",
    "F7": "ดูย้อนหลังว่าดีขึ้นหรือแย่ลง",
    "F8": "ภาพไม่ออกจากเครื่อง ลบข้อมูลได้",
}

# ถอดจากคำตอบจริง · ครูที่มีพ่อแม่อายุ 60+ (กลุ่ม ข ครอบครัว) · None = ไม่ได้ถาม
PEOPLE = [
    dict(code="R01", method="แบบสอบถามตอบเอง", parent_age=75, living=None,
         fell_or_near=True, fell_detail="ตอบว่า เคย (ข้อคำถามรวมล้มและเกือบล้ม)",
         assessed=False, worry="กังวลมาก", setup="ต้องมีคนช่วย",
         understood_as="โปรแกรมแจ้งเตือนและตรวจจับความผิดปกติ",
         helps="ยังไม่แน่ใจ", obstacle="การเข้าใช้โปรแกรม",
         on_alert=None, spend=None, daily=None,
         top3=["F2", "F7", "F1"]),
    dict(code="R02", method="สัมภาษณ์ตัวต่อตัว", parent_age=76, living="อยู่บ้านเดียวกัน",
         fell_or_near=True, fell_detail="คุณพ่อล้มประมาณ 3 ครั้งตั้งแต่ต้นปี 2569 ผู้ให้ข้อมูลรู้ 1 ครั้งเพราะคุณพ่อบอก ครั้งอื่นไม่ทราบ แต่เห็นรอยฟกช้ำ",
         assessed=False, worry=None, setup=None,
         understood_as="โปรแกรมที่บ่งบอกและประเมินสุขภาพ",
         helps=None, obstacle=None,
         on_alert="พาไปพบแพทย์", spend="เวลาและเงินค่ารักษา และยาบำรุง",
         daily="สุขภาพไม่แข็งแรง มีโรคประจำตัว เวลาอยากรู้อาการจะโทรถามพ่อแม่",
         top3=["F1", "F2", "F7"]),
]


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
    sec.top_margin, sec.bottom_margin = Cm(1.3), Cm(1.1)
    sec.footer_distance = Cm(0.5)
    st = doc.styles["Normal"]; st.font.name = FONT; st.font.size = Pt(13)
    st.element.rPr.rFonts.set(qn("w:cs"), FONT); st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(fp.add_run(footer), 10.5, False, INK2)
    return doc


def bullet(doc, parts, size=13):
    rich(doc, [("•  ", True, BRAND)] + parts, size=size, after=0, indent=0.3)


def build_summary():
    n = len(PEOPLE)
    s, picks, order = scores()
    fell, fell_n = count("fell_or_near")
    never, never_n = sum(1 for p in PEOPLE if p["assessed"] is False), sum(1 for p in PEOPLE if p["assessed"] is not None)
    methods = {}
    for p in PEOPLE:
        methods[p["method"]] = methods.get(p["method"], 0) + 1

    doc = setup_doc("ทีม CareSignal · OIC InsurTech Award 2026 · ภารกิจที่ 3 Idea Validation · ข้อมูลจากผู้ให้ข้อมูลจริง ไม่มีการเติมหรือประมาณค่า")
    h1(doc, "สรุปผลการสำรวจ Idea Validation · ทีม CareSignal",
       "OIC InsurTech Award 2026 · ประเภทบุคคลทั่วไป · เก็บข้อมูลวันที่ 15–16 กันยายน 2569", first=True)
    box(doc, "Solution ที่นำไปทดสอบ",
        "แอปในมือถือให้ผู้สูงอายุวัดแรงขาและการทรงตัวที่บ้านทุก 1–3 เดือน (ลุกนั่งจากเก้าอี้ 5 ครั้ง ลุกเดิน ยืนทรงตัว) "
        "เทียบกับผลของตัวเองครั้งก่อน ถ้าแย่ลงจะมีเจ้าหน้าที่ติดต่อและส่งต่อผู้เชี่ยวชาญ ภาพจากกล้องไม่ออกจากเครื่อง")

    h2(doc, "1. กลุ่มเป้าหมายและจำนวนผู้ให้ข้อมูล")
    bullet(doc, [("ผู้ให้ข้อมูล ", False, None), (f"{n} คน", True, None),
                 (" · ครูที่มีพ่อแม่อายุ 75–76 ปี (ลูกหลานผู้ดูแลและผู้ตัดสินใจ) · วิธีเก็บ: "
                  + " · ".join(f"{k} {v} คน" for k, v in methods.items()), False, None)])

    h2(doc, "2. ปัญหาที่ทีมแก้ เป็นปัญหาที่ผู้ใช้พบจริงหรือไม่ — พบจริง")
    bullet(doc, [(f"{fell} จาก {fell_n} คน", True, None),
                 (" ตอบว่าพ่อแม่เคยล้มหรือเกือบล้มในหนึ่งปี หนึ่งรายล้มประมาณ 3 ครั้งตั้งแต่ต้นปี 2569", False, None)])
    bullet(doc, [(f"{never} จาก {never_n} คน", True, None),
                 (" บอกว่าพ่อแม่ไม่เคยถูกวัดการทรงตัวหรือกำลังขาเลย", False, None)])
    bullet(doc, [("ครอบครัวรู้ช้า: ", True, None),
                 ("รายที่ล้ม 3 ครั้ง ลูกรู้เพียง 1 ครั้งจากคุณพ่อเล่า ครั้งอื่นเห็นแค่รอยฟกช้ำ · อีกรายกังวลเรื่องการล้มมาก", False, None)])

    h2(doc, "3. Solution ช่วยแก้ปัญหาได้หรือไม่ — เห็นประโยชน์ แต่ยังสื่อสารไม่ชัด")
    bullet(doc, [("ยังไม่มีใครอธิบายกลไกหลักได้ถูก ", True, None),
                 ("(วัดแรงขาเป็นรอบแล้วเทียบกับตัวเอง) คนหนึ่งเข้าใจว่าเป็นโปรแกรมแจ้งเตือนและตรวจจับความผิดปกติ อีกคนเข้าใจว่าเป็นโปรแกรมประเมินสุขภาพทั่วไป", False, None)])
    bullet(doc, [("ผู้ตอบแบบสอบถาม ", False, None), ("ยังไม่แน่ใจ", True, None),
                 (" ว่าช่วยลดความเสี่ยงล้มได้ · พ่อแม่ต้องมีคนช่วยติดตั้ง · อุปสรรคคือการเข้าใช้โปรแกรม", False, None)])
    bullet(doc, [("ถ้าได้ข้อความว่าผลแย่ลง ผู้ให้ข้อมูลจะ ", False, None), ("พาไปพบแพทย์", True, None),
                 (" — การแจ้งเตือนจึงต้องบอกขั้นตอนถัดไปให้ชัด", False, None)])

    h2(doc, "4. Feature ที่ผู้ใช้มองว่ามีประโยชน์มากที่สุด (อันดับ 1 = 3 คะแนน · 2 = 2 · 3 = 1)")
    rows = []
    for rank, f in enumerate([f for f in order if s[f] > 0], 1):
        rows.append([str(rank), f, SHORT[f], f"{s[f]} คะแนน", f"ถูกเลือก {picks[f]} จาก {n} คน"])
    zero = [f for f in order if s[f] == 0]
    rows.append(["–", " ".join(zero), "ไม่มีผู้เลือก: แจ้งลูกหลาน · เจ้าหน้าที่โทรกลับ · เภสัชกร · นักกายภาพ · ความเป็นส่วนตัว", "0", ""])
    table(doc, ["อันดับ", "รหัส", "ฟีเจอร์", "คะแนน", "จำนวนผู้เลือก"], rows, [1.3, 2.4, 8.3, 1.9, 3.5], size=12.5)

    h2(doc, "5. ทีมจะนำ Feedback ไปใช้อย่างไร")
    table(doc, ["สิ่งที่พบ", "สิ่งที่จะเปลี่ยน"], [
        ["ทั้งสองคนเข้าใจกลไกคลาดเคลื่อน คิดว่าเป็นระบบแจ้งเตือนหรือตรวจสุขภาพทั่วไป",
         "เปลี่ยนหน้าแรกเป็นภาษาง่าย \"ชั่งแรงขา ลุกนั่ง 5 ครั้ง เทียบกับครั้งก่อน\" และใส่วิดีโอสาธิต 20 วินาทีก่อนเริ่ม"],
        ["พ่อแม่ต้องมีคนช่วยติดตั้ง และการเข้าใช้คืออุปสรรค",
         "เพิ่มโหมดลูกหลานตั้งค่าให้ครั้งเดียว แล้วผู้สูงอายุกดปุ่มเดียวเริ่มวัด"],
        ["F2 ผลพร้อมเหตุผล · F1 ตรวจที่บ้าน · F7 ดูย้อนหลัง ได้คะแนนสูงสุด",
         "ย้ายผลประเมิน เหตุผล และกราฟย้อนหลังขึ้นหน้าแรก ใช้การตรวจที่บ้านเป็นจุดขายหลัก"],
        ["ฟีเจอร์ประสานการดูแล (F3–F6) ไม่มีใครเลือก แต่เมื่อผลแย่ลงเขาจะพาไปหาหมอ",
         "ไม่ตัดทิ้ง แต่เล่าใหม่เป็น \"ผลแย่ลงแล้วทำอะไรต่อ\" พร้อมใบสรุปผลให้พกไปพบแพทย์ แล้วทดสอบซ้ำรอบหน้า"],
        ["ล้มแล้วครอบครัวไม่รู้ เห็นแค่รอยฟกช้ำ",
         "ทำปุ่ม \"แจ้งว่าล้ม\" ที่มีอยู่แล้วให้เห็นชัดขึ้น ให้ทั้งผู้สูงอายุและลูกหลานกดบันทึกได้"],
    ], [7.2, 10.2], size=12.5)
    para(doc, f"ข้อจำกัด: ผู้ให้ข้อมูล {n} คน เป็นครูกลุ่มเดียวกันทั้งหมด ยังไม่ได้ถามผู้สูงอายุโดยตรง "
              "ผลนี้เป็นสัญญาณเบื้องต้น ไม่ใช่สถิติ และจะใช้เป็นคำถามทดสอบรอบถัดไป",
         size=12, color=INK2, after=0)
    path = OUT + ".docx"
    doc.save(path)
    return path


def build_appendix():
    doc = setup_doc("ภาคผนวก · ข้อมูลรายคนที่ถอดจากแบบสอบถามและการสัมภาษณ์ · รหัสแทนชื่อจริง")
    h1(doc, "ภาคผนวก · ข้อมูลรายคน", "ถอดจากคำตอบจริง ใช้รหัสแทนชื่อ · ช่องขีด (–) คือข้อที่ไม่ได้ถาม", first=True)
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
    table(doc, ["หัวข้อ"] + [f"{p['code']}" for p in PEOPLE], rows, [5.0, 6.2, 6.2], size=12.5)
    h2(doc, "ข้อความเต็มของบัตรฟีเจอร์ที่ใช้")
    for f, nm in FEATURES:
        rich(doc, [(f + "  ", True, BRAND), (nm, False, None)], size=12.5, after=0, indent=0.3)
    para(doc, "", size=4)
    para(doc, "R01 ตอบแบบสอบถามด้วยตนเองหลังอ่านใบอธิบายโปรแกรม · R02 สัมภาษณ์ตัวต่อตัวโดยหัวหน้าทีม "
              "หลังอธิบายโปรแกรมและให้อ่านใบอธิบาย",
         size=12, color=INK2, after=0)
    path = OUT_APX + ".docx"
    doc.save(path)
    return path


if __name__ == "__main__":
    for docx in (build_summary(), build_appendix()):
        print("เขียน", os.path.relpath(docx, ROOT))
        if "--no-pdf" not in sys.argv:
            pdf = docx[:-5] + ".pdf"
            print("เขียน", os.path.relpath(pdf, ROOT), "·", kit.to_pdf(docx, pdf), "หน้า")

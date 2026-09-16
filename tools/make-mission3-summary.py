# -*- coding: utf-8 -*-
"""
make-mission3-summary.py — ใบสรุปผลการสำรวจ ภารกิจที่ 3 (หนึ่งหน้า) + ภาคผนวกข้อมูลผู้ให้ข้อมูล
-----------------------------------------------------------------------------------------
python tools/make-mission3-summary.py
  → validation/สรุปผลการสำรวจ-ภารกิจ3-CareSignal-ส่งOIC.docx และ .pdf   (1 หน้า)
  → validation/ภาคผนวก-ข้อมูลผู้ให้ข้อมูล-ภารกิจ3-ส่งOIC.docx และ .pdf
  → validation/results.json (ส่วน people เขียนจาก PEOPLE ด้านล่าง)

PEOPLE ถอดจากเสียงและวิดีโอสัมภาษณ์จริง 16 ก.ย. 2569 และแบบสอบถามที่ผู้ใช้ส่งมา
ใช้รหัสแทนชื่อ ห้ามเพิ่มคนหรือเติมคำตอบที่ไม่ได้ถาม — ข้อที่ไม่ได้ถามเป็น None
ตัวเลขทุกตัวในเอกสารคำนวณจาก PEOPLE

ถ้อยคำต้องตรงกับสิ่งที่ CareSignal ทำจริง: ประเมินเป็นรอบด้วยแบบทดสอบหน้ากล้อง
ไม่ใช่ระบบตรวจจับการล้มอัตโนมัติ ไม่วินิจฉัยโรค ไม่แทนการตรวจที่โรงพยาบาล
"""
import os, sys, json, importlib.util
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

OUT = os.path.join(OUT_DIR, "สรุปผลการสำรวจ-ภารกิจ3-CareSignal-ส่งOIC")
OUT_APX = os.path.join(OUT_DIR, "ภาคผนวก-ข้อมูลผู้ให้ข้อมูล-ภารกิจ3-ส่งOIC")
RESULTS = os.path.join(OUT_DIR, "results.json")

SHORT = {
    "F1": "ประเมินความเสี่ยงจากที่บ้านผ่านกล้องมือถือ",
    "F2": "รู้ผลทันทีว่าเสี่ยงระดับไหน พร้อมเหตุผล",
    "F3": "ลูกหลานได้รับแจ้งเมื่อผลแย่ลง",
    "F4": "เจ้าหน้าที่โทรหาเมื่อพบความเสี่ยง",
    "F5": "เภสัชกรช่วยดูยาที่เสี่ยงล้ม",
    "F6": "ส่งต่อนักกายภาพพร้อมข้อมูล",
    "F7": "ดูย้อนหลังว่าดีขึ้นหรือแย่ลง",
    "F8": "ภาพไม่ออกจากเครื่อง ลบข้อมูลได้",
}

PEOPLE = [
    dict(code="R01", group="family", age=None, parent_age=75, method="แบบสอบถามตอบเอง",
         fell=True, fall="พ่อแม่เคยล้มหรือเกือบล้ม (ข้อคำถามรวมล้มและเกือบล้ม)",
         work=None, harder=None, checkup=None, balance_assessed=False,
         worry="กังวลเรื่องการล้มมาก", apps="พ่อแม่ต้องมีคนช่วยติดตั้ง", first_to_know=None,
         obstacle="การเข้าใช้โปรแกรม", on_risk=None, spend=None,
         understood_as="โปรแกรมแจ้งเตือนและตรวจจับความผิดปกติ", helps="ยังไม่แน่ใจ",
         top3=["F2", "F7", "F1"], top3_note=None, why=None),
    dict(code="R02", group="elder", age=60, parent_age=None, method="สัมภาษณ์ บันทึกเสียง",
         fell=True, fall="ล้มหลายครั้งจนนับไม่ได้ เช่น รองเท้าพลิกตกบันไดหนึ่งช่วง ลื่นพื้นเปียกตอนฝนตก "
                         "ล้มบนฟุตบาทเมื่อสัปดาห์ก่อน และสะดุดตอนตีห้าครึ่งเพราะมองไม่เห็น ต้องมีคนช่วยพยุง",
         work="ยกของขึ้นบันไดอาคาร 4 ชั้น", harder="นั่งยองไม่ได้แล้ว ต้องใช้ชักโครก · ขึ้นบันไดยากขึ้น",
         checkup="ไม่เคยตรวจสุขภาพประจำปี ไปพบแพทย์เฉพาะตามนัดรับยา", balance_assessed=None,
         worry="กลัวการล้มจนติดเตียงมาก", apps="ใช้แอปไม่เป็น เพิ่งเริ่มแตะหน้าจอเป็น",
         first_to_know="ลูกสาว โดยต้องร้องเรียก", obstacle="กดไม่เป็น ทำไม่เป็น",
         on_risk=None, spend=None, understood_as=None, helps=None,
         top3=["F3", "F1", "F4"], top3_note="อันดับ 3 ผู้สัมภาษณ์ถามนำ แล้วผู้ให้ข้อมูลตอบว่าดี",
         why="อยากตรวจที่บ้าน เพราะรถหายาก เดินทางลำบาก"),
    dict(code="R03", group="elder", age=68, parent_age=None, method="สัมภาษณ์ บันทึกเสียง",
         fell=True, fall="ปีนี้ล้มแล้ว 2 ครั้ง",
         work="ขึ้นลงอาคาร 3 ชั้น วันละ 3 รอบ และยกขยะลงบันได", harder="นั่งยองแล้วลุกยากขึ้น ขึ้นบันไดยังปกติ",
         checkup="พบแพทย์ตามนัดเมื่อ 15 ก.ย. ความดันปกติ", balance_assessed=None,
         worry="คิดมากและกลัวการล้มจนติดเตียง", apps="ครูเป็นคนลงแอปให้ ยังกดใช้ไม่ถูก",
         first_to_know="หลานที่อยู่ด้วย", obstacle="ทำไม่เป็น",
         on_risk=None, spend=None, understood_as=None, helps=None,
         top3=["F3", "F2", "F1"], top3_note="อันดับ 1 ชัดเจน · อันดับ 2 กับ 3 เลือกโดยการชี้ ฟังจากเสียงได้ไม่ชัด",
         why=None),
    dict(code="R04", group="elder", age=65, parent_age=None, method="สัมภาษณ์ บันทึกเสียงและวิดีโอไม่เห็นหน้า",
         fell=True, fall="ปีนี้ล้มแล้ว 3 ครั้งหน้าอาคารในที่ทำงาน หัวเข่ากระแทกจนแตก",
         work="ขึ้นลงบันไดหนึ่งชั้น วันละ 2–3 รอบ ยกของตามงาน",
         harder="นั่งยองไม่ได้เพราะเข่าเสื่อม · ขึ้นบันไดได้แต่ช้าและไม่กล้ารีบ",
         checkup="ตรวจเลือดตามนัดทุก 4 เดือน นัดถัดไป 22 ก.ย.", balance_assessed=None,
         worry="ห่วงกรณีล้มแล้วลุกเองไม่ได้", apps="ลูกเป็นคนลงแอปให้ ใช้ดูข้อมูลได้",
         first_to_know="ลูกที่อยู่ด้วย", obstacle="ตั้งกล้องไม่เป็น",
         on_risk="จะทำกายภาพเพื่อป้องกันการล้ม และตื่นเช้าจะค่อย ๆ ลุก", spend=None,
         understood_as=None, helps=None,
         top3=["F3", "F2", "F1"], top3_note="อันดับ 1 ชัดเจน · ตอนเลือกอันดับ 2 มีการพูดถึงทั้งรู้ผลทันทีและเภสัชกร",
         why="อยากรู้ว่าตัวเองเสี่ยงอยู่ระดับไหน"),
    dict(code="R05", group="family", age=None, parent_age=76, method="สัมภาษณ์ บันทึกวิดีโอ",
         fell=True, fall="คุณพ่อล้มประมาณ 3 ครั้ง ครั้งล่าสุดต้นปี 2569 รู้เพราะพ่อบอกและเห็นรอยฟกช้ำ",
         work=None, harder=None, checkup="คุณพ่อสุขภาพไม่แข็งแรง มีโรคประจำตัว", balance_assessed=False,
         worry=None, apps=None, first_to_know="รู้จากการโทรหาและคุณพ่อเล่า (อยู่บ้านเดียวกัน)",
         obstacle=None, on_risk="พาไปพบแพทย์", spend="ค่ารักษาและยาบำรุง",
         understood_as="โปรแกรมที่บ่งบอกและประเมินสุขภาพ", helps=None,
         top3=["F1", "F2", "F7"], top3_note="บอกว่าอยากได้การแจ้งลูกหลานด้วย",
         why="คุณพ่อไม่ชอบไปหาหมอและไม่ชอบนั่งรอ · ดูย้อนหลังเหมือนได้ตรวจสอบ"),
]

ELDERS = [p for p in PEOPLE if p["group"] == "elder"]
FAMILY = [p for p in PEOPLE if p["group"] == "family"]


def picks(people, f):
    return sum(1 for p in people if f in p["top3"][:3])


def firsts(people, f):
    return sum(1 for p in people if p["top3"] and p["top3"][0] == f)


def setup_doc(footer):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(1.7)
    sec.top_margin, sec.bottom_margin = Cm(1.1), Cm(0.9)
    sec.footer_distance = Cm(0.4)
    st = doc.styles["Normal"]; st.font.name = FONT; st.font.size = Pt(12.5)
    st.element.rPr.rFonts.set(qn("w:cs"), FONT); st.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_font(fp.add_run(footer), 10, False, INK2)
    return doc


def bullet(doc, parts, size=12.5):
    rich(doc, [("•  ", True, BRAND)] + parts, size=size, after=0, indent=0.3)


def save(doc, base):
    """ถ้าไฟล์เดิมเปิดค้างใน Word จะบันทึกไม่ได้ ให้ใช้ชื่อสำรองแทนการปิดไฟล์ของผู้ใช้"""
    for suffix in ("", "-ใหม่", "-ใหม่2", "-ใหม่3"):
        path = base + suffix + ".docx"
        try:
            doc.save(path)
            return path
        except PermissionError:
            continue
    raise PermissionError(base)


def build_summary():
    n, ne, nf = len(PEOPLE), len(ELDERS), len(FAMILY)
    fell = sum(1 for p in PEOPLE if p["fell"])
    ages = ", ".join(str(p["age"]) for p in sorted(ELDERS, key=lambda p: p["age"]))
    parent_ages = "–".join(str(a) for a in sorted({p["parent_age"] for p in FAMILY}))
    never = sum(1 for p in FAMILY if p["balance_assessed"] is False)
    no_self_app = sum(1 for p in ELDERS if p["apps"])

    doc = setup_doc("ทีม CareSignal · OIC InsurTech Award 2026 · ภารกิจที่ 3 Idea Validation · "
                    "ข้อมูลจากการสัมภาษณ์และแบบสอบถามจริง ใช้รหัสแทนชื่อ")
    h1(doc, "CareSignal – Idea Validation",
       "OIC InsurTech Award 2026 · ประเภทบุคคลทั่วไป · เก็บข้อมูลวันที่ 15–16 กันยายน 2569", first=True)
    box(doc, "สิ่งที่นำไปทดสอบ",
        "ประเมินความเสี่ยงหกล้มเบื้องต้นจากที่บ้านด้วยแบบทดสอบหน้ากล้องมือถือเป็นรอบ แล้วส่งข้อมูลให้ครอบครัว — ไม่วินิจฉัยโรค")

    h2(doc, f"1. กลุ่มเป้าหมายและจำนวนผู้ให้ข้อมูล · รวม {n} คน")
    bullet(doc, [(f"ผู้สูงอายุ {ne} คน", True, None),
                 (f" อายุ {ages} ปี (แม่บ้านที่ยังทำงาน) · สัมภาษณ์และบันทึกเสียงโดยได้รับความยินยอม", False, None)])
    bullet(doc, [(f"ลูกหลานผู้ดูแล {nf} คน", True, None),
                 (f" (ครูที่มีบิดามารดาอายุ {parent_ages} ปี) · สัมภาษณ์ 1 คน · แบบสอบถาม 1 คน", False, None)])

    h2(doc, "2. ปัญหาที่ทีมกำลังแก้ เป็นปัญหาที่ผู้ใช้พบจริงหรือไม่ — พบจริงทุกคน")
    bullet(doc, [(f"{fell} จาก {n} คน", True, None),
                 (" มีผู้สูงอายุ (ตัวเองหรือพ่อแม่) หกล้มในปีที่ผ่านมา: 2 ครั้ง · 3 ครั้งจนเข่าแตก · \"หลายครั้งจนนับไม่ได้\" "
                  "· พ่อของผู้ดูแลล้มราว 3 ครั้ง ลูกรู้เพราะเห็นรอยฟกช้ำ", False, None)])
    bullet(doc, [("ผู้สูงอายุ 3 จาก 3 คน", True, None),
                 (" นั่งยองไม่ได้หรือลุกยากขึ้น · 2 คนพบแพทย์ตามนัดแต่ก็ยังล้ม · 1 คนไม่เคยตรวจสุขภาพประจำปี", False, None)])
    bullet(doc, [(f"ผู้ดูแล {never} จาก {nf} คน", True, None),
                 (" บอกว่าพ่อแม่ไม่เคยได้รับการประเมินการทรงตัว · ผู้สูงอายุกลัวการล้มจนติดเตียง", False, None)])

    h2(doc, "3. Solution ที่นำเสนอช่วยแก้ปัญหาได้หรือไม่ — เห็นประโยชน์ แต่ต้องมีคนช่วยใช้")
    bullet(doc, [("อยากประเมินที่บ้าน เพราะ ", False, None), ("\"รถหายาก เดินทางลำบาก\"", True, None),
                 (" และ ", False, None), ("\"พ่อไม่ชอบไปหาหมอ ไม่ชอบนั่งรอ\"", True, None),
                 (" · ถ้ารู้ว่าเสี่ยงจะทำกายภาพหรือพาไปพบแพทย์", False, None)])
    bullet(doc, [(f"แต่ผู้สูงอายุ {no_self_app} จาก {ne} คนติดตั้งแอปเองไม่ได้", True, None),
                 (" (กดไม่เป็น · ตั้งกล้องไม่เป็น) · ผู้ดูแล 1 คน \"ยังไม่แน่ใจ\" · ผู้ดูแล 2 คนเข้าใจว่าเป็นระบบแจ้งเตือนทั่วไป", False, None)])

    h2(doc, "4. Feature ใดที่ผู้ใช้ต้องการหรือมองว่ามีประโยชน์มากที่สุด (ให้เลือก 3 จาก 8 ใบ)")
    order = sorted((f for f, _ in FEATURES if picks(PEOPLE, f)),
                   key=lambda f: (-picks(PEOPLE, f), -firsts(PEOPLE, f), f))
    rows = [[f"{f} {SHORT[f]}", f"{picks(PEOPLE, f)}/{n}", str(firsts(PEOPLE, f)),
             f"{picks(ELDERS, f)}/{ne}", f"{picks(FAMILY, f)}/{nf}"] for f in order]
    zero = [f for f, _ in FEATURES if not picks(PEOPLE, f)]
    rows.append(["ไม่มีผู้เลือก: " + " · ".join(zero) + " (เภสัชกร · นักกายภาพ · ความเป็นส่วนตัว)", "0", "0", "", ""])
    table(doc, ["Feature", "ติด 3 อันดับ", "อันดับ 1", "ผู้สูงอายุ", "ผู้ดูแล"],
          rows, [9.2, 2.3, 1.9, 2.1, 2.1], size=12)
    bullet(doc, [(f"ผู้สูงอายุทั้ง {ne} คนเลือก \"แจ้งลูกหลาน\" เป็นอันดับ 1", True, None),
                 (" และทุกคนพึ่งคนในบ้านให้รู้เมื่อล้ม (ร้องเรียกลูก · หลานเห็น)", False, None)])

    box(doc, "Insight สำคัญ",
        "ทุกคนอยากให้ประเมินที่บ้านได้ แต่ผู้สูงอายุทุกคนใช้แอปหรือตั้งกล้องเองไม่ได้ และสิ่งที่อยากได้ที่สุดคือ \"ให้ลูกหลานรู้\" "
        "— ลูกหลานจึงต้องเป็นผู้ตั้งค่าและรับผล ส่วนผู้สูงอายุทำเพียงแบบทดสอบสั้น ๆ",
        fill="FFF7ED", color=WARN)

    h2(doc, "5. ทีมจะนำ Feedback ไปปรับใช้ใน Solution หรือ Feature อย่างไร")
    table(doc, ["Feedback", "Product Decision"], [
        [f"ผู้สูงอายุ {firsts(ELDERS, 'F3')}/{ne} คนเลือกแจ้งลูกหลานเป็นอันดับ 1",
         "ยกเป็นฟีเจอร์หลัก เปิดตั้งแต่เริ่มใช้ (เมื่อยินยอม) แจ้งเมื่อผลแย่ลงหรือกดแจ้งว่าล้ม"],
        ["ใช้แอปเองไม่ได้ · ตั้งกล้องไม่เป็น",
         "ลูกหลานเป็นผู้ตั้งค่า มีภาพนำการวางมือถือ · ตั้งกล้องไม่ได้ใช้จับเวลาด้วยมือแทน"],
        [f"ประเมินที่บ้าน {picks(PEOPLE, 'F1')}/{n} · ผลทันที {picks(PEOPLE, 'F2')}/{n}",
         "หน้าแรกเหลือปุ่มเดียว \"เริ่มวัด\" แล้วแสดงผลเป็นสีพร้อมเหตุผลภาษาง่ายทันที"],
        ["จะพาไปหาหมอหรือทำกายภาพ · ยังเข้าใจคลาดเคลื่อน",
         "ผลแย่ลงบอกขั้นต่อไป + ใบสรุปผลพกไปพบแพทย์ · อธิบายว่า \"วัดแรงขาเป็นรอบ ก่อนล้ม\""],
    ], [6.2, 11.4], size=12)
    para(doc, f"ข้อจำกัด: {n} คนจากโรงเรียนเดียวกัน ผู้สูงอายุยังทำงานได้ ไม่ใช่ข้อสรุปของผู้สูงอายุทั่วไป · ผู้สัมภาษณ์อ่านรายการฟีเจอร์ให้ฟัง",
         size=11, color=INK2, after=0)
    return save(doc, OUT)


def build_appendix():
    doc = setup_doc("ภาคผนวก · ข้อมูลผู้ให้ข้อมูลที่ถอดจากเสียงสัมภาษณ์และแบบสอบถาม · รหัสแทนชื่อจริง")
    h1(doc, "ภาคผนวก · ข้อมูลผู้ให้ข้อมูล",
       "ถอดจากเสียง วิดีโอ และแบบสอบถามจริง 15–16 ก.ย. 2569 · ใช้รหัสแทนชื่อ · ขีด (–) คือข้อที่ไม่ได้ถาม", first=True)

    def show(p, k):
        v = p.get(k)
        if v is None:
            return "–"
        if k == "balance_assessed":
            return "ไม่เคย" if v is False else "เคย"
        if k == "top3":
            return "  ".join(f"{i}. {f} {SHORT[f]}" for i, f in enumerate(v, 1))
        if k in ("age", "parent_age"):
            return f"{v} ปี"
        return str(v)

    elder_rows = [
        ("อายุ", "age"), ("วิธีเก็บข้อมูล", "method"), ("งานที่ต้องใช้แรง", "work"),
        ("การหกล้มในปีนี้", "fall"), ("สิ่งที่ทำได้ยากขึ้น", "harder"), ("การตรวจสุขภาพ", "checkup"),
        ("ความกังวล", "worry"), ("ถ้ารู้ว่าเสี่ยง จะทำอะไร", "on_risk"),
        ("การใช้แอป", "apps"), ("ถ้าล้มที่บ้าน ใครรู้ก่อน", "first_to_know"), ("อุปสรรค", "obstacle"),
        ("ฟีเจอร์ 3 อันดับ", "top3"), ("เหตุผล", "why"), ("หมายเหตุการเลือก", "top3_note"),
    ]
    h2(doc, f"กลุ่มผู้สูงอายุ {len(ELDERS)} คน")
    table(doc, ["หัวข้อ"] + [p["code"] for p in ELDERS],
          [[lab] + [show(p, k) for p in ELDERS] for lab, k in elder_rows], [3.4, 4.7, 4.7, 4.7], size=11)

    family_rows = [
        ("อายุพ่อหรือแม่", "parent_age"), ("วิธีเก็บข้อมูล", "method"), ("การหกล้มในปีที่ผ่านมา", "fall"),
        ("เคยถูกประเมินการทรงตัว", "balance_assessed"), ("สุขภาพ / ความกังวล", "checkup"),
        ("รู้อาการพ่อแม่อย่างไร", "first_to_know"), ("ค่าใช้จ่าย", "spend"), ("ถ้ารู้ว่าเสี่ยง จะทำอะไร", "on_risk"),
        ("การใช้แอปของพ่อแม่", "apps"), ("อุปสรรค", "obstacle"),
        ("เข้าใจว่าโปรแกรมทำอะไร", "understood_as"), ("ช่วยได้ไหม", "helps"),
        ("ฟีเจอร์ 3 อันดับ", "top3"), ("เหตุผล / หมายเหตุ", "why"),
    ]
    h2(doc, f"กลุ่มลูกหลานผู้ดูแล {len(FAMILY)} คน")
    fam = []
    for lab, k in family_rows:
        row = [lab]
        for p in FAMILY:
            v = show(p, k)
            if k == "checkup" and p.get("worry"):
                v = p["worry"] if v == "–" else v + " · " + p["worry"]
            if k == "why" and p.get("top3_note"):
                v = p["top3_note"] if v == "–" else v + " · " + p["top3_note"]
            row.append(v)
        fam.append(row)
    table(doc, ["หัวข้อ"] + [p["code"] for p in FAMILY], fam, [3.6, 7.0, 7.0], size=11)
    h2(doc, "ข้อความเต็มของบัตรฟีเจอร์ที่ใช้")
    for f, nm in FEATURES:
        rich(doc, [(f + "  ", True, BRAND), (nm, False, None)], size=11.5, after=0, indent=0.3)
    return save(doc, OUT_APX)


def write_results():
    with open(RESULTS, encoding="utf-8") as fh:
        d = json.load(fh)
    d["filled"] = True
    d["period"] = "2569-09-15 ถึง 2569-09-16"
    d["where"] = "โรงเรียนของหัวหน้าทีม · แม่บ้านอายุ 60+ และครูที่มีพ่อแม่อายุ 60+"
    d["people"] = [dict(p, top3=list(p["top3"])) for p in PEOPLE]
    d.pop("elders", None)
    d["note"] = "ถอดจากเสียงและวิดีโอสัมภาษณ์ 16 ก.ย. 2569 · ใบสรุปสร้างจาก tools/make-mission3-summary.py"
    with open(RESULTS, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    write_results()
    for docx in (build_summary(), build_appendix()):
        print("เขียน", os.path.relpath(docx, ROOT))
        if "--no-pdf" not in sys.argv:
            pdf = docx[:-5] + ".pdf"
            print("เขียน", os.path.relpath(pdf, ROOT), "·", kit.to_pdf(docx, pdf), "หน้า")

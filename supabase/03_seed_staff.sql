-- ============================================================
-- CareSignal — ตั้งบทบาทเจ้าหน้าที่ (รันหลังสร้างบัญชีจากหน้าเว็บแล้ว)
-- ------------------------------------------------------------
-- วิธีใช้:
--   1) สมัครบัญชีเจ้าหน้าที่ผ่านหน้า staff login ของระบบก่อน (email + รหัสผ่าน)
--   2) เปิด Supabase → SQL Editor → แก้อีเมลด้านล่างให้ตรง แล้วรัน
--
-- เหตุผลที่ต้องทำผ่าน SQL: ผู้ใช้เลื่อนขั้นบทบาทตัวเองไม่ได้
-- (trigger guard_role_change กันไว้) จึงต้องให้ผู้ดูแลระบบตั้งให้จากหลังบ้าน
-- ============================================================

-- Care Manager / พยาบาล
update public.profiles
set role = 'care_manager', display_name = 'พยาบาลผู้ประเมิน'
where id = (select id from auth.users where email = 'nurse@example.com');

-- เจ้าหน้าที่บริษัทประกัน
update public.profiles
set role = 'insurer', display_name = 'เจ้าหน้าที่บริษัทประกัน'
where id = (select id from auth.users where email = 'insurer@example.com');

-- ผู้ดูแลระบบ
update public.profiles
set role = 'admin', display_name = 'ผู้ดูแลระบบ'
where id = (select id from auth.users where email = 'admin@example.com');

-- ตรวจผลลัพธ์
select p.pseudonym, u.email, p.role, p.display_name
from public.profiles p
join auth.users u on u.id = p.id
where p.role <> 'user'
order by p.role;

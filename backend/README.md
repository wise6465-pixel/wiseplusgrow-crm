# 🗄 CRM Backend (Supabase) — kickoff 2026-06-07

ย้าย CRM จาก localStorage (แตกตาม browser/profile) → Supabase (ฐานข้อมูลกลาง ชุดเดียว)
แก้บั๊ก fragmentation + รองรับ sales หลายคน

## สถานะ
- ✅ Backup ข้อมูลปัจจุบัน → `../backups/crm-backup-2026-06-07.json` (1,837 ลูกค้า + 408 สินค้า + quotes/orders/...)
- ✅ `supabase-schema.sql` — ตาราง customers + products + crm_kv (+ RLS)
- ✅ `migrate-to-supabase.mjs` — ย้าย backup → Supabase
- ✅ `crm-supabase-sync.js` — โค้ดต่อ CRM (hydrate ตอนโหลด + push ตอนเซฟ)
- ⏳ **รอ Boss สร้าง Supabase project + ส่ง key**

## ขั้นตอนที่เหลือ (พอ Boss ส่ง key)
1. **Boss:** สร้าง project ที่ supabase.com → เซฟ `Project URL` + `anon key` ลง `/Users/goodmac/wpg-crm-supabase.txt`
2. **Boss:** เปิด Supabase → SQL Editor → วาง `supabase-schema.sql` → Run (สร้างตาราง)
3. **#7:** `node backend/migrate-to-supabase.mjs` (ย้ายข้อมูล 1,837+408 เข้า)
4. **#7:** ใส่ URL+anon key ลง `crm-supabase-sync.js` → ฝัง `<script>` ใน index.html ก่อน init + เรียก `await window.__crmHydrate()` + `window.__crmInstallPush(DB)` → commit + push
5. **#7:** ทดสอบสด: เปิด 2 profile/เครื่อง → เห็นข้อมูลชุดเดียวกัน = บั๊ก fragmentation หาย ✅

## หมายเหตุ
- anon key = public by design (อยู่ใน frontend ได้ · RLS คุม) · ไม่ใช่ความลับระดับ service_role
- V1 RLS เปิดกว้าง (เครื่องมือภายใน) · เฟสถัดไปใส่ login/role เมื่อ sales 5 คนใช้จริง
- customers/products = ตารางจริง (1 ราย = 1 แถว · แก้ไม่ทับกัน) · ที่เหลือ = crm_kv (ก้อน JSON)

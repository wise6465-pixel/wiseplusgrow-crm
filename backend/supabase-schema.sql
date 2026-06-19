-- ============================================================
--  Wiseplusgrow CRM — Supabase schema (V1)
--  วาง SQL นี้ใน Supabase Dashboard → SQL Editor → Run
--  ออกแบบ: customers + products = ตารางจริง (ค้น/กรองได้ · sales หลายคนแก้ไม่ทับกัน)
--           ที่เหลือ (quotes/orders/leads/...) = crm_kv (JSONB ก้อน · ข้อมูลน้อย ปรับทีหลังได้)
-- ============================================================

-- 1) ลูกค้า — 1 ราย = 1 แถว (กันแก้ทับกันเมื่อ sales หลายคนใช้)
create table if not exists customers (
  id            text primary key,            -- ใช้ id เดิมจาก CRM (c1, c2, jub...)
  name          text not null default '',
  ref_id        text,                         -- Jubili Prospect ID
  phone         text,
  email         text,
  tax           text,
  status        text default 'prospect',
  address       text,
  province      text,
  note          text,
  hotness       int  default 0,
  tags          jsonb default '[]'::jsonb,
  contacts      jsonb default '[]'::jsonb,
  unfollow      boolean default false,
  owner_email   text,
  extra         jsonb default '{}'::jsonb,    -- เก็บ field อื่นๆ ที่ CRM อาจมีเพิ่ม
  updated_at    timestamptz default now()
);
create index if not exists ix_customers_status on customers(status);
create index if not exists ix_customers_province on customers(province);

-- 2) สินค้า — 1 รายการ = 1 แถว
create table if not exists products (
  id            text primary key,
  name          text not null default '',
  code          text,
  grp           text,                          -- กลุ่มสินค้า (group เป็น reserved คำ เลยใช้ grp)
  price         numeric default 0,
  unit          text default 'ชิ้น',
  extra         jsonb default '{}'::jsonb,
  updated_at    timestamptz default now()
);
create index if not exists ix_products_grp on products(grp);

-- 3) ที่เหลือเก็บเป็น key-value (quotes, orders, leads, activities, projects, tasks, members, settings, import_history)
create table if not exists crm_kv (
  key           text primary key,             -- เช่น 'quotes', 'orders', 'settings'
  value         jsonb not null default '[]'::jsonb,
  updated_at    timestamptz default now()
);

-- ============================================================
--  RLS (Row Level Security) — V1: เปิดให้ anon อ่าน/เขียนได้
--  (เป็นเครื่องมือภายใน · เว็บ public อยู่แล้ว · เฟสถัดไปค่อยใส่ login/role)
-- ============================================================
alter table customers enable row level security;
alter table products  enable row level security;
alter table crm_kv    enable row level security;

drop policy if exists p_customers_all on customers;
create policy p_customers_all on customers for all using (true) with check (true);
drop policy if exists p_products_all on products;
create policy p_products_all on products for all using (true) with check (true);
drop policy if exists p_crm_kv_all on crm_kv;
create policy p_crm_kv_all on crm_kv for all using (true) with check (true);

-- เสร็จ → ไปขั้น migrate ข้อมูล (node backend/migrate-to-supabase.mjs)

/* ============================================================
   CRM ↔ Supabase sync (V1 — light, ไม่ต้องรื้อแอปเดิม)
   วิธีต่อ: วาง <script> นี้ใน index.html "ก่อน" โค้ดแอปหลัก (ก่อน init)
   - ใส่ SUPABASE_URL + SUPABASE_ANON_KEY ด้านล่าง (anon key = public by design, ปลอด RLS)
   - hydrate: ดึงจาก Supabase → เขียนลง localStorage ก่อนแอป init (แอปอ่าน localStorage เหมือนเดิม)
   - push: ทุกครั้งที่ DB.set → push ขึ้น Supabase แบบ background (ไม่บล็อก UI)
   ผล: ทุก profile/เครื่อง/มือถือ เห็นข้อมูลชุดเดียวกัน
   ============================================================ */
(function () {
  const SUPABASE_URL = '__SUPABASE_URL__';          // <- ใส่ตอน integrate
  const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__'; // <- ใส่ตอน integrate
  if (SUPABASE_URL.startsWith('__')) { console.warn('[sync] ยังไม่ได้ใส่ Supabase creds — ทำงานแบบ localStorage ล้วน'); return; }

  const H = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  const KV_KEYS = ['quotes','orders','leads','activities','projects','tasks','members','settings','import_history'];
  // map localStorage key (มี prefix wpg_) → ชื่อใน Supabase
  const LS = { customers:'wpg_customers', products:'wpg_wpg_products' };
  const LS_KV = { quotes:'wpg_quotes', orders:'wpg_orders', leads:'wpg_leads', activities:'wpg_activities',
    projects:'wpg_projects', tasks:'wpg_tasks', members:'wpg_members', settings:'wpg_settings', import_history:'wpg_wpg_import_history' };

  async function get(path) {
    const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: H });
    if (!r.ok) throw new Error(path + ' ' + r.status); return r.json();
  }
  async function upsert(table, rows) {
    if (!rows || !rows.length) return;
    await fetch(SUPABASE_URL + '/rest/v1/' + table, {
      method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
  }
  // แปลงแถว Supabase → รูปแบบ CRM (กลับด้านจาก migrate)
  const toCrmCustomer = (r) => ({ id:r.id, name:r.name, refId:r.ref_id, phone:r.phone, email:r.email, tax:r.tax,
    status:r.status, address:r.address, province:r.province, note:r.note, hotness:r.hotness, tags:r.tags||[],
    contacts:r.contacts||[], unfollow:r.unfollow, ownerEmail:r.owner_email, ...(r.extra||{}) });
  const toCrmProduct  = (r) => ({ id:r.id, name:r.name, code:r.code, group:r.grp, price:Number(r.price)||0, unit:r.unit, ...(r.extra||{}) });

  // ---- HYDRATE: ดึง Supabase → localStorage (เรียกก่อน init) ----
  window.__crmHydrate = async function () {
    try {
      const [cust, prod, kv] = await Promise.all([
        get('customers?select=*&limit=10000'),
        get('products?select=*&limit=10000'),
        get('crm_kv?select=*'),
      ]);
      localStorage.setItem('wpg_customers', JSON.stringify(cust.map(toCrmCustomer)));
      localStorage.setItem('wpg_wpg_products', JSON.stringify(prod.map(toCrmProduct)));
      const kvObj = Object.fromEntries(kv.map(r => [r.key, r.value]));
      for (const k of KV_KEYS) if (kvObj[k] !== undefined) localStorage.setItem(LS_KV[k], JSON.stringify(kvObj[k]));
      console.log('[sync] hydrated:', cust.length, 'customers,', prod.length, 'products');
      return true;
    } catch (e) { console.warn('[sync] hydrate ล้มเหลว — ใช้ localStorage cache:', e.message); return false; }
  };

  // ---- PUSH: hook DB.set → push background ----
  window.__crmInstallPush = function (DB) {
    const origSet = DB.set.bind(DB);
    DB.set = function (key, val) {
      origSet(key, val);                       // localStorage ก่อน (UI ไม่สะดุด)
      try {
        if (key === 'customers') upsert('customers', val.map(c => ({ id:String(c.id), name:c.name||'', ref_id:c.refId||null,
          phone:c.phone||null, email:c.email||null, tax:c.tax||null, status:c.status||'prospect', address:c.address||null,
          province:c.province||null, note:c.note||null, hotness:c.hotness||0, tags:c.tags||[], contacts:c.contacts||[],
          unfollow:!!c.unfollow, owner_email:c.ownerEmail||null })));
        else if (key === 'wpg_products') upsert('products', val.map(p => ({ id:String(p.id), name:p.name||'', code:p.code||null,
          grp:p.group||null, price:Number(p.price)||0, unit:p.unit||'ชิ้น' })));
        else { const kvName = Object.keys(LS_KV).find(n => LS_KV[n].replace(/^wpg_/, '') === key || n === key);
          if (kvName) upsert('crm_kv', [{ key: kvName, value: val }]); }
      } catch (e) { console.warn('[sync] push error:', e.message); }
    };
  };
})();

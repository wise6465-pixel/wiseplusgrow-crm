// ============================================================
//  Migrate CRM data (localStorage backup) → Supabase
//  ใช้: node backend/migrate-to-supabase.mjs
//  อ่าน creds จาก /Users/goodmac/wpg-crm-supabase.txt (รูปแบบ: บรรทัด URL=... และ KEY=...)
//  อ่านข้อมูลจาก backups/crm-backup-2026-06-07.json
// ============================================================
import { readFileSync } from 'node:fs';

const CRED_FILE = '/Users/goodmac/wpg-crm-supabase.txt';
const BACKUP = new URL('../backups/crm-backup-2026-06-07.json', import.meta.url).pathname;

function loadCreds() {
  const txt = readFileSync(CRED_FILE, 'utf8');
  const url = (txt.match(/https:\/\/[a-z0-9]+\.supabase\.(?:co|in)/) || [])[0];
  // key = JWT ขึ้นต้น eyJ (anon หรือ service role)
  const key = (txt.match(/eyJ[A-Za-z0-9_\-.]+/) || [])[0];
  if (!url || !key) throw new Error('ไม่พบ URL หรือ key ในไฟล์ ' + CRED_FILE);
  return { url, key };
}

async function upsert(url, key, table, rows) {
  if (!rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const r = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (!r.ok) throw new Error(`${table} ${r.status}: ${(await r.text()).slice(0, 300)}`);
    done += batch.length;
    process.stdout.write(`  ${table}: ${done}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${done}/${rows.length} ✅`);
  return done;
}

const KNOWN_C = ['id','name','phone','email','tax','status','address','province','note','hotness','tags','contacts','unfollow'];
function mapCustomer(c) {
  const extra = {}; for (const k in c) if (!KNOWN_C.includes(k) && k!=='refId' && k!=='ownerEmail') extra[k]=c[k];
  return {
    id: String(c.id), name: c.name||'', ref_id: c.refId||null, phone: c.phone||null,
    email: c.email||null, tax: c.tax||null, status: c.status||'prospect', address: c.address||null,
    province: c.province||null, note: c.note||null, hotness: c.hotness||0,
    tags: c.tags||[], contacts: c.contacts||[], unfollow: !!c.unfollow,
    owner_email: c.ownerEmail||null, extra,
  };
}
const KNOWN_P = ['id','name','code','price','unit'];
function mapProduct(p) {
  const extra = {}; for (const k in p) if (!KNOWN_P.includes(k) && k!=='group') extra[k]=p[k];
  return { id:String(p.id), name:p.name||'', code:p.code||null, grp:p.group||null, price:Number(p.price)||0, unit:p.unit||'ชิ้น', extra };
}

(async () => {
  const { url, key } = loadCreds();
  console.log('Supabase:', url);
  const dump = JSON.parse(readFileSync(BACKUP, 'utf8'));
  const get = (k) => { try { return JSON.parse(dump[k]); } catch { return []; } };

  const customers = get('wpg_customers').map(mapCustomer);
  const products  = get('wpg_wpg_products').map(mapProduct);
  console.log(`จะย้าย: ${customers.length} ลูกค้า · ${products.length} สินค้า`);

  await upsert(url, key, 'customers', customers);
  await upsert(url, key, 'products', products);

  // ที่เหลือ → crm_kv
  const kvMap = { quotes:'wpg_quotes', orders:'wpg_orders', leads:'wpg_leads',
    activities:'wpg_activities', projects:'wpg_projects', tasks:'wpg_tasks',
    members:'wpg_members', settings:'wpg_settings', import_history:'wpg_wpg_import_history' };
  const kvRows = Object.entries(kvMap).map(([key, lsKey]) => ({ key, value: get(lsKey) }));
  await upsert(url, key, 'crm_kv', kvRows);

  console.log('\n🎉 migrate เสร็จ — เช็คใน Supabase Table Editor ได้เลย');
})().catch(e => { console.error('❌', e.message); process.exit(1); });

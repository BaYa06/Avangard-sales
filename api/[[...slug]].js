// api/[[...slug]].js — один серверлес-хендлер для /api/rates, /api/stats, /api/schedule
import { sql } from '@vercel/postgres';
import { ensureSchema } from '../db.js';
import { randomUUID } from 'node:crypto';

// --- utils ---
function parseBody(req){
  if (!req.body) return {};
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body || {};
}
function getPath(req){
  const p = (req.url || '').split('?')[0];
  return p.replace(/^\/api\/?/, ''); // 'rates' | 'stats' | 'schedule'
}
function pad(n){ return String(n).padStart(2,'0'); }
function monday(dStr){
  const d = new Date(dStr || new Date().toISOString().slice(0,10));
  if (isNaN(d)) return null;
  const day = d.getDay(); // 0..6
  const diff = (day === 0 ? -6 : 1) - day; // до понедельника
  const res = new Date(d); res.setDate(d.getDate()+diff);
  return `${res.getFullYear()}-${pad(res.getMonth()+1)}-${pad(res.getDate())}`;
}

// --- handlers ---
async function handleRates(_req, res){
  try{
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;
    // 1-й источник
    try{
      const r = await fetchFn('https://api.exchangerate.host/latest?base=KGS&symbols=KZT', { timeout: 8000 });
      if (r.ok){
        const data = await r.json();
        const kgs_to_kzt = data?.rates?.KZT;
        if (kgs_to_kzt) return res.status(200).json({ kgs_to_kzt, kzt_to_kgs: 1/kgs_to_kzt, updated: data?.date || null });
      }
    }catch(_){}
    // 2-й источник
    try{
      const r2 = await fetchFn('https://open.er-api.com/v6/latest/KGS', { timeout: 8000 });
      if (r2.ok){
        const data2 = await r2.json();
        const kgs_to_kzt = data2?.rates?.KZT;
        if (kgs_to_kzt) return res.status(200).json({ kgs_to_kzt, kzt_to_kgs: 1/kgs_to_kzt, updated: data2?.time_last_update_utc || null });
      }
    }catch(_){}
    // фолбэк без 500
    return res.status(200).json({ kgs_to_kzt: 5.0, kzt_to_kgs: 0.2, updated: null });
  }catch(e){
    return res.status(200).json({ kgs_to_kzt: 5.0, kzt_to_kgs: 0.2, updated: null });
  }
}

async function handleStats(req, res){
  await ensureSchema();
  const { from = '2000-01-01', to = '2100-01-01', managerId } = req.query || {};
  const hasManager = managerId && String(managerId).trim() !== '';
  const q = hasManager
    ? sql`SELECT sales_count, people, amount, currency FROM events WHERE date >= ${from} AND date <= ${to} AND manager_id = ${managerId}`
    : sql`SELECT sales_count, people, amount, currency FROM events WHERE date >= ${from} AND date <= ${to}`;
  const rows = (await q).rows;
  let people=0, sales=0; const amounts = { KGS:0, KZT:0 };
  for (const r of rows){
    people += Number(r.people || 0);
    sales  += Number(r.sales_count || 0);
    const c = (r.currency || 'KGS').toUpperCase();
    const a = Number(r.amount || 0);
    if (c === 'KZT') amounts.KZT += a; else amounts.KGS += a;
  }
  return res.status(200).json({ totals: { people, sales, amounts } });
}

async function handleSchedule(req, res){
  await ensureSchema();
  if (req.method === 'GET'){
    const { week } = req.query || {};
    const wk = monday(week);
    const rows = await sql`
      SELECT s.id, s.manager_id, s.week_start, s.day, s.shift, m.name AS manager_name
      FROM schedule_items s
      JOIN managers m ON m.id = s.manager_id
      WHERE s.week_start = ${wk}
      ORDER BY m.name ASC, s.day ASC`;
    return res.status(200).json({ week: wk, items: rows.rows });
  }
  if (req.method === 'POST' || req.method === 'PUT'){
    const b = parseBody(req);
    const wk = monday(b.week);
    const items = Array.isArray(b.items) ? b.items : [];
    for (const it of items){
      const manager_id = it.manager_id || it.managerId;
      const day = Number(it.day);
      const shift = String(it.shift || 'OFF');
      if (!manager_id || !day) continue;
      await sql`
        INSERT INTO schedule_items (id, manager_id, week_start, day, shift)
        VALUES (${randomUUID()}, ${manager_id}, ${wk}, ${day}, ${shift})
        ON CONFLICT (manager_id, week_start, day)
        DO UPDATE SET shift = EXCLUDED.shift, updated_at = now()
      `;
    }
    return res.status(200).json({ ok: true, week: wk, count: items.length });
  }
  res.setHeader('Allow','GET, POST, PUT');
  return res.status(405).end();
}

// --- router ---
export default async function handler(req, res){
  try{
    const path = getPath(req);        // 'rates' | 'stats' | 'schedule' | ...
    if (path === 'rates')    return handleRates(req,res);
    if (path === 'stats')    return handleStats(req,res);
    if (path === 'schedule') return handleSchedule(req,res);
    return res.status(404).json({ error: 'Unknown endpoint for catch-all' });
  }catch(e){
    console.error('API router error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}

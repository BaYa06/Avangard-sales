// /api/schedule -> GET (загрузка на неделю), POST/PUT (upsert нескольких ячеек)
import { sql } from '@vercel/postgres';
import { ensureSchema } from '../db.js';
import { randomUUID } from 'node:crypto';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

// нормализуем любую дату к понедельнику
function monday(dStr){
  const d = new Date(dStr);
  if (isNaN(d)) return null;
  const day = d.getDay(); // 0..6
  const diff = (day === 0 ? -6 : 1) - day; // до понедельника
  const res = new Date(d);
  res.setDate(d.getDate() + diff);
  const pad = (n)=> String(n).padStart(2,'0');
  return `${res.getFullYear()}-${pad(res.getMonth()+1)}-${pad(res.getDate())}`;
}

export default async function handler(req, res){
  try {
    await ensureSchema();

    if (req.method === 'GET'){
      const { week } = req.query;
      const wk = monday(week || new Date().toISOString().slice(0,10));
      const rows = await sql`
        SELECT s.id, s.manager_id, s.week_start, s.day, s.shift,
               m.name AS manager_name
        FROM schedule_items s
        JOIN managers m ON m.id = s.manager_id
        WHERE s.week_start = ${wk}
        ORDER BY m.name ASC, s.day ASC
      `;
      return res.status(200).json({ week: wk, items: rows.rows });
    }

    if (req.method === 'POST' || req.method === 'PUT'){
      const b = parseBody(req);
      const wk = monday(b.week || new Date().toISOString().slice(0,10));
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

    res.setHeader('Allow', 'GET, POST, PUT');
    return res.status(405).end();
  } catch (e) {
    console.error('SCHEDULE API ERROR:', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
}

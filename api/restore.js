// /api/restore -> POST { managers:[], events:[] }
import { ensureSchema } from '../db.js';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST'); return res.status(405).end();
    }
    await ensureSchema();

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { managers = [], events = [] } = body || {};

    // очистим таблицы и перезальём
    await sql`DELETE FROM events`;
    await sql`DELETE FROM managers`;

    for (const m of managers) {
      await sql`INSERT INTO managers (id,name,target,created_at)
                VALUES (${m.id}, ${m.name}, ${Number(m.target||0)}, ${m.created_at || new Date()})`;
    }
    for (const e of events) {
      await sql`INSERT INTO events (id,date,manager_id,sales_count,people,tour,amount,comment,created_at)
                VALUES (${e.id}, ${e.date}, ${e.manager_id || e.managerId || null},
                        ${Number(e.sales_count ?? e.salesCount ?? 1)},
                        ${Number(e.people ?? 1)},
                        ${e.tour || null},
                        ${Number(e.amount || 0)},
                        ${e.comment || null},
                        ${e.created_at || new Date()})`;
    }

    return res.status(200).json({ ok: true, managers: managers.length, events: events.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

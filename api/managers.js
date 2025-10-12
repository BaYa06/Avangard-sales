// /api/managers -> GET, POST, DELETE
import { db, ensureSchema } from '../db.js';
import { randomUUID } from 'node:crypto';
import { sql } from '@vercel/postgres';

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await db.managers.list();
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const b = parseBody(req);
      const name = String(b.name || '').trim();
      const target = Number(b.target || 0);
      if (!name) return res.status(400).json({ error: 'name required' });

      await db.managers.insert({ id: b.id || randomUUID(), name, target });
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const b = parseBody(req);
      const id = req.query?.id || b.id;
      if (!id) return res.status(400).json({ error: 'id required' });

      // events.manager_id имеет ON DELETE SET NULL, но на всякий подстрахуемся
      await sql`UPDATE events SET manager_id = NULL WHERE manager_id = ${id}`;
      await db.managers.delete(id);
      return res.status(200).json({ ok: true, id });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

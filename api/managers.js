// /api/managers -> GET(list), POST(create)
import { db, ensureSchema } from '../db.js';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { rows } = await db.managers.list();
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const name = String(b.name || '').trim();
      const target = Number(b.target || 0);
      if (!name) return res.status(400).json({ error: 'name required' });

      await db.managers.insert({ id: randomUUID(), name, target });
      return res.status(201).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

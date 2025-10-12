// /api/events -> GET(range), POST(create), DELETE(id)
import { db, ensureSchema } from '../db.js';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  try {
    await ensureSchema();

    if (req.method === 'GET') {
      const { from = '2000-01-01', to = '2100-01-01', managerId } = req.query;
      const { rows } = await db.events.listInRange({ from, to, managerId });
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      await db.events.insert({
        id: b.id || randomUUID(),
        date: b.date,
        manager_id: b.managerId || null,
        sales_count: Number(b.salesCount || 1),
        people: Number(b.people || 1),
        tour: b.tour || null,
        amount: Number(b.amount || 0),
        comment: b.comment || null
      });
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id required' });
      await db.events.delete(id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

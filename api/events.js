// /api/events -> GET, POST, DELETE
import { sql } from '@vercel/postgres';

import { db, ensureSchema } from '../db.js';
import { randomUUID } from 'node:crypto';

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
      const { from = '2000-01-01', to = '2100-01-01', managerId } = req.query;
      const { rows } = await db.events.listInRange({ from, to, managerId });
      return res.status(200).json(rows);
    }

    if (req.method === 'POST') {
      const b = parseBody(req);
      await db.events.insert({
        id: b.id || randomUUID(),
        date: b.date,
        manager_id: b.managerId || null,
        sales_count: Number(b.salesCount || 1),
        people: Number(b.people || 1),
        tour: b.tour || null,
        amount: Number(b.amount || 0),
        comment: b.comment || null,
        currency: b.currency || 'KGS'
      });
      return res.status(201).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const b = parseBody(req);
      const id = req.query?.id || b.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      await db.events.delete(id);
      return res.status(200).json({ ok: true, id });
    }

    if (req.method === 'PUT') {
      const b = parseBody(req);
      const id = req.query?.id || b.id;
      if (!id) return res.status(400).json({ error: 'id required' });

      const patch = [];
      if (b.date)        patch.push(sql`date = ${b.date}`);
      if (b.managerId)   patch.push(sql`manager_id = ${b.managerId}`);
      if (b.salesCount)  patch.push(sql`sales_count = ${Number(b.salesCount)}`);
      if (b.people)      patch.push(sql`people = ${Number(b.people)}`);
      if (b.tour !== undefined)     patch.push(sql`tour = ${b.tour}`);
      if (b.amount !== undefined)   patch.push(sql`amount = ${Number(b.amount)}`);
      if (b.comment !== undefined)  patch.push(sql`comment = ${b.comment}`);
      if (b.currency)               patch.push(sql`currency = ${b.currency}`);

      if (!patch.length) return res.status(200).json({ ok: true, id });

      await sql`UPDATE events SET ${sql.join(patch, sql`, `)} WHERE id = ${id}`;
      return res.status(200).json({ ok: true, id });
    }

    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

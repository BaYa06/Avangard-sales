// /api/events/[id]  ->  DELETE (и опционально GET)
import { db, ensureSchema } from '../../db.js';
import { randomUUID } from 'node:crypto';
import { sql } from '@vercel/postgres'; // ← добавь эту строку


export default async function handler(req, res) {
  try {
    await ensureSchema();

    const { id } = req.query; // Vercel подставит сегмент пути сюда
    if (!id) return res.status(400).json({ error: 'id required' });

    if (req.method === 'DELETE') {
      await db.events.delete(id);
      return res.status(200).json({ ok: true, id });
    }

    // (опционально) поддержка GET /api/events/<id>
    // if (req.method === 'GET') {
    //   const { rows } = await db.events.byId(id);
    //   return res.status(200).json(rows[0] || null);
    // }

    if (req.method === 'PUT') {
      const b = parseBody(req);

      // достаём id из query, либо из пути, либо из тела
      const idFromPath = (req.url || '').split('?')[0].split('/').pop();
      const id = req.query?.id || b.id || idFromPath;
      if (!id) return res.status(400).json({ error: 'id required' });

      // собираем патч (апдейтим только присланные поля)
      const patch = [];
      if (b.date)              patch.push(sql`date = ${b.date}`);
      if (b.managerId)         patch.push(sql`manager_id = ${b.managerId}`);
      if (b.salesCount != null)patch.push(sql`sales_count = ${Number(b.salesCount)}`);
      if (b.people != null)    patch.push(sql`people = ${Number(b.people)}`);
      if (b.tour !== undefined)patch.push(sql`tour = ${b.tour}`);
      if (b.amount !== undefined) patch.push(sql`amount = ${Number(b.amount)}`);
      if (b.comment !== undefined)patch.push(sql`comment = ${b.comment}`);
      if (b.currency)          patch.push(sql`currency = ${b.currency}`);

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

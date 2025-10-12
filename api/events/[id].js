// /api/events/[id]  ->  DELETE (и опционально GET)
import { db, ensureSchema } from '../../db.js';

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

    res.setHeader('Allow', 'DELETE');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

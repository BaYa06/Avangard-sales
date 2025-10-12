import { db, ensureSchema } from '../../db.js';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    await ensureSchema();

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });

    if (req.method === 'DELETE') {
      // на всякий: обнулим ссылки из events
      await sql`UPDATE events SET manager_id = NULL WHERE manager_id = ${id}`;
      await db.managers.delete(id);
      return res.status(200).json({ ok: true, id });
    }

    res.setHeader('Allow', 'DELETE');
    return res.status(405).end();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

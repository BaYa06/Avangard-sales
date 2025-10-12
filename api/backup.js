// /api/backup -> GET { managers:[], events:[] }
import { ensureSchema } from '../db.js';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const mgrs = await sql`SELECT * FROM managers ORDER BY created_at DESC`;
    const evts = await sql`SELECT * FROM events ORDER BY date DESC, created_at DESC`;
    return res.status(200).json({ managers: mgrs.rows, events: evts.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

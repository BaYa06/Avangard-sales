// /api/stats?managerId=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD
// Возвращает totals: people, sales, amounts.{KGS,KZT}
import { sql } from '@vercel/postgres';
import { ensureSchema } from '../db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const { from = '2000-01-01', to = '2100-01-01', managerId } = req.query;
    const hasManager = managerId && String(managerId).trim() !== '';

    const rows = hasManager
      ? await sql`SELECT sales_count, people, amount, currency FROM events
                  WHERE date >= ${from} AND date <= ${to} AND manager_id = ${managerId}`
      : await sql`SELECT sales_count, people, amount, currency FROM events
                  WHERE date >= ${from} AND date <= ${to}`;

    let people = 0, sales = 0;
    let amounts = { KGS: 0, KZT: 0 };

    for (const r of rows.rows) {
      people += Number(r.people || 0);
      sales  += Number(r.sales_count || 0);
      const c = (r.currency || 'KGS').toUpperCase();
      const a = Number(r.amount || 0);
      if (c === 'KZT') amounts.KZT += a;
      else amounts.KGS += a;
    }

    return res.status(200).json({ totals: { people, sales, amounts } });
  } catch (e) {
    console.error('STATS ERROR:', e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

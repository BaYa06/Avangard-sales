// /api/aggregates?from=YYYY-MM-DD&to=YYYY-MM-DD[&managerId=<uuid>]
import { sql } from '@vercel/postgres';
import { ensureSchema } from '../db.js';

export default async function handler(req, res) {
  try {
    await ensureSchema();

    const { from = '2000-01-01', to = '2100-01-01', managerId } = req.query;
    const hasManager = managerId && String(managerId).trim() !== '';

    // ВАЖНО: никаких вложенных `sql` — только if/else.
    const queryWithJoin = hasManager
      ? sql`
        SELECT e.id, e.date, e.manager_id, e.sales_count, e.people, e.tour, e.amount, e.comment,
               m.name  AS manager_name,
               m.target AS manager_target,
               e.created_at
        FROM events e
        LEFT JOIN managers m ON m.id = e.manager_id
        WHERE e.date >= ${from} AND e.date <= ${to}
          AND e.manager_id = ${managerId}
        ORDER BY e.date DESC, e.created_at DESC
      `
      : sql`
        SELECT e.id, e.date, e.manager_id, e.sales_count, e.people, e.tour, e.amount, e.comment,
               m.name  AS manager_name,
               m.target AS manager_target,
               e.created_at
        FROM events e
        LEFT JOIN managers m ON m.id = e.manager_id
        WHERE e.date >= ${from} AND e.date <= ${to}
        ORDER BY e.date DESC, e.created_at DESC
      `;

    const { rows: events } = await queryWithJoin;

    // Totals
    let totalSales = 0, totalPeople = 0, totalAmount = 0;
    for (const e of events) {
      totalSales  += Number(e.sales_count || 0);
      totalPeople += Number(e.people || 0);
      totalAmount += Number(e.amount || 0);
    }

    // Агрегация по менеджерам
    const map = new Map();
    for (const e of events) {
      const key = e.manager_id || '—';
      if (!map.has(key)) {
        map.set(key, {
          managerId: e.manager_id || null,
          managerName: e.manager_name || '—',
          target: Number(e.manager_target || 0),
          sales: 0,
          people: 0,
          amount: 0
        });
      }
      const row = map.get(key);
      row.sales  += Number(e.sales_count || 0);
      row.people += Number(e.people || 0);
      row.amount += Number(e.amount || 0);
    }

    const byManager = Array.from(map.values())
      .sort((a, b) => b.people - a.people || b.sales - a.sales);

    return res.status(200).json({
      range: { from, to },
      totals: { sales: totalSales, people: totalPeople, amount: totalAmount },
      byManager
    });
  } catch (e) {
    console.error('AGG ERROR:', e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

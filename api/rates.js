// /api/rates -> GET: курс KGS<->KZT (устойчивый, без 500)
export default async function handler(req, res) {
  try {
    // Локально Node может быть без fetch — подхватываем node-fetch динамически
    const fetchFn = globalThis.fetch || (await import('node-fetch')).default;

    // 1-й провайдер: exchangerate.host (прямой KGS->KZT)
    try {
      const r = await fetchFn('https://api.exchangerate.host/latest?base=KGS&symbols=KZT', { timeout: 8000 });
      if (r.ok) {
        const data = await r.json();
        const kgs_to_kzt = data?.rates?.KZT;
        if (kgs_to_kzt) {
          return res.status(200).json({
            kgs_to_kzt,
            kzt_to_kgs: 1 / kgs_to_kzt,
            updated: data?.date || new Date().toISOString().slice(0, 10)
          });
        }
      }
    } catch (_) {}

    // 2-й провайдер: open.er-api.com (KGS->KZT в списке rates)
    try {
      const r2 = await fetchFn('https://open.er-api.com/v6/latest/KGS', { timeout: 8000 });
      if (r2.ok) {
        const data2 = await r2.json();
        const kgs_to_kzt = data2?.rates?.KZT;
        if (kgs_to_kzt) {
          return res.status(200).json({
            kgs_to_kzt,
            kzt_to_kgs: 1 / kgs_to_kzt,
            updated: data2?.time_last_update_utc || null
          });
        }
      }
    } catch (_) {}

    // Фолбэк, чтобы НЕ сыпались 500 (лучше показать хоть что-то)
    return res.status(200).json({
      kgs_to_kzt: 5.0, // фолбэк
      kzt_to_kgs: 0.2,
      updated: null
    });
  } catch (e) {
    // Даже при любой ошибке — отдать фолбэк, а не 500
    return res.status(200).json({
      kgs_to_kzt: 5.0,
      kzt_to_kgs: 0.2,
      updated: null
    });
  }
}

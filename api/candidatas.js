import { cargarCandidatas, NotConfiguredError } from '../lib/sheet.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const datos = await cargarCandidatas();
    res.status(200).json({ ...datos, fuente: 'planilla', puedeVotar: true });
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      res.status(503).json({ error: 'not_configured' });
      return;
    }
    res.status(502).json({ error: error.message });
  }
}

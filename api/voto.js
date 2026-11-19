import { guardarVoto, NotConfiguredError } from '../lib/sheet.js';

async function leerCuerpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let texto = '';
  for await (const parte of req) texto += parte;
  return JSON.parse(texto || '{}');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  let cuerpo;
  try {
    cuerpo = await leerCuerpo(req);
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }
  try {
    const resultado = await guardarVoto(cuerpo.id, cuerpo.voto);
    res.status(200).json(resultado);
  } catch (error) {
    if (error instanceof NotConfiguredError) {
      res.status(503).json({ error: 'not_configured' });
    } else if (error instanceof TypeError) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(502).json({ error: error.message });
    }
  }
}

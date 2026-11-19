// Acceso a la planilla a través del Apps Script publicado como aplicación web.

export const VOTOS_VALIDOS = ['Me gusta', 'Quizás', 'No', ''];

export class NotConfiguredError extends Error {
  constructor() {
    super('APPS_SCRIPT_URL no está configurada');
    this.name = 'NotConfiguredError';
  }
}

function config(env = process.env) {
  const url = env.APPS_SCRIPT_URL;
  if (!url) throw new NotConfiguredError();
  return { url, token: env.APPS_SCRIPT_TOKEN || '' };
}

async function leerJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`Respuesta inesperada del Apps Script (HTTP ${respuesta.status})`);
  }
}

export async function cargarCandidatas({ env, fetchImpl = fetch } = {}) {
  const { url, token } = config(env);
  const destino = new URL(url);
  if (token) destino.searchParams.set('token', token);
  const respuesta = await fetchImpl(destino, { redirect: 'follow' });
  const datos = await leerJson(respuesta);
  if (datos.error) throw new Error(`Apps Script: ${datos.error}`);
  return datos;
}

export async function guardarVoto(id, voto, { env, fetchImpl = fetch } = {}) {
  if (typeof id !== 'string' || !id.trim()) throw new TypeError('id inválido');
  if (!VOTOS_VALIDOS.includes(voto)) throw new TypeError('voto inválido');
  const { url, token } = config(env);
  // text/plain evita el preflight y el Apps Script lee el cuerpo igual.
  const respuesta = await fetchImpl(url, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, id, voto }),
  });
  const datos = await leerJson(respuesta);
  if (datos.error) throw new Error(`Apps Script: ${datos.error}`);
  return datos;
}

// Servidor local: sirve public/ y las funciones de api/ con la misma firma que Vercel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const publico = join(raiz, 'public');
const puerto = Number(process.env.PORT) || 3000;
const tipos = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

function adaptarRespuesta(res) {
  res.status = (codigo) => { res.statusCode = codigo; return res; };
  res.json = (datos) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(datos)); return res; };
  return res;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) {
    const nombre = url.pathname.slice(5).replace(/[^a-z]/g, '');
    try {
      const modulo = await import(join(raiz, 'api', `${nombre}.js`));
      await modulo.default(req, adaptarRespuesta(res));
    } catch (error) {
      res.statusCode = 404;
      res.end(String(error.message));
    }
    return;
  }
  const ruta = normalize(join(publico, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!ruta.startsWith(publico)) { res.statusCode = 403; res.end(); return; }
  try {
    const contenido = await readFile(ruta);
    res.setHeader('Content-Type', tipos[extname(ruta)] || 'application/octet-stream');
    res.end(contenido);
  } catch {
    res.statusCode = 404;
    res.end('No encontrado');
  }
}).listen(puerto, () => console.log(`http://localhost:${puerto}`));

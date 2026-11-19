// Lógica pura de la app: sin DOM, para poder testearla con node --test.

const COLUMNAS = {
  ID: 'id',
  Prioridad: 'prioridad',
  Fuente: 'fuente',
  Link: 'link',
  Tipo: 'tipo',
  'Título': 'titulo',
  'Dirección': 'direccion',
  Barrio: 'barrio',
  'Distancia en línea recta (km)': 'km',
  'Cuadras aprox.': 'cuadras',
  'Precio USD': 'precio',
  'm² cubiertos': 'm2Cubiertos',
  'm² totales': 'm2Totales',
  'USD por m² cubierto': 'usdM2',
  Dormitorios: 'dormitorios',
  Cocina: 'cocina',
  Exterior: 'exterior',
  'Apto crédito': 'aptoCredito',
  'Expensas ARS': 'expensas',
  Foto: 'foto',
  'Estado de los datos': 'estado',
  'Precio dentro del criterio': 'precioOk',
  'Dentro del radio': 'radioOk',
  Voto: 'voto',
};

const NUMERICAS = new Set([
  'prioridad', 'km', 'cuadras', 'precio', 'm2Cubiertos', 'm2Totales', 'usdM2', 'dormitorios', 'expensas',
]);

export const VOTOS = { si: 'Me gusta', quizas: 'Quizás', no: 'No' };

function aNumero(valor) {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function aBooleano(valor) {
  if (valor === true || valor === 'TRUE') return true;
  if (valor === false || valor === 'FALSE') return false;
  return null;
}

function aTexto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/** Convierte { headers, rows } de la planilla en objetos con claves fijas. */
export function normalizar({ headers, rows }) {
  const indices = headers.map((h) => COLUMNAS[String(h).trim()] || null);
  return rows
    .map((fila) => {
      const p = {};
      indices.forEach((clave, i) => {
        if (!clave) return;
        const valor = fila[i];
        if (NUMERICAS.has(clave)) p[clave] = aNumero(valor);
        else if (clave === 'precioOk' || clave === 'radioOk') p[clave] = aBooleano(valor);
        else p[clave] = aTexto(valor);
      });
      return p;
    })
    .filter((p) => p.id);
}

/** Estado de cada criterio de búsqueda: 'ok', 'falta' o 'no'. */
export function evaluarCriterios(p) {
  const criterio = (ok, falta) => (ok === null || falta ? 'falta' : ok ? 'ok' : 'no');
  const cocina = p.cocina.toLowerCase();
  const credito = p.aptoCredito.toLowerCase();
  const sinDatoCocina = !cocina || cocina === 'no dice';
  const sinDatoCredito = !credito || credito === 'no dice';
  return [
    { clave: 'precio', nombre: 'Precio', estado: criterio(p.precioOk, p.precio === null) },
    { clave: 'radio', nombre: 'Cerca del trabajo', estado: criterio(p.radioOk, p.cuadras === null) },
    {
      clave: 'cocina',
      nombre: 'Cocina separada',
      estado: sinDatoCocina ? 'falta' : cocina === 'separada' ? 'ok' : 'no',
    },
    { clave: 'exterior', nombre: 'Balcón o patio', estado: p.exterior ? 'ok' : 'falta' },
    {
      clave: 'credito',
      nombre: 'Apto crédito',
      estado: sinDatoCredito ? 'falta' : credito.startsWith('s') ? 'ok' : 'no',
    },
  ];
}

/** Cuota de un préstamo francés, igual que PMT de la planilla. */
export function cuota(capital, tasaAnual, anios) {
  const n = anios * 12;
  const i = tasaAnual / 12;
  if (!capital || !n) return null;
  if (i === 0) return capital / n;
  return (capital * i) / (1 - Math.pow(1 + i, -n));
}

/** Cuota inicial estimada en pesos, con los supuestos de "Research mercado". */
export function cuotaInicialArs(precio, s) {
  if (!precio || !s) return null;
  const c = cuota(precio * s.financiado, s.tasa, s.plazo);
  return c === null ? null : c * s.tipoCambio;
}

/** Votos locales pisan a los de la planilla; devuelve el voto efectivo. */
export function votoDe(p, votosLocales) {
  return Object.prototype.hasOwnProperty.call(votosLocales, p.id) ? votosLocales[p.id] : p.voto;
}

/** Propiedades sin votar, ordenadas: primero las que cumplen más criterios. */
export function cola(propiedades, votosLocales) {
  const puntaje = (p) => evaluarCriterios(p).reduce((s, c) => s + (c.estado === 'ok' ? 2 : c.estado === 'falta' ? 1 : 0), 0);
  return propiedades
    .filter((p) => !votoDe(p, votosLocales))
    .map((p, orden) => ({ p, orden, puntaje: puntaje(p) }))
    .sort((a, b) => b.puntaje - a.puntaje || a.orden - b.orden)
    .map((x) => x.p);
}

const usd = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
export const formatoUsd = (n) => (n === null || n === undefined ? 'Sin precio' : `USD ${usd.format(n)}`);
export const formatoArs = (n) => (n === null || n === undefined ? '' : `$ ${usd.format(Math.round(n))}`);

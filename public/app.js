import {
  normalizar, evaluarCriterios, cuotaInicialArs, votoDe, cola, VOTOS, formatoUsd, formatoArs,
} from './logic.js';

const CLAVE_VOTOS = 'deptoGerman.votos';
const UMBRAL = 90;

const estado = {
  propiedades: [],
  supuestos: null,
  puedeVotar: false,
  votosLocales: leerVotosLocales(),
  historial: [],
  vista: 'cola',
};

const $ = (sel) => document.querySelector(sel);

function leerVotosLocales() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VOTOS)) || {};
  } catch {
    return {};
  }
}

function guardarVotosLocales() {
  try {
    localStorage.setItem(CLAVE_VOTOS, JSON.stringify(estado.votosLocales));
  } catch {
    // Sin almacenamiento: los votos quedan solo en memoria.
  }
}

function mostrarToast(texto) {
  const toast = $('#toast');
  toast.textContent = texto;
  toast.hidden = false;
  clearTimeout(mostrarToast.t);
  mostrarToast.t = setTimeout(() => { toast.hidden = true; }, 3200);
}

async function cargar() {
  try {
    const r = await fetch('/api/candidatas', { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const datos = await r.json();
    aplicarDatos(datos, true);
  } catch {
    const r = await fetch('data/candidatas.json', { cache: 'no-store' });
    const datos = await r.json();
    aplicarDatos(datos, false);
    const aviso = $('#aviso');
    aviso.textContent = `Usando la copia del ${datos.actualizado || 'último relevamiento'}. Los votos se guardan en este teléfono hasta conectar la planilla.`;
    aviso.hidden = false;
  }
  render();
}

function aplicarDatos(datos, puedeVotar) {
  estado.propiedades = normalizar(datos);
  estado.supuestos = datos.supuestos || null;
  estado.puedeVotar = puedeVotar;
}

async function votar(p, clave) {
  const voto = clave ? VOTOS[clave] : '';
  const anterior = votoDe(p, estado.votosLocales);
  estado.votosLocales[p.id] = voto;
  guardarVotosLocales();
  if (clave) estado.historial.push({ id: p.id, anterior });
  render();
  if (!estado.puedeVotar) return;
  try {
    const r = await fetch('/api/voto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, voto }),
    });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    mostrarToast('No se pudo guardar en la planilla. El voto quedó en este teléfono.');
  }
}

function deshacer() {
  const ultimo = estado.historial.pop();
  if (!ultimo) return;
  const p = estado.propiedades.find((x) => x.id === ultimo.id);
  const clave = Object.keys(VOTOS).find((k) => VOTOS[k] === ultimo.anterior) || null;
  estado.votosLocales[p.id] = ultimo.anterior || '';
  guardarVotosLocales();
  if (estado.puedeVotar) {
    fetch('/api/voto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, voto: clave ? VOTOS[clave] : '' }),
    }).catch(() => mostrarToast('No se pudo deshacer en la planilla.'));
  }
  render();
}

function crearTarjeta(p) {
  const nodo = $('#tpl-tarjeta').content.firstElementChild.cloneNode(true);
  nodo.dataset.id = p.id;
  nodo.querySelector('.ventana-nombre').textContent = `${p.id || 'DEPTO'}.EXE`;
  const img = nodo.querySelector('img');
  const foto = nodo.querySelector('.foto');
  if (p.foto) {
    img.src = p.foto;
    img.addEventListener('error', () => { img.hidden = true; foto.classList.add('sin-foto'); });
  } else {
    img.hidden = true;
    foto.classList.add('sin-foto');
  }
  nodo.querySelector('.tipo').textContent = p.tipo || 'Propiedad';
  nodo.querySelector('.precio').textContent = formatoUsd(p.precio);
  nodo.querySelector('.titulo').textContent = p.titulo;
  const lugar = [p.direccion, p.barrio].filter(Boolean).join(' · ') || 'Ubicación sin confirmar';
  const distancia = p.cuadras !== null ? ` · a ${p.cuadras} cuadras del trabajo` : '';
  nodo.querySelector('.ubicacion').textContent = lugar + distancia;

  const ul = nodo.querySelector('.criterios');
  for (const c of evaluarCriterios(p)) {
    const li = document.createElement('li');
    li.className = c.estado;
    const marca = c.estado === 'ok' ? '✓' : c.estado === 'no' ? '✕' : '?';
    li.textContent = `${marca} ${c.nombre}`;
    ul.append(li);
  }

  const m2 = (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
  const datos = [
    ['Superficie', p.m2Cubiertos ? `${m2(p.m2Cubiertos)} m² cub.${p.m2Totales ? ` / ${m2(p.m2Totales)} tot.` : ''}` : 'Sin dato'],
    ['USD por m²', p.usdM2 ? Math.round(p.usdM2).toLocaleString('es-AR') : 'Sin dato'],
    ['Dormitorios', p.dormitorios ?? 'Sin dato'],
    ['Cocina', p.cocina || 'Sin dato'],
    ['Exterior', p.exterior || 'Sin dato'],
    ['Expensas', p.expensas === 0 ? 'No paga' : p.expensas ? formatoArs(p.expensas) : 'Sin dato'],
    ['Cuota inicial aprox.', formatoArs(cuotaInicialArs(p.precio, estado.supuestos)) || 'Sin precio'],
    ['Fuente', p.fuente],
  ];
  const dl = nodo.querySelector('.datos');
  for (const [dt, dd] of datos) {
    const div = document.createElement('div');
    div.innerHTML = '<dt></dt><dd></dd>';
    div.querySelector('dt').textContent = dt;
    div.querySelector('dd').textContent = dd;
    dl.append(div);
  }
  nodo.querySelector('.estado').textContent = p.estado;
  const link = nodo.querySelector('.ver');
  if (p.link) link.href = p.link; else link.remove();
  return nodo;
}

function activarArrastre(tarjeta, p) {
  let inicio = null;
  const sellos = {
    si: tarjeta.querySelector('.sello-si'),
    no: tarjeta.querySelector('.sello-no'),
    quizas: tarjeta.querySelector('.sello-quizas'),
  };
  const mover = (dx, dy) => {
    tarjeta.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
    sellos.si.style.opacity = Math.max(0, Math.min(1, dx / UMBRAL));
    sellos.no.style.opacity = Math.max(0, Math.min(1, -dx / UMBRAL));
    sellos.quizas.style.opacity = Math.abs(dx) < 40 ? Math.max(0, Math.min(1, -dy / UMBRAL)) : 0;
  };
  tarjeta.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a')) return;
    inicio = { x: e.clientX, y: e.clientY };
    tarjeta.setPointerCapture(e.pointerId);
    tarjeta.classList.add('arrastrando');
  });
  tarjeta.addEventListener('pointermove', (e) => {
    if (!inicio) return;
    mover(e.clientX - inicio.x, e.clientY - inicio.y);
  });
  const soltar = (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    inicio = null;
    tarjeta.classList.remove('arrastrando');
    if (dx > UMBRAL) return lanzar(tarjeta, p, 'si');
    if (dx < -UMBRAL) return lanzar(tarjeta, p, 'no');
    if (dy < -UMBRAL) return lanzar(tarjeta, p, 'quizas');
    mover(0, 0);
    tarjeta.style.transform = '';
  };
  tarjeta.addEventListener('pointerup', soltar);
  tarjeta.addEventListener('pointercancel', soltar);
}

function lanzar(tarjeta, p, clave) {
  const destino = { si: 'translate(140%, 0) rotate(20deg)', no: 'translate(-140%, 0) rotate(-20deg)', quizas: 'translate(0, -140%)' };
  tarjeta.style.transform = destino[clave];
  tarjeta.style.opacity = '0';
  setTimeout(() => votar(p, clave), 200);
}

function renderCola() {
  const mazo = $('#mazo');
  mazo.replaceChildren();
  const pendientes = cola(estado.propiedades, estado.votosLocales);
  $('#acciones').querySelectorAll('[data-voto]').forEach((b) => { b.disabled = pendientes.length === 0; });
  $('#deshacer').disabled = estado.historial.length === 0;
  if (pendientes.length === 0) {
    const vacio = document.createElement('div');
    vacio.className = 'vacio';
    vacio.innerHTML = '<strong>No quedan propiedades por ver</strong>Cuando se agreguen nuevas a la planilla van a aparecer acá.';
    mazo.append(vacio);
    return;
  }
  const [actual, siguiente] = pendientes;
  if (siguiente) {
    const atras = crearTarjeta(siguiente);
    atras.classList.add('siguiente');
    atras.setAttribute('aria-hidden', 'true');
    mazo.append(atras);
  }
  const frente = crearTarjeta(actual);
  activarArrastre(frente, actual);
  mazo.append(frente);
}

function renderLista() {
  const ul = $('#lista');
  ul.replaceChildren();
  const filtradas = estado.propiedades.filter((p) => estado.vista === 'todas' || votoDe(p, estado.votosLocales) === VOTOS.si);
  if (filtradas.length === 0) {
    const li = document.createElement('li');
    li.className = 'vacio';
    li.style.position = 'static';
    li.innerHTML = '<strong>Todavía no hay favoritas</strong>Deslizá a la derecha las que te gusten.';
    ul.append(li);
    return;
  }
  for (const p of filtradas) {
    const li = document.createElement('li');
    li.className = 'fila';
    const mini = p.foto ? document.createElement('img') : document.createElement('div');
    if (p.foto) { mini.src = p.foto; mini.alt = ''; mini.loading = 'lazy'; mini.referrerPolicy = 'no-referrer'; }
    mini.className = 'miniatura';
    const info = document.createElement('div');
    const h3 = document.createElement('h3');
    h3.textContent = `${formatoUsd(p.precio)} · ${p.titulo}`;
    const lugar = document.createElement('p');
    lugar.textContent = [p.barrio, p.cuadras !== null ? `${p.cuadras} cuadras` : ''].filter(Boolean).join(' · ') || 'Ubicación sin confirmar';
    info.append(h3, lugar);
    if (p.link) {
      const a = document.createElement('a');
      a.href = p.link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Ver aviso';
      info.append(a);
    }
    const botones = document.createElement('div');
    botones.className = 'votos-fila';
    const actual = votoDe(p, estado.votosLocales);
    for (const [clave, texto] of Object.entries(VOTOS)) {
      const b = document.createElement('button');
      b.textContent = texto;
      b.setAttribute('aria-pressed', String(actual === texto));
      b.addEventListener('click', () => votar(p, actual === texto ? null : clave));
      botones.append(b);
    }
    info.append(botones);
    li.append(mini, info);
    ul.append(li);
  }
}

function render() {
  const pendientes = cola(estado.propiedades, estado.votosLocales).length;
  const favoritas = estado.propiedades.filter((p) => votoDe(p, estado.votosLocales) === VOTOS.si).length;
  document.querySelector('[data-cuenta="cola"]').textContent = `(${pendientes})`;
  document.querySelector('[data-cuenta="si"]').textContent = `(${favoritas})`;
  document.querySelectorAll('[data-vista]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === estado.vista)));
  $('#vista-cola').hidden = estado.vista !== 'cola';
  $('#vista-lista').hidden = estado.vista === 'cola';
  if (estado.vista === 'cola') renderCola(); else renderLista();
}

document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => { estado.vista = b.dataset.vista; render(); }));

$('#acciones').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-voto]');
  if (!boton) return;
  const frente = $('#mazo .tarjeta:not(.siguiente)');
  const p = frente && estado.propiedades.find((x) => x.id === frente.dataset.id);
  if (p) lanzar(frente, p, boton.dataset.voto);
});

$('#deshacer').addEventListener('click', deshacer);

document.addEventListener('keydown', (e) => {
  if (estado.vista !== 'cola') return;
  const mapa = { ArrowRight: 'si', ArrowLeft: 'no', ArrowUp: 'quizas' };
  if (mapa[e.key]) document.querySelector(`[data-voto="${mapa[e.key]}"]`)?.click();
  if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) deshacer();
});

cargar();

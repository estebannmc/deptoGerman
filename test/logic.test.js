import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizar, evaluarCriterios, cuota, cuotaInicialArs, cola } from '../public/logic.js';

const snapshot = JSON.parse(await readFile(new URL('../public/data/candidatas.json', import.meta.url), 'utf8'));

test('normaliza todas las filas con ID', () => {
  const props = normalizar(snapshot);
  assert.equal(props.length, 14);
  const p1 = props[0];
  assert.equal(p1.id, 'P01');
  assert.equal(p1.precio, 69000);
  assert.equal(p1.cuadras, 7);
  assert.equal(p1.radioOk, true);
  assert.equal(props[1].cuadras, null);
});

test('evalúa criterios de P01 como cumplidos', () => {
  const [p1] = normalizar(snapshot);
  assert.deepEqual(
    evaluarCriterios(p1).map((c) => c.estado),
    ['ok', 'ok', 'ok', 'ok', 'ok']
  );
});

test('marca dato faltante y rechazos', () => {
  const props = normalizar(snapshot);
  const p10 = props.find((p) => p.id === 'P10');
  const estados = Object.fromEntries(evaluarCriterios(p10).map((c) => [c.clave, c.estado]));
  assert.equal(estados.cocina, 'falta');
  assert.equal(estados.credito, 'falta');
  const p14 = props.find((p) => p.id === 'P14');
  assert.equal(evaluarCriterios(p14).find((c) => c.clave === 'radio').estado, 'no');
});

test('la cuota coincide con PMT de la planilla', () => {
  // Planilla: 52.500 USD al 7,5% en 20 años = 422,94 USD.
  assert.equal(Math.round(cuota(52500, 0.075, 20) * 100) / 100, 422.94);
  assert.equal(Math.round(cuotaInicialArs(70000, snapshot.supuestos)), 664010);
});

test('la cola excluye votadas y prioriza las que cumplen', () => {
  const props = normalizar(snapshot);
  const pendientes = cola(props, { P01: 'No' });
  assert.ok(!pendientes.some((p) => p.id === 'P01'));
  assert.equal(pendientes.length, 13);
  assert.equal(cola(props, {})[0].id, 'P01');
});

/**
 * API de la planilla "Prioridad dptos" para la webapp deptoGerman.
 *
 * Instalación (una sola vez, desde la cuenta dueña de la planilla):
 * 1. Abrir la planilla > Extensiones > Apps Script y pegar este archivo.
 * 2. Configuración del proyecto > Propiedades de la secuencia de comandos:
 *    agregar TOKEN con una clave larga cualquiera.
 * 3. Implementar > Nueva implementación > Aplicación web.
 *    Ejecutar como: yo. Quién tiene acceso: cualquier usuario.
 * 4. Copiar la URL que termina en /exec y cargarla en Vercel como
 *    APPS_SCRIPT_URL, junto con APPS_SCRIPT_TOKEN (el mismo TOKEN).
 */

// Planilla "Prioridad dptos". Se usa si el script no está creado desde la planilla.
const ID_PLANILLA = '1GAKtLxr7Gp9z6XsWxsVIduSpCzwCk8wctC0gT2Qwh4k';
const HOJA_CANDIDATAS = 'Candidatas';
const HOJA_RESEARCH = 'Research mercado';
const COLUMNA_VOTO = 'Voto';
const VOTOS_VALIDOS = ['Me gusta', 'Quizás', 'No', ''];

// Celdas de "Research mercado" que usa la app para estimar la cuota.
const SUPUESTOS = {
  tipoCambio: 'B20',
  financiado: 'B21',
  tasa: 'B22',
  tasaAlternativa: 'B23',
  plazo: 'B24',
  alquiler: 'B27',
};

function doGet(e) {
  if (!autorizado_(e && e.parameter && e.parameter.token)) {
    return json_({ error: 'unauthorized' });
  }
  const libro = libro_();
  const valores = libro.getSheetByName(HOJA_CANDIDATAS).getDataRange().getValues();
  const headers = valores.shift();
  const rows = valores.filter(function (fila) {
    return String(fila[0]).trim() !== '';
  });

  const research = libro.getSheetByName(HOJA_RESEARCH);
  const supuestos = {};
  Object.keys(SUPUESTOS).forEach(function (clave) {
    supuestos[clave] = research.getRange(SUPUESTOS[clave]).getValue();
  });

  return json_({ headers: headers, rows: rows, supuestos: supuestos });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ error: 'invalid_json' });
  }
  if (!autorizado_(body.token)) return json_({ error: 'unauthorized' });
  if (VOTOS_VALIDOS.indexOf(body.voto) < 0) return json_({ error: 'invalid_vote' });
  if (!body.id) return json_({ error: 'missing_id' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = libro_().getSheetByName(HOJA_CANDIDATAS);
    const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    const columna = headers.indexOf(COLUMNA_VOTO) + 1;
    if (columna === 0) return json_({ error: 'missing_vote_column' });

    const ultimaFila = hoja.getLastRow();
    if (ultimaFila < 2) return json_({ error: 'not_found' });
    const ids = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === String(body.id).trim()) {
        hoja.getRange(i + 2, columna).setValue(body.voto);
        return json_({ ok: true, id: body.id, voto: body.voto });
      }
    }
    return json_({ error: 'not_found' });
  } finally {
    lock.releaseLock();
  }
}

function autorizado_(token) {
  const esperado = PropertiesService.getScriptProperties().getProperty('TOKEN');
  return !esperado || token === esperado;
}

function json_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function libro_() {
  return SpreadsheetApp.getActive() || SpreadsheetApp.openById(ID_PLANILLA);
}

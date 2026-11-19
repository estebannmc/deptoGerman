# Depto German

Webapp tipo Tinder para que German elija propiedades en Rosario. Lee las candidatas de la pestaña **Candidatas** de la planilla "Prioridad dptos" y guarda cada voto (Me gusta, Quizás o No) en la columna **Voto** de esa misma planilla.

Cada tarjeta muestra precio, ubicación, distancia al trabajo (Mendoza 1000) y si cumple los criterios de búsqueda: precio, cercanía, cocina separada, balcón o patio y apto crédito. También estima la cuota inicial del crédito con los supuestos de la pestaña **Research mercado**.

## Cómo funciona

```
Celular ──> Vercel (public/ + api/) ──> Apps Script ──> Google Sheet
```

- `public/`: la app (HTML, CSS y JS sin dependencias).
- `api/candidatas.js` y `api/voto.js`: funciones de Vercel que hablan con el Apps Script. Así la URL y el token del script no quedan expuestos en el navegador.
- `apps-script/Code.gs`: la API de la planilla. Se ejecuta con la cuenta dueña del archivo, así que la planilla no necesita ser pública.
- `public/data/candidatas.json`: copia de las candidatas al 19/11/2026. Si el Apps Script no está configurado, la app usa esta copia y guarda los votos solo en el teléfono.

## Conectar la planilla

1. Abrir la planilla, ir a **Extensiones > Apps Script** y pegar el contenido de `apps-script/Code.gs`.
2. En **Configuración del proyecto > Propiedades de la secuencia de comandos**, agregar `TOKEN` con una clave larga.
3. **Implementar > Nueva implementación > Aplicación web**. Ejecutar como: *yo*. Quién tiene acceso: *cualquier usuario*. Autorizar el acceso a la planilla.
4. En Vercel, cargar dos variables de entorno y volver a desplegar:
   - `APPS_SCRIPT_URL`: la URL de la implementación (termina en `/exec`).
   - `APPS_SCRIPT_TOKEN`: el mismo valor de `TOKEN`.

Para agregar propiedades, se suman filas en la pestaña Candidatas con un ID nuevo (por ejemplo `P15`). Las columnas de distancia, precio dentro del criterio y radio se calculan solas en la planilla.

## Desarrollo local

```bash
npm run dev
```

Abre la app en http://localhost:3000. Sin variables de entorno usa la copia local; con `APPS_SCRIPT_URL` y `APPS_SCRIPT_TOKEN` usa la planilla.

```bash
npm test
```

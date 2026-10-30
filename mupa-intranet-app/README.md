# Intranet MUPA — web (SPA)

Frontend de la intranet de la Alcaldía de Panamá: **React 19 + Vite + React Router**, como SPA. Lo compila Vite a `dist/` y en producción lo sirve nginx, que además reenvía `/api/` al backend (`../mupa-intranet-api`).

Qué tiene:
- **Inicio:** arriba, un encabezado fijo con el saludo y la caja "¿Qué necesitas hoy?". Busca mientras se escribe (resultados agrupados: aplicaciones, formularios, personas, documentos, noticias…) y con "Preguntar al asistente" muestra la respuesta del asistente arriba de los resultados (`components/inicio/Encabezado.tsx`). Debajo, la cuadrícula bento modular con arrastrar y soltar (@dnd-kit: mouse, táctil y teclado), tamaños, Personalizar y Deshacer. Se guarda en la cuenta, o en el navegador si no hay sesión, y administración puede usar "Guardar para todos".
- **Recorrido para usuarios nuevos:** aparece la primera vez (con o sin sesión) y se repite desde Ayuda o Configuración (`/?recorrido=1`). Pasos en `lib/recorrido.ts`, pantalla en `components/recorrido/Recorrido.tsx`. Visto: `localStorage` `mupa_recorrido` y, con sesión, en la cuenta (`PUT /api/me/tour`).
- **Login** (`/entrar`): página propia, sin menú. Pide "Cédula o correo institucional", con Mostrar/Ocultar, aviso de Bloq Mayús, errores que dicen qué hacer, "¿Olvidaste tu contraseña?" (Mesa de Servicios, ext. 1400) y vuelta a la página de origen (`EnlaceEntrar`).
- **Aplicaciones:** catálogo con filtros por área y etiqueta que quedan en la dirección, y favoritos.
- **Buscador de la barra** (en las demás páginas): Ctrl/⌘+K, con resultados por categoría; en el Inicio, Ctrl/⌘+K va a la caja grande. **Asistente**: preguntas en lenguaje natural sobre el catálogo (ver el README de la API); si no hay servidor de inferencia, no se ofrece.
- **Shell:** menú de 6 destinos, cajón en el celular y barra inferior, con el contador de boletines nuevos.
- **Formularios de solicitud** (`/formularios`, `/formularios/:slug`; **solo en la edición `completa`**: en `publicacion` están apagados junto con la bandeja de gestión, la campana y las filas «Próximamente», ver `src/lib/edicion.ts`): los 10, con un solo componente. Tienen validación, secciones condicionales, listas que crecen y precarga de nombre y correo desde la sesión. **El envío es simulado**: se muestra lo que se mandaría y no se transmite nada, hasta que DITI y RRHH aprueben los formularios y definan a quién llegan.
- **Secciones:** Documentos, Boletines, Manuales, Videos, Noticias, Directorio, Recursos Humanos, Clínica (con recetas y medicamentos), Mesa de Servicios y Soporte ISTMO.

### De dónde sale el contenido

Las secciones muestran el contenido **real** de la intranet actual. Está en archivos de `src/data/` y para publicar algo nuevo se edita el archivo y se vuelve a desplegar:

| Archivo | Contenido |
|---|---|
| `formularios.json` | Los 10 formularios: secciones, campos, reglas y cambios propuestos. |
| `documentos.ts`, `manuales.ts` | Reglamentos, manuales, procedimientos y permisos. |
| `boletines.ts` | Los boletines "Alcaldía al día", con la página de su flipbook. |
| `videos.ts`, `noticias.ts` | Videos y entradas del sitio actual. |
| `clinica.ts` | Personal de la Clínica (nombres y fotos que ya publica la intranet) y medicamentos. |
| `directorio.ts` | Direcciones y extensiones reales; **las 26 personas son ficticias** hasta que RRHH y Legal decidan qué se publica. Los datos reales deberían venir de la API con sesión, no de este archivo. |

El contenido del Inicio (noticias, enlaces, beneficios…) viene de la API (`/api/home/content`). Los anuncios vienen de `/api/announcements` y los publica Comunicación desde `/gestion/anuncios`.

Lo que no existe en el sitio actual no se inventa: se muestra marcado "Ejemplo", como plazo propuesto, o como "Sin publicar".

**Límites de la CSP** (`nginx/seguridad.conf`, solo recursos del mismo sitio): los PDF, flipbooks y videos del sitio actual se abren en una **pestaña nueva**. No se incrustan en la página ni se traen miniaturas de YouTube. `npm run dev` no manda la CSP: para verla, `npm run test:e2e:dist`.

Las imágenes están en `public/sitio/`, recomprimidas desde las del sitio actual.

## Correr en local

Hacen falta dos terminales, porque la SPA usa el backend real.

```bash
# 1) backend (base local PGlite, con cuentas ficticias)
cd ../mupa-intranet-api && cp .env.example .env && npm install && npm run dev

# 2) esta SPA
npm install && npm run dev        # → http://localhost:5173
```

Vite reenvía `/api` a `http://localhost:3000`. Para usar otro backend, pon `API_URL=http://…` en `.env.local`.

Las cuentas de prueba son `prueba1@ejemplo.test`, `admin@ejemplo.test`, etc., con contraseña `password` (ver el README del backend).

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | SPA con recarga en caliente. |
| `npm run build` | Revisa los tipos y compila a `dist/`. |
| `npm run preview` | Sirve `dist/` con las mismas cabeceras de seguridad (CSP) que nginx. |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript. |
| `npm run test:int` | Vitest: reglas compartidas (`src/lib`), los 10 formularios, fechas, menú y que no haya IPs internas en el código. |
| `npm run test:e2e` | Playwright contra `npm run dev` y el backend real (arranca los dos solo, con base en memoria). |
| `npm run test:e2e:dist` | Lo mismo, pero contra el `dist/` compilado con la CSP de nginx. |

Playwright usa el Chrome instalado (`channel: 'chrome'`); para Edge, `PW_CHANNEL=msedge`. Todas las pruebas empiezan con el recorrido ya visto (`storageState` en `playwright.config.ts`), salvo `recorrido.e2e.spec.ts`.

## Cómo está armado

- `src/api.ts` es el **único** archivo que habla con el backend. Si cambia una ruta de la API, solo cambia aquí.
- `src/datos.tsx` pide la sesión, el catálogo y el contenido al abrir, y otra vez al entrar o salir.
- `src/App.tsx` tiene el shell y las rutas. Los `<a href="/…">` internos navegan dentro de la SPA sin recargar.
- `src/paginas/` son las pantallas, una por ruta. Una dirección que no existe es "Página no encontrada".
- `src/components/ui.tsx` tiene las piezas comunes: encabezado con migas, avisos, filtros, tarjetas y filas.
- `src/components/formulario/` y `src/lib/formularios.ts` forman el formulario de solicitud. La lógica (validación, secciones condicionales, progreso y resumen) está separada de React y se prueba con vitest.
- `src/lib/useFiltroUrl.ts` guarda los filtros de una página en la dirección (`?q=`, `?cat=`…).
- `src/lib/fechas.ts` lee las fechas `AAAA-MM-DD` a mano. `new Date('2026-08-05')` caería el día anterior en Panamá.
- `src/components/`, `src/lib/` y `src/styles/` son el design system y la lógica del Inicio y del catálogo. El CSS es el del prototipo, sin cambios; los ajustes propios de la SPA están en `spa.css`.
- `nginx/` tiene las cabeceras de seguridad que usa `npm run preview` (y una plantilla de nginx que compose ya no usa: en producción la web la sirve la API).

## Docker

**En producción esta carpeta no tiene imagen propia**: `../mupa-intranet-api/Dockerfile` compila la web y la API la sirve (ver `../README.md`). El `Dockerfile` de aquí (nginx) queda por si se quiere servir la web aparte; compose no lo usa.

`Dockerfile` hace dos cosas:
1. Node compila `dist/`.
2. `nginx-unprivileged` lo sirve en el puerto 8080 y reenvía `/api/` a `API_UPSTREAM` (por defecto `http://api:3000`).

Además:
- Las rutas de la SPA devuelven `index.html`, y un archivo que no existe da 404.
- `/assets/` va con caché de un año e `index.html` sin caché.

Para levantarlo todo (PostgreSQL, migraciones, API y web) está `../docker-compose.yml`; ver `../README.md`.

Tipografías (las de la marca, servidas desde el propio sitio): Noka para titulares, Prometo para el logo y los nombres de direcciones, Montserrat para textos; ver `src/styles/fonts.css`.

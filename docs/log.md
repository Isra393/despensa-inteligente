---
type: Log
title: Cronología del proyecto
description: Cambios integrados en main y trabajo en curso, del más reciente al más antiguo, con sus pull requests.
timestamp: 2026-11-25
---

# Cronología

## 2026-11-25 — Actualización de la estructura del repositorio

Rama `refactor/actualizar-estructura`, [issue #29](https://github.com/Isra393/despensa-inteligente/issues/29). Se reorganiza el repositorio siguiendo el proyecto de referencia Querencia, sin cambiar el comportamiento:

- `index.js` pasa a `backend/server.js` y los módulos de `servidor/` a `backend/`.
- `cliente/` pasa a `backend/frontend/`: `index.html`, `css/estilos.css` y los scripts en `js/`. La página enlaza `/css/` y `/js/`.
- Las pruebas de `test/` pasan junto a su módulo (`backend/*.test.js`); la de integración se llama `cadMongo.integracion.test.js`.
- `package.json`, `package-lock.json` y `.env.example` pasan a `backend/`. El servidor lee `backend/.env` aunque se arranque desde otra carpeta.
- El `Dockerfile` sigue en la raíz y copia `backend/`; el CI ejecuta las pruebas desde `backend/`.
- Se crea la documentación de `docs/` y el README pasa a tener tecnologías justificadas, instrucciones de ejecución y API; el detalle de cada sprint se mueve a `docs/sprint-N.md`.

Se añade una prueba que comprueba que todos los estilos y scripts enlazados en la página se sirven. La suite queda en **178 pruebas pasadas** con `cd backend && npm test`.

Siguen abiertas, propuestas por otros miembros del equipo: la [issue #25](https://github.com/Isra393/despensa-inteligente/issues/25) con el [PR #26](https://github.com/Isra393/despensa-inteligente/pull/26) (unificar singular y plural en el ranking de alimentos tirados) y la [issue #27](https://github.com/Isra393/despensa-inteligente/issues/27) con el [PR #28](https://github.com/Isra393/despensa-inteligente/pull/28) (evitar productos duplicados en la lista de la compra). Ambos PR tocan `servidor/modelo.js` y tendrán que adaptarse a la nueva ruta `backend/modelo.js`.

## 2026-11-18 — Sprint 4: consumo rápido, escáner, recetas, hogar y estadísticas

PR [#20](https://github.com/Isra393/despensa-inteligente/pull/20) a [#24](https://github.com/Isra393/despensa-inteligente/pull/24), uno por funcionalidad: botones para restar y sumar cantidades, escáner de código de barras con Open Food Facts, recetas con lo que caduca antes, despensa compartida entre los miembros de un hogar y estadísticas de desperdicio con exportación a CSV. Detalle en [sprint-4.md](sprint-4.md).

## 2026-11-18 — Script de configuración de Google Cloud

[PR #19](https://github.com/Isra393/despensa-inteligente/pull/19): el script de `infra/` concede el permiso de lectura de imágenes de Artifact Registry que necesitaba la operación `configurar-avisos`.

## 2026-11-17 — Sprint 3: estilo, avisos, lista de la compra, ubicaciones y operaciones

PR [#13](https://github.com/Isra393/despensa-inteligente/pull/13) a [#18](https://github.com/Isra393/despensa-inteligente/pull/18): estilo visual «Mercado», avisos de caducidad por correo, lista de la compra automática, ubicaciones y el flujo de operaciones de Google Cloud con GitHub Actions. Las ramas de avisos, lista y ubicaciones se integraron juntas en `main` con el PR #18. Detalle en [sprint-3.md](sprint-3.md).

## 2026-11-17 — Sprint 2: gestión de alimentos y Google One Tap

[PR #12](https://github.com/Isra393/despensa-inteligente/pull/12): gestión de alimentos por usuario, Google One Tap, mejoras de formularios y correo en HTML, y pruebas de integración con MongoDB. Detalle en [sprint-2.md](sprint-2.md).

## 2026-11-16 — Sprint 1, hito 4: confirmación por correo y acceso con Google

PR [#8](https://github.com/Isra393/despensa-inteligente/pull/8) a [#11](https://github.com/Isra393/despensa-inteligente/pull/11): confirmación de cuentas por correo con reenvío, acceso con Google y documentación del acceso de red en Atlas.

## 2026-10-15 — Prueba técnica del Sprint 1

[PR #7](https://github.com/Isra393/despensa-inteligente/pull/7): variante 4 del bloqueo por intentos fallidos.

## 2026-10-13 — Sprint 1, hito 3: persistencia y roles

PR [#5](https://github.com/Isra393/despensa-inteligente/pull/5) y [#6](https://github.com/Isra393/despensa-inteligente/pull/6): persistencia en MongoDB Atlas, sesiones, roles, permisos, registros de actividad y panel del administrador.

## 2026-10-12 — Sprint 1, hitos 1 y 2: estructura, usuarios y sesiones

PR [#1](https://github.com/Isra393/despensa-inteligente/pull/1) a [#4](https://github.com/Isra393/despensa-inteligente/pull/4): estructura inicial con CI, contenedor para Cloud Run, gestión de usuarios en memoria con API y pruebas, registro, inicio de sesión e interfaz con sesiones. Detalle en [sprint-1.md](sprint-1.md).

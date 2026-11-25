---
type: Proceso
title: Flujo de trabajo, CI y despliegue
description: Ramas, issues y pull requests, integración continua con GitHub Actions, despliegue con Cloud Build y Cloud Run, y verificación.
timestamp: 2026-11-25
---

# Procesos

## Flujo de trabajo

- Cada cambio empieza con una issue que explica qué se propone y por qué (por ejemplo, [#25](https://github.com/Isra393/despensa-inteligente/issues/25), [#27](https://github.com/Isra393/despensa-inteligente/issues/27) o [#29](https://github.com/Isra393/despensa-inteligente/issues/29)).
- El trabajo se hace en una rama propia (`h1-…` a `h4-…` en el Sprint 1, `sprintN-…` después, y `fix/…`, `feat/…` o `refactor/…` para correcciones, mejoras y reorganizaciones).
- Cada rama se entrega con un pull request hacia `main` que enlaza su issue (`Closes #N`). En los sprints 3 y 4 cada funcionalidad tuvo su propio PR.
- Si dos ramas dependen una de otra, se integran juntas en `main` con un PR de integración (como el [#18](https://github.com/Isra393/despensa-inteligente/pull/18)).
- `main` se integra solo cuando el CI pasa.

## Integración continua

[ci.yml](../.github/workflows/ci.yml) se ejecuta en los pull requests hacia `main` y en cada cambio integrado en `main`. Usa Ubuntu y Node.js 24, instala las dependencias con `npm ci` dentro de `backend/` y ejecuta `npm test`.

`npm test` lanza `node --test`, que encuentra todos los `*.test.js` de `backend/`. Las pruebas usan almacenamiento en memoria y dobles de correo y Google: no necesitan red ni credenciales. La de integración con MongoDB se omite si no se define `MONGODB_URI_TEST`.

## Despliegue continuo

Un activador de Cloud Build conectado al repositorio construye la imagen con el [Dockerfile](../Dockerfile) de la raíz en cada cambio integrado en `main` y la despliega en el servicio de Cloud Run `despensa-inteligente` (`europe-west1`). Los secretos de producción están en Secret Manager y se inyectan como variables de entorno.

Las operaciones de configuración (secretos, token de las tareas y Cloud Scheduler) se lanzan a mano desde GitHub Actions; ver [operaciones-gcp.md](operaciones-gcp.md).

## Verificación

Antes de abrir un pull request:

```bash
cd backend
npm ci
npm test
```

Para la integración con MongoDB, con `MONGODB_URI_TEST` definido en `backend/.env`:

```bash
cd backend
npm run test:integracion
```

Tras desplegar, `GET /api/salud` debe responder `{"estado":"ok","aplicacion":"Despensa Inteligente"}`.

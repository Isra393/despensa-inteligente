---
type: Requisitos
title: Requisitos de Despensa Inteligente
description: Estado de cada requisito de arquitectura, funcional y de proceso, con la evidencia en el código o en GitHub.
timestamp: 2026-11-25
---

# Requisitos

Estados: **hecho** (implementado y con pruebas o comprobación), **parcial** (implementado con algo pendiente) y **en curso** (propuesto en una issue o PR abierto).

## Arquitectura y proceso

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| ARQ-01 | Cliente y servidor en el mismo origen | hecho | `app.js` sirve `frontend/` y el cliente llama a `/api`. |
| ARQ-02 | Capas del backend: API, lógica y datos | hecho | `api.js`, `modelo.js` (`Sistema`) y `cadMongo.js` / `cadMemoria.js`. |
| ARQ-03 | Capas del frontend: presentación y comunicación | hecho | `index.html` y `css/` separados de `js/clienteRest.js`. |
| ARQ-04 | Estructura del repositorio como el proyecto de referencia | hecho | `backend/`, `backend/frontend/{css,js}`, pruebas junto a su módulo y `docs/` ([#29](https://github.com/Isra393/despensa-inteligente/issues/29)). |
| PRO-01 | Ramas y pull requests hacia `main` | hecho | PR #1 a #24 integrados; ver [log.md](log.md). |
| PRO-02 | CI en cada pull request | hecho | [ci.yml](../.github/workflows/ci.yml) ejecuta `npm test` en `backend/`. |
| PRO-03 | Despliegue continuo | hecho | Cloud Build y Cloud Run desde `main`. |
| PRO-04 | Secretos fuera del código | hecho | `backend/.env` ignorado por Git, `.env.example` sin valores y Secret Manager en producción. |

## Usuarios, sesión y permisos (Sprint 1)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-01 | Registro local | hecho | `POST /api/registro`; pruebas en `autenticacion.test.js`. |
| RF-02 | Confirmación de cuenta por correo | hecho | `confirmacion.js`, `POST /api/confirmar-cuenta` y reenvío limitado; comprobado en producción. |
| RF-03 | Inicio de sesión local | hecho | `POST /api/login`; solo cuentas activas. |
| RF-04 | Acceso con Google | hecho | `accesoGoogle.js` y `google.js` con PKCE, `state` y `nonce`; comprobado en local y en Cloud Run. |
| RF-05 | Cierre de sesión | hecho | `POST /api/logout`. |
| RF-06 | Sesión entre recargas y reinicios | hecho | `GET /api/sesion`; sesiones en MongoDB con connect-mongo. |
| RF-07 | Listar usuarios (administrador) | hecho | `GET /api/usuarios` y panel del administrador. |
| RF-08 | Comprobar si un usuario está activo (administrador) | hecho | `GET /api/usuarios/:email/activo`. |
| RF-09 | Eliminar usuario | hecho | `DELETE /api/usuarios/:email`; la propia cuenta o, para el administrador, cualquiera. |
| RF-10 | Creación del primer administrador | parcial | La cuenta administrativa se prepara a mano en Atlas; no hay formulario. |
| RF-11 | Registro de actividad | hecho | `registroActividad.js` con niveles para Cloud Logging. |
| RF-12 | Prueba técnica: bloqueo por intentos fallidos | hecho | `calcularBloqueo` en `modelo.js`; `variante4.test.js`. |

## Despensa (sprints 2 a 4)

| ID | Requisito | Estado | Evidencia |
|---|---|---|---|
| RF-20 | Gestión de alimentos por usuario | hecho | `/api/alimentos`; `alimentos.test.js` y `alimentosApi.test.js`. |
| RF-21 | Google One Tap | hecho | `/api/auth/google/one-tap`; `googleOneTap.test.js`. Pendiente de comprobar con una cuenta real. |
| RF-22 | Estilo visual «Mercado» | hecho | `frontend/css/estilos.css`. |
| RF-23 | Avisos de caducidad por correo | hecho | `avisos.js` y `ejecutarAvisos.js`; Cloud Scheduler en producción. |
| RF-24 | Lista de la compra automática | hecho | `/api/lista-compra`; `listaCompra.test.js`. |
| RF-25 | Ubicaciones de los alimentos | hecho | Campo de ubicación y resumen `porUbicacion`. |
| RF-26 | Restar y sumar sin editar | hecho | `PATCH /api/alimentos/:id/cantidad`; `consumoRapido.test.js`. |
| RF-27 | Escáner de código de barras | hecho | `productos.js` y `/api/productos/:codigo`; `productos.test.js`. |
| RF-28 | Recetas con lo que caduca antes | hecho | `recetas.js`, `recetario.js` y `/api/recetas`; `recetas.test.js`. |
| RF-29 | Despensa compartida (hogar) | hecho | `/api/hogar`; `hogar.test.js`. |
| RF-30 | Estadísticas de desperdicio y CSV | hecho | `estadisticas.js`, `/api/estadisticas` y `/api/exportar/*.csv`; `estadisticas.test.js`. |
| RF-31 | Unificar singular y plural en el ranking de tirados | en curso | [Issue #25](https://github.com/Isra393/despensa-inteligente/issues/25) y [PR #26](https://github.com/Isra393/despensa-inteligente/pull/26). |
| RF-32 | Evitar productos duplicados en la lista de la compra | en curso | [Issue #27](https://github.com/Isra393/despensa-inteligente/issues/27) y [PR #28](https://github.com/Isra393/despensa-inteligente/pull/28). |

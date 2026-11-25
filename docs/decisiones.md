---
type: Decisiones
title: Decisiones técnicas
description: Decisiones técnicas del proyecto observables en el código, el README y el historial de pull requests, con su estado.
timestamp: 2026-11-25
---

# Decisiones

## D-01 — Backend con Node.js y Express

**Qué se decidió:** usar Node.js 24 y Express 5 para la API REST y para servir el frontend.

**Por qué:** un solo lenguaje en cliente y servidor, y un servidor ligero que sirve la API y la interfaz desde el mismo origen.

**Estado:** vigente.

## D-02 — Frontend sin framework

**Qué se decidió:** HTML, CSS y JavaScript sin framework ni compilación.

**Por qué:** la interfaz es una sola página y no necesita una herramienta de compilación. La comunicación con la API se concentra en `clienteRest.js`.

**Estado:** vigente.

## D-03 — Capa de acceso a datos intercambiable

**Qué se decidió:** separar la lógica (`Sistema` en `modelo.js`) del almacenamiento con dos implementaciones de la misma interfaz: `CadMongo` y `CadMemoria`.

**Por qué:** las pruebas de negocio y de la API se ejecutan en memoria, sin Atlas ni red. Las pruebas de integración (`cadMongo.integracion.test.js`) comprueban la combinación real cuando se define `MONGODB_URI_TEST`.

**Estado:** vigente.

## D-04 — Sesiones en el servidor guardadas en MongoDB

**Qué se decidió:** express-session con connect-mongo y cookie `httpOnly`, `sameSite=lax` y `secure` en producción.

**Por qué:** la sesión sobrevive a los reinicios y a los cambios de instancia de Cloud Run, y el navegador no puede leer la cookie.

**Estado:** vigente.

## D-05 — Contraseñas con bcrypt y confirmación por correo

**Qué se decidió:** guardar las contraseñas como hash de bcrypt y activar las cuentas con un enlace de un solo uso que caduca a las 24 horas. Solo se guarda el resumen SHA-256 del token.

**Por qué:** una filtración de la base no expone contraseñas ni enlaces válidos.

**Estado:** vigente.

## D-06 — Acceso con Google por el flujo de código con PKCE

**Qué se decidió:** flujo de código de autorización con `state`, `nonce` y PKCE, y One Tap con un `nonce` de un solo uso guardado en la sesión. Las cuentas se identifican por `googleSub` y no se vinculan por coincidencia de email.

**Por qué:** evita que alguien se apropie de una cuenta local registrando el mismo correo en Google.

**Estado:** vigente.

## D-07 — Despliegue en Cloud Run con Cloud Build

**Qué se decidió:** un activador de Cloud Build construye la imagen con el `Dockerfile` de la raíz y la despliega en Cloud Run (`europe-west1`) al integrar en `main`.

**Por qué:** despliegue continuo sin mantener servidores y con escalado a cero.

**Estado:** vigente.

## D-08 — Avisos lanzados por un planificador externo

**Qué se decidió:** los avisos de caducidad se envían cuando Cloud Scheduler llama a `POST /api/tareas/avisos-caducidad` con un token, o con `npm run avisos`.

**Por qué:** Cloud Run detiene las instancias sin tráfico, así que un temporizador dentro del servidor no es fiable.

**Estado:** vigente.

## D-09 — Operaciones de Google Cloud sin claves

**Qué se decidió:** gestionar secretos, variables y Cloud Scheduler con un flujo de GitHub Actions que se autentica con Workload Identity Federation.

**Por qué:** no hay que guardar claves JSON de cuentas de servicio ni en GitHub ni en los equipos. Ver [operaciones-gcp.md](operaciones-gcp.md).

**Estado:** vigente.

## D-10 — Despensa compartida sin migración

**Qué se decidió:** los alimentos siguen guardando su despensa en `usuarioId`; un usuario con `hogarId` usa la despensa del hogar y, si no comparte, la de su propio `id`.

**Por qué:** los datos existentes siguen siendo válidos sin migrar documentos.

**Estado:** vigente.

## D-11 — Consulta de productos desde el servidor

**Qué se decidió:** el servidor consulta Open Food Facts, guarda las respuestas en caché (24 horas, 1 hora las no encontradas) y limita a 10 búsquedas por minuto y usuario.

**Por qué:** Open Food Facts limita las consultas por IP y pide un User-Agent identificable.

**Estado:** vigente.

## D-12 — Estructura del repositorio como el proyecto de referencia

**Qué se decidió:** todo el código en `backend/`, el frontend en `backend/frontend/` con `css/` y `js/`, cada prueba junto a su módulo y la documentación en `docs/` ([issue #29](https://github.com/Isra393/despensa-inteligente/issues/29)). Se mantienen los nombres de los módulos y `node:test`.

**Por qué:** separa la aplicación de la documentación y la infraestructura, y facilita encontrar la prueba de cada módulo. Cambiar de framework de pruebas o dividir los módulos habría cambiado el comportamiento y se deja fuera.

**Estado:** vigente. El `Dockerfile` sigue en la raíz para no cambiar el activador de Cloud Build.

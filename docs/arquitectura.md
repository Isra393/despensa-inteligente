---
type: Arquitectura
title: Arquitectura de Despensa Inteligente
description: Capas del backend y del frontend, módulos de backend/, colecciones de MongoDB, frontera entre cliente y servidor y despliegue.
timestamp: 2026-11-25
---

# Arquitectura

La aplicación es un único servicio Node.js. Express sirve la interfaz estática desde [backend/frontend/](../backend/frontend/) y la API bajo `/api`, desde el mismo origen. Toda la lógica de negocio y los permisos se ejecutan en el servidor.

## Backend

Todos los módulos están en [backend/](../backend/), en una sola carpeta, con su archivo de pruebas al lado (`modelo.js` y `modelo.test.js`).

- **Arranque:** [server.js](../backend/server.js) carga `backend/.env`, conecta con MongoDB Atlas, crea el almacén de sesiones, prepara la cuenta de prueba si está habilitada y abre el puerto. Cierra la conexión de forma ordenada con `SIGTERM` y `SIGINT`.
- **Presentación (HTTP):** [app.js](../backend/app.js) monta Express, las sesiones, el registro de actividad, los archivos estáticos de `frontend/` y la ruta `/api/salud`. [api.js](../backend/api.js) define las rutas de usuarios, sesión, alimentos, lista de la compra, preferencias, productos, hogar, recetas, estadísticas y exportación. [accesoGoogle.js](../backend/accesoGoogle.js) añade el acceso con Google y One Tap, y [avisos.js](../backend/avisos.js) la tarea protegida de avisos de caducidad. [sesion.js](../backend/sesion.js) configura express-session y la cookie, y [registroActividad.js](../backend/registroActividad.js) escribe un registro JSON por petición.
- **Lógica de negocio:** [modelo.js](../backend/modelo.js) contiene la clase `Sistema` con las reglas y las comprobaciones de permisos. Se apoya en módulos sin estado: [alimentos.js](../backend/alimentos.js) (validación y estado de caducidad), [listaCompra.js](../backend/listaCompra.js), [recetas.js](../backend/recetas.js) y [recetario.js](../backend/recetario.js) (sugerencias de recetas), [estadisticas.js](../backend/estadisticas.js) (aprovechamiento y CSV) y [confirmacion.js](../backend/confirmacion.js) (tokens de confirmación).
- **Acceso a datos:** [cadMongo.js](../backend/cadMongo.js) implementa la capa de acceso a datos sobre MongoDB y crea los índices al conectar. [cadMemoria.js](../backend/cadMemoria.js) ofrece la misma interfaz en memoria para las pruebas.
- **Servicios externos:** [correo.js](../backend/correo.js) envía los correos con Nodemailer y Gmail, [google.js](../backend/google.js) habla con Google y verifica los tokens de identidad, y [productos.js](../backend/productos.js) consulta Open Food Facts con caché y límite por usuario.
- **Utilidades de operación:** [cuentaPrueba.js](../backend/cuentaPrueba.js) prepara la cuenta de prueba y [ejecutarAvisos.js](../backend/ejecutarAvisos.js) envía los avisos una vez y termina (`npm run avisos`).

`server.js` compone las piezas: crea `CadMongo`, construye `Sistema` con ella y pasa el sistema, el correo, Google y el catálogo de productos a `crearApp`. Las pruebas hacen lo mismo con `CadMemoria` y dobles de correo y Google, por eso no necesitan red ni base de datos.

## Datos

La base `despensa_inteligente` tiene las colecciones `usuarios`, `alimentos`, `listaCompra`, `movimientos` y `sesiones`.

- Cada alimento guarda en `usuarioId` el identificador de su despensa; el índice único `{ usuarioId, id }` acelera las consultas.
- Un usuario solo tiene `hogarId` si comparte la despensa; si no, su despensa es la de su propio `id`.
- `movimientos` guarda lo terminado, tirado o gastado, y alimenta las estadísticas.
- `sesiones` tiene un índice TTL que elimina las sesiones caducadas.

## Frontend

- **Presentación:** [index.html](../backend/frontend/index.html) contiene todas las vistas, y [css/estilos.css](../backend/frontend/css/estilos.css) el estilo visual «Mercado» con sus colores en variables CSS.
- **Comunicación:** [js/clienteRest.js](../backend/frontend/js/clienteRest.js) centraliza las peticiones `fetch` a la API.
- **Control de la página:** [js/controlWeb.js](../backend/frontend/js/controlWeb.js) gestiona el acceso, la sesión y el panel de administración. Cada sección tiene su script: [despensa.js](../backend/frontend/js/despensa.js), [escaner.js](../backend/frontend/js/escaner.js), [listaCompra.js](../backend/frontend/js/listaCompra.js), [recetas.js](../backend/frontend/js/recetas.js), [hogar.js](../backend/frontend/js/hogar.js), [estadisticas.js](../backend/frontend/js/estadisticas.js), [avisos.js](../backend/frontend/js/avisos.js) y [googleOneTap.js](../backend/frontend/js/googleOneTap.js).

La página carga los estilos desde `/css/` y los scripts desde `/js/`. Una prueba de [app.test.js](../backend/app.test.js) comprueba que todos los recursos enlazados en la página se sirven.

## Frontera entre cliente y servidor

El navegador solo llama a rutas relativas bajo `/api`. La cookie de sesión es `httpOnly` y, en producción, `secure`. El servidor obtiene el usuario de la sesión y vuelve a leer su cuenta para comprobar el rol y el estado en cada operación; el cliente nunca decide permisos. Un alimento de otra despensa responde `404`, sin distinguir si existe.

## Despliegue

El [Dockerfile](../Dockerfile) está en la raíz porque el activador de Cloud Build lo busca allí. Instala las dependencias de producción de `backend/package.json` y copia la carpeta `backend/` sin las pruebas ni los `.env` (ver [.dockerignore](../.dockerignore)). Cloud Run ejecuta `npm start`, que arranca `server.js`.

Las operaciones que no forman parte del despliegue (secretos, variables de Cloud Run y Cloud Scheduler) se describen en [operaciones-gcp.md](operaciones-gcp.md).

---
type: Sprint
title: Sprint 2
description: Gestión de alimentos, Google One Tap, mejoras de formularios y pruebas de integración con MongoDB.
timestamp: 2026-11-17
---

# Sprint 2

## Pull requests

| PR | Rama | Contenido |
|---|---|---|
| [#12](https://github.com/Isra393/despensa-inteligente/pull/12) | `sprint2-alimentos-onetap` | Gestión de alimentos, Google One Tap y pruebas de integración |

## Referencia del tutorial

Como referencia se ha utilizado el Sprint 2 del tutorial
«Arquitectura base de una aplicación SaaS» (curso 2023-2024).
La mayor parte de ese sprint ya estaba cubierta por los hitos 2 a 4;
este sprint completa los apartados pendientes y añade la funcionalidad
principal de la aplicación.

| Apartado del tutorial | Implementación en este proyecto |
|---|---|
| 2.1 Estado de la aplicación | Hito 2–3: express-session y connect-mongo |
| 2.2 OAuth con Google | Hito 4: flujo de código con PKCE, `state` y `nonce` |
| 2.3 Capa de acceso a datos | `cadMongo.js` y `cadMemoria.js`; nueva colección `alimentos` |
| 2.4 Google One Tap | **Sprint 2**: `googleOneTap.js` y `/api/auth/google/one-tap` |
| 2.5 Registro e inicio de sesión locales | Hito 2 |
| 2.6 Confirmación de cuenta | Hito 4; **Sprint 2**: correo en HTML |
| 2.7 Cifrado de claves | Hito 2: bcrypt |
| 2.8 y 2.9 Rutas protegidas y salida | Hito 2–3 |
| 2.10 Mejoras de formularios y mensajes | **Sprint 2**: validación en el cliente, confirmación de contraseña y errores de Google comprensibles |
| Pruebas de integración lógica + CAD | **Sprint 2**: `backend/cadMongo.integracion.test.js` |

Gestión de alimentos:

- Cada usuario tiene su propia despensa; nadie puede ver ni modificar
  los alimentos de otro usuario.
- Datos de cada alimento: nombre, cantidad, unidad (`unidades`, `g`,
  `kg`, `ml`, `l`), categoría y fecha de caducidad opcional.
- Estado de caducidad calculado en el servidor con la fecha de España:
  `caducado`, `proximo` (3 días o menos), `vigente` o `sin_fecha`.
- Listado ordenado por caducidad, con resumen de caducados y próximos.
- Alta, edición y eliminación desde la interfaz, con confirmación
  antes de borrar.
- Búsqueda por nombre y filtro de alimentos caducados o próximos.
- Validación en el cliente y de nuevo en el servidor.
- Límite de 500 alimentos por usuario.
- Vista en tarjetas en pantallas estrechas.

Google One Tap:

- El servidor entrega un `nonce` de un solo uso guardado en la sesión.
- El navegador muestra el diálogo de Google y envía el ID token al servidor.
- El servidor verifica la firma, la audiencia, el `nonce` y el correo
  verificado antes de crear la sesión.
- Utiliza las mismas reglas de cuentas que el acceso con Google existente.
- Si Google no está configurado, el diálogo simplemente no aparece.

Otras mejoras:

- Los errores del acceso con Google redirigen a la página inicial
  con un mensaje comprensible en lugar de mostrar JSON.
- El correo de confirmación incluye una versión HTML con botón,
  además de la versión de texto.
- El formulario de registro pide repetir la contraseña.
- `CadMongo` crea los índices de `usuarios` y `alimentos` al conectar
  y conserva los que ya existan con otras opciones.

## Comprobaciones

Realizadas con un navegador automatizado sobre el servidor con
almacenamiento en memoria y Google simulado:

- Alta, edición, filtros, búsqueda y eliminación de alimentos.
- Resumen de caducados y próximos, y resaltado de las filas.
- Conservación de la despensa al recargar y limpieza al cerrar sesión.
- Vista en tarjetas en pantallas estrechas.
- Mensaje comprensible ante un error del acceso con Google.
- Aviso cuando las contraseñas del registro no coinciden.
- Inicio de sesión con One Tap y desactivación de la selección
  automática al cerrar sesión.

Pendiente de comprobar con servicios reales: One Tap con una cuenta
de Google, las pruebas de integración contra Atlas y el despliegue
en Cloud Run.

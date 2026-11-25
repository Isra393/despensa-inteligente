---
type: Sprint
title: Sprint 1
description: Hitos 1 a 4: usuarios, sesiones, persistencia y roles, confirmación por correo y acceso con Google.
timestamp: 2026-11-17
---

# Sprint 1

El primer sprint se organizó en cuatro hitos. Cada hito se desarrolló en una o varias ramas y se integró en `main` mediante pull requests revisados por el CI.

## Pull requests

| PR | Rama | Contenido |
|---|---|---|
| [#1](https://github.com/Isra393/despensa-inteligente/pull/1) | `h1-estructura-inicial` | Estructura inicial y pruebas con CI |
| [#2](https://github.com/Isra393/despensa-inteligente/pull/2) | `h1-despliegue-cloud` | Contenedor para Cloud Run |
| [#3](https://github.com/Isra393/despensa-inteligente/pull/3) | `h1-usuarios-memoria` | Gestión de usuarios en memoria y API con pruebas |
| [#4](https://github.com/Isra393/despensa-inteligente/pull/4) | `h2-registro-sesion` | Registro, inicio de sesión e interfaz con sesiones |
| [#5](https://github.com/Isra393/despensa-inteligente/pull/5) | `h3-persistencia-roles` | Persistencia en MongoDB, permisos y registros |
| [#6](https://github.com/Isra393/despensa-inteligente/pull/6) | `h3-panel-admin` | Panel de consulta de usuarios para el administrador |
| [#7](https://github.com/Isra393/despensa-inteligente/pull/7) | `pruebaTecnicaSprint1` | Prueba técnica: variante 4 de bloqueo por intentos fallidos |
| [#8](https://github.com/Isra393/despensa-inteligente/pull/8) | `h4-confirmacion-correo` | Confirmación de cuentas por correo y reenvío |
| [#9](https://github.com/Isra393/despensa-inteligente/pull/9) | `h4-acceso-google` | Acceso con Google y pruebas |
| [#10](https://github.com/Isra393/despensa-inteligente/pull/10) | `h4-acceso-google` | Documentación del Sprint 1 |
| [#11](https://github.com/Isra393/despensa-inteligente/pull/11) | `h4-acceso-google` | Acceso permanente de red en Atlas |

## Hito 1: gestión de usuarios

- Separación entre API, lógica de negocio y acceso a datos.
- Creación y consulta de usuarios.
- Estados `pendiente`, `activo` y `eliminado`.
- Eliminación lógica de cuentas.

## Hito 2: autenticación y sesiones

- Interfaz de registro e inicio de sesión.
- Contraseñas almacenadas mediante hash bcrypt.
- Registro de cuentas pendientes de confirmación.
- Inicio de sesión para cuentas activas.
- Consulta y cierre de sesión.
- Protección de rutas que requieren autenticación.

## Hito 3: persistencia, permisos y registros

- Usuarios almacenados en MongoDB Atlas.
- Sesiones persistentes mediante connect-mongo.
- Índice único sobre el email para impedir duplicados.
- Índice TTL para eliminar sesiones caducadas.
- Roles `usuario` y `administrador`.
- Permisos comprobados consultando la cuenta almacenada.
- Listado y consulta de cuentas reservados al administrador.
- Eliminación de la propia cuenta o de otras cuentas por un administrador.
- Panel gráfico exclusivo para administradores con email, rol y estado.
- Actualización del listado y mensajes de carga, lista vacía y errores.
- Limpieza del panel al cerrar sesión.
- Registros JSON de operaciones, estados HTTP y duración.
- Despliegue en Cloud Run conectado a Atlas.

## Hito 4: confirmación por correo y acceso con Google

- Envío de un enlace de confirmación al registrar una cuenta con contraseña.
- Tokens aleatorios de confirmación con caducidad de 24 horas.
- Almacenamiento del resumen SHA-256 del token.
- Confirmación de cuentas pendientes mediante un token de un solo uso.
- Reenvío de confirmación con un intervalo mínimo de un minuto.
- Cada nuevo enlace sustituye al anterior.
- Respuesta genérica al solicitar el reenvío para cuentas no elegibles.
- Si falla el envío inicial, la cuenta permanece pendiente y puede solicitarse el reenvío.
- Acceso con Google mediante el flujo de código de autorización.
- Verificación del token de identidad y del correo verificado.
- Comprobación de `state`, `nonce` y uso de PKCE.
- Intentos de acceso con Google con caducidad de diez minutos.
- Creación de cuentas de Google activas y con rol `usuario`.
- Identificación de cuentas de Google mediante `googleSub`.
- Índice único parcial sobre `googleSub`.
- Rechazo del acceso a cuentas eliminadas.
- Conservación del rol almacenado de las cuentas existentes.
- Regeneración de la sesión tras completar el acceso.

Las cuentas existentes no se vinculan automáticamente con Google
por coincidencia de email. Si el correo ya está registrado mediante
otro método, debe utilizarse su método de acceso original.

Las cuentas creadas mediante Google no reciben una contraseña local.

## Validaciones manuales

- Conexión local a MongoDB Atlas.
- Sesión conservada tras reiniciar el servidor local.
- Acceso a una cuenta persistida con `ENABLE_TEST_ACCOUNT=false`.
- Listado de usuarios por administrador en local y en Cloud Run.
- Rechazo de operaciones administrativas para usuarios sin permisos.
- Respuestas de listado sin `passwordHash`.
- Registro estructurado de una respuesta 403 con nivel `WARNING`.
- Envío SMTP comprobado en local.
- Registro, recepción del correo, confirmación e inicio de sesión en producción.
- Rechazo de un enlace de confirmación ya utilizado en producción.
- Reenvío de confirmación y sustitución del enlace anterior en local.
- Acceso real con Google en local y en Cloud Run.
- Conservación de la sesión al recargar tras acceder con Google.
- Cierre de sesión y nuevo acceso con Google.
- Compilación y despliegue de las ampliaciones mediante Cloud Build.

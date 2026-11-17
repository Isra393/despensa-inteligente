# Despensa Inteligente

Proyecto de Israel Amador Rodelgo para la asignatura Procesos de Ingeniería Software.

Aplicación:
[Despensa Inteligente](https://despensa-inteligente-599179699590.europe-west1.run.app)

## Tecnologías y arquitectura

La aplicación utiliza JavaScript, Node.js 24 y Express en el servidor,
y HTML, CSS y JavaScript en el cliente.

Se organiza en capas y componentes:

- `cliente/`: interfaz y consultas a la API mediante fetch.
  - `controlWeb.js`: control de la página, acceso y panel de administración.
  - `clienteRest.js`: peticiones a la API.
  - `despensa.js`: listado, alta, edición, filtros y borrado de alimentos.
  - `googleOneTap.js`: diálogo de acceso con Google One Tap.
- `servidor/api.js`: rutas HTTP de usuarios, autenticación y confirmación.
- `servidor/accesoGoogle.js`: rutas de inicio y retorno del acceso con Google.
- `servidor/google.js`: comunicación con Google y verificación de identidad.
- `servidor/modelo.js`: reglas de negocio y comprobación de permisos.
- `servidor/alimentos.js`: validación de alimentos y cálculo de caducidad.
- `servidor/cadMongo.js`: almacenamiento de usuarios y alimentos en MongoDB Atlas.
- `servidor/cadMemoria.js`: almacenamiento en memoria utilizado en las pruebas.
- `servidor/confirmacion.js`: generación y resumen de tokens de confirmación.
- `servidor/correo.js`: envío de correos mediante Nodemailer y Gmail.
- `servidor/sesion.js`: configuración de las sesiones y cookies.
- `servidor/app.js`: configuración de Express y middleware.
- `servidor/registroActividad.js`: registros estructurados de peticiones.
- `index.js`: conexión a MongoDB y arranque del servidor.

Express sirve el frontend y la API desde el mismo origen.
La lógica de negocio y los permisos se ejecutan en el servidor.

bcrypt genera los hashes de las contraseñas.
express-session gestiona las sesiones y connect-mongo las almacena
en MongoDB. google-auth-library verifica los tokens de identidad de Google.

## Ejecución local

Requisitos:

- Node.js 24 y npm.
- Acceso a una base de datos MongoDB Atlas.
- Una cuenta Gmail con contraseña de aplicación para enviar correos.
- Credenciales OAuth de aplicación web para habilitar el acceso con Google.

Instalar las dependencias:

```powershell
npm.cmd ci
```

Si no existe un archivo `.env`, crearlo a partir del ejemplo:

```powershell
Copy-Item .env.example .env
```

Si ya existe un `.env` configurado, conservarlo.

Generar una clave de sesión:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Completar la configuración local:

```dotenv
PORT=3000
NODE_ENV=development
SESSION_SECRET=REEMPLAZAR_POR_CLAVE_ALEATORIA
MONGODB_URI=REEMPLAZAR_POR_CADENA_DE_CONEXION
MONGODB_DB=despensa_inteligente
ENABLE_TEST_ACCOUNT=false

APP_URL=http://localhost:3000
SMTP_USER=REEMPLAZAR_POR_CORREO_GMAIL
SMTP_PASSWORD=REEMPLAZAR_POR_CONTRASENA_DE_APLICACION

GOOGLE_CLIENT_ID=REEMPLAZAR_POR_ID_DE_CLIENTE
GOOGLE_CLIENT_SECRET=REEMPLAZAR_POR_SECRETO_DE_CLIENTE
```

Los valores anteriores son marcadores y deben sustituirse por los reales.

La cadena de MongoDB debe incluir las credenciales del usuario de base
de datos. Los caracteres especiales de la contraseña deben codificarse
para una URL.

La IP del equipo debe estar autorizada en la lista de acceso de Atlas.
El usuario de conexión necesita el rol `readWrite` sobre
`despensa_inteligente`.

Para el correo se utiliza una contraseña de aplicación de Google,
no la contraseña habitual de Gmail.

El cliente OAuth debe ser de tipo aplicación web y tener autorizada
esta URI de redireccionamiento local:

```text
http://localhost:3000/api/auth/google/callback
```

Para el diálogo Google One Tap, el mismo cliente OAuth debe tener
estos **orígenes autorizados de JavaScript**:

```text
http://localhost:3000
http://localhost
```

`GOOGLE_CLIENT_ID` es el identificador que termina en
`.apps.googleusercontent.com`. Es diferente de `GOOGLE_CLIENT_SECRET`.

Para ejecutar sin acceso con Google, dejar ambas variables de Google
vacías. Las rutas de Google devolverán 503 mientras no esté configurado.

Arrancar:

```powershell
npm.cmd start
```

Abrir [http://localhost:3000](http://localhost:3000).

Reiniciar el servidor después de modificar las variables de entorno.

En otros terminales puede utilizarse `npm` en lugar de `npm.cmd`.

## Variables de entorno

| Variable | Finalidad |
|---|---|
| `PORT` | Puerto HTTP. Cloud Run lo proporciona automáticamente. |
| `NODE_ENV` | `development` en local y `production` en Cloud Run. |
| `SESSION_SECRET` | Clave aleatoria de al menos 32 caracteres para firmar la cookie de sesión. |
| `MONGODB_URI` | Cadena de conexión privada a MongoDB Atlas. |
| `MONGODB_DB` | Nombre de la base de datos: `despensa_inteligente`. |
| `ENABLE_TEST_ACCOUNT` | `true` para preparar una cuenta activa de prueba; `false` para deshabilitar su preparación. |
| `TEST_ACCOUNT_EMAIL` | Correo de la cuenta de prueba, si se habilita. |
| `TEST_ACCOUNT_PASSWORD` | Contraseña de la cuenta de prueba, si se habilita. |
| `APP_URL` | URL base de la aplicación. Se utiliza para los enlaces de confirmación y el retorno de Google. |
| `SMTP_USER` | Cuenta Gmail que envía los correos. |
| `SMTP_PASSWORD` | Contraseña de aplicación de la cuenta Gmail. |
| `GOOGLE_CLIENT_ID` | Identificador del cliente OAuth de Google. |
| `GOOGLE_CLIENT_SECRET` | Secreto del cliente OAuth de Google. |
| `TAREAS_TOKEN` | Opcional. Token secreto (32 caracteres o más) de las tareas programadas, como los avisos de caducidad. |
| `MONGODB_URI_TEST` | Opcional. Cadena de conexión para las pruebas de integración. |
| `MONGODB_DB_TEST` | Opcional. Base de las pruebas de integración (por defecto `despensa_inteligente_test`). |

`.env` contiene configuración privada y no se sube al repositorio.
`.env.example` documenta las variables sin credenciales reales.

En producción, `APP_URL` debe utilizar HTTPS.

En Cloud Run se utiliza `ENABLE_TEST_ACCOUNT=false`.
Deshabilitar la preparación no elimina una cuenta que ya esté guardada.

## Funcionalidades desarrolladas

### Hito 1: gestión de usuarios

- Separación entre API, lógica de negocio y acceso a datos.
- Creación y consulta de usuarios.
- Estados `pendiente`, `activo` y `eliminado`.
- Eliminación lógica de cuentas.

### Hito 2: autenticación y sesiones

- Interfaz de registro e inicio de sesión.
- Contraseñas almacenadas mediante hash bcrypt.
- Registro de cuentas pendientes de confirmación.
- Inicio de sesión para cuentas activas.
- Consulta y cierre de sesión.
- Protección de rutas que requieren autenticación.

### Hito 3: persistencia, permisos y registros

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

### Hito 4: confirmación por correo y acceso con Google

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

### Sprint 2: gestión de alimentos, Google One Tap y mejoras

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
| Pruebas de integración lógica + CAD | **Sprint 2**: `test/integracion/cadMongo.test.js` |

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

### Sprint 3: estilo visual «Mercado»

Nueva identidad visual para dar un aspecto más profesional:

- Tipografías Bricolage Grotesque (títulos) e Inter (texto),
  cargadas desde Google Fonts.
- Paleta azul marino (`#1b2a41`) con naranja tomate (`#c2410c`)
  sobre fondo cálido; los colores están en variables CSS en
  `cliente/estilos.css`.
- Portada con titular, formularios de acceso y ventajas.
- Panel con tarjetas de resumen (caducados, caducan pronto,
  sin prisa y total), lista con punto de color y pastilla de estado,
  y formulario de alta en un panel lateral.
- Barra superior con la cuenta y pie de página.
- En el móvil, el formulario de alta aparece antes de la lista
  y cada alimento se muestra como una tarjeta.
- Contrastes de texto AA, foco visible y enlace para saltar
  al contenido.

### Sprint 3: avisos de caducidad por correo

- Cada usuario decide en su panel si quiere avisos y con cuántos
  días de antelación (1 a 7; por defecto, desactivados y 3 días).
- El aviso incluye los alimentos caducados y los que caducan dentro
  de esa antelación. Los alimentos sin fecha no se incluyen.
- Si no hay nada que avisar, no se envía correo.
- Cada usuario recibe como máximo un aviso al día, según la fecha
  de España. Si el envío falla, sigue pendiente para el siguiente intento.
- Las cuentas pendientes o eliminadas nunca reciben avisos.
- El correo tiene versión de texto y versión HTML con el estilo
  de la aplicación.

El envío lo inicia un planificador externo, porque Cloud Run
detiene las instancias sin tráfico. Hay dos formas:

1. Ruta HTTP protegida: `POST /api/tareas/avisos-caducidad` con la
   cabecera `Authorization: Bearer <TAREAS_TOKEN>`.
2. Script: `npm run avisos`, que se conecta a MongoDB, envía los avisos
   y termina (sirve para pruebas locales o para un Cloud Run Job).

Sin `TAREAS_TOKEN` (o con menos de 32 caracteres), la ruta devuelve 503.

### Sprint 3: lista de la compra automática

- Cada alimento puede tener un **mínimo** opcional (`stockMinimo`).
  Cuando su cantidad baja a ese valor o menos, aparece en la lista
  de la compra y en la tabla se marca con «Reponer».
- Al actualizar la cantidad del alimento por encima del mínimo,
  sale de la lista automáticamente.
- Además se pueden añadir productos a mano, con una cantidad opcional
  en texto libre («1 kg», «un paquete»), marcarlos como comprados,
  quitarlos uno a uno o quitar todos los comprados.
- Cada usuario solo ve y modifica su propia lista
  (máximo 200 productos añadidos a mano).

## Persistencia

Los usuarios, los alimentos, la lista de la compra y las sesiones se
almacenan en las colecciones `usuarios`, `alimentos`, `listaCompra`
y `sesiones` de la base `despensa_inteligente`.

Cada alimento guarda el `id` de su propietario en `usuarioId`.
El índice único `{ usuarioId, id }` acelera las consultas por usuario.

La persistencia permite conservar los datos tras reiniciar el servidor
y compartirlos entre instancias.

Para conservar una sesión también deben mantenerse su cookie,
su vigencia y el mismo `SESSION_SECRET`.

Cambiar `SESSION_SECRET` invalida las cookies firmadas con la clave anterior.

## API

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/salud` | Público |
| POST | `/api/registro` | Público |
| POST | `/api/confirmar-cuenta` | Público; requiere token válido |
| POST | `/api/reenviar-confirmacion` | Público |
| POST | `/api/login` | Público |
| GET | `/api/auth/google` | Público; inicia el acceso con Google |
| GET | `/api/auth/google/callback` | Público; valida el retorno de Google |
| GET | `/api/auth/google/one-tap` | Público; prepara Google One Tap |
| POST | `/api/auth/google/one-tap` | Público; verifica el ID token de One Tap |
| POST | `/api/logout` | Cierre de sesión |
| GET | `/api/sesion` | Usuario autenticado |
| GET | `/api/usuarios` | Administrador |
| GET | `/api/usuarios/:email/activo` | Administrador |
| DELETE | `/api/usuarios/:email` | Administrador o propietario de la cuenta |
| GET | `/api/lista-compra` | Usuario autenticado; solo su lista |
| POST | `/api/lista-compra` | Usuario autenticado |
| PATCH | `/api/lista-compra/:id` | Propietario del elemento |
| DELETE | `/api/lista-compra/:id` | Propietario del elemento |
| DELETE | `/api/lista-compra/comprados` | Usuario autenticado |
| GET | `/api/preferencias/avisos` | Usuario autenticado |
| PUT | `/api/preferencias/avisos` | Usuario autenticado |
| POST | `/api/tareas/avisos-caducidad` | Planificador con `TAREAS_TOKEN` |
| GET | `/api/alimentos` | Usuario autenticado; solo sus alimentos |
| POST | `/api/alimentos` | Usuario autenticado |
| PUT | `/api/alimentos/:id` | Propietario del alimento |
| DELETE | `/api/alimentos/:id` | Propietario del alimento |
| POST | `/api/prueba/bloqueo` | Público; ejercicio técnico de cálculo de bloqueo |

### Registro y confirmación

`POST /api/registro` recibe:

```json
{
  "email": "usuario@example.com",
  "password": "UnaContrasenaDeEjemplo123!"
}
```

Crea una cuenta con rol `usuario` y estado `pendiente`.
La respuesta indica si se ha podido enviar el correo.

`POST /api/confirmar-cuenta` recibe:

```json
{
  "token": "TOKEN_RECIBIDO_EN_EL_ENLACE"
}
```

Un token válido activa la cuenta y queda consumido.
Los tokens inválidos, caducados o ya utilizados se rechazan.

`POST /api/reenviar-confirmacion` recibe:

```json
{
  "email": "usuario@example.com"
}
```

El servidor intenta enviar un nuevo enlace si la cuenta está pendiente
y ha transcurrido el intervalo mínimo entre solicitudes.

### Acceso con Google

El navegador inicia el flujo visitando `/api/auth/google`.
Google devuelve al usuario a `/api/auth/google/callback`.

El servidor valida la respuesta antes de crear una sesión y redirige
a la página inicial cuando el acceso termina correctamente.

Si el acceso falla, el servidor redirige a `/#error-google=<código>`
y la página muestra un mensaje. Los códigos son `cancelado`,
`no_disponible`, `cuenta_existente`, `cuenta_no_permitida` y `fallo`.
No se envían detalles internos al navegador.

### Google One Tap

`GET /api/auth/google/one-tap` devuelve `{ disponible: false }` si
Google no está configurado. En caso contrario devuelve:

```json
{
  "disponible": true,
  "clientId": "ID_DE_CLIENTE.apps.googleusercontent.com",
  "nonce": "VALOR_DE_UN_SOLO_USO"
}
```

`POST /api/auth/google/one-tap` recibe `{ "credential": "ID_TOKEN" }`.
El `nonce` se consume en el primer intento, tanto si es correcto como si no.

### Alimentos

`POST /api/alimentos` y `PUT /api/alimentos/:id` reciben:

```json
{
  "nombre": "Leche entera",
  "cantidad": 2,
  "unidad": "l",
  "categoria": "lácteos y huevos",
  "fechaCaducidad": "2026-12-01"
}
```

`unidad`, `categoria` y `fechaCaducidad` son opcionales
(por defecto `unidades`, `otros` y sin fecha).

Categorías: `fruta y verdura`, `carne y pescado`, `lácteos y huevos`,
`panadería`, `despensa seca`, `congelados`, `bebidas` y `otros`.

`GET /api/alimentos` devuelve los alimentos y un resumen:

```json
{
  "alimentos": [
    {
      "id": "…",
      "nombre": "Leche entera",
      "cantidad": 2,
      "unidad": "l",
      "categoria": "lácteos y huevos",
      "fechaCaducidad": "2026-12-01",
      "estadoCaducidad": "vigente",
      "diasRestantes": 14,
      "creadoEn": "…",
      "actualizadoEn": "…"
    }
  ],
  "resumen": { "total": 1, "caducados": 0, "proximos": 0 }
}
```

Un alimento inexistente o de otro usuario devuelve 404.

Los alimentos admiten además `"stockMinimo"` (número o `null`) y la
respuesta incluye `"bajoMinimo"`.

### Lista de la compra

`GET /api/lista-compra` devuelve:

```json
{
  "automaticos": [
    { "alimentoId": "…", "nombre": "Leche", "cantidad": 0, "unidad": "l", "stockMinimo": 1 }
  ],
  "manuales": [
    { "id": "…", "nombre": "Pan", "cantidad": null, "comprado": false, "creadoEn": "…" }
  ]
}
```

`POST /api/lista-compra` recibe `{ "nombre": "Pan", "cantidad": "2" }`
y `PATCH /api/lista-compra/:id` recibe `{ "comprado": true }`.

### Avisos de caducidad

`PUT /api/preferencias/avisos` recibe:

```json
{ "activo": true, "diasAntelacion": 3 }
```

`POST /api/tareas/avisos-caducidad` devuelve un recuento:

```json
{ "pendientes": 2, "enviados": 2, "fallidos": 0 }
```

### Cálculo de bloqueo

`POST /api/prueba/bloqueo` recibe un array `fallos` con fechas
y una fecha `ahora`.

Esta ruta calcula un resultado para el ejercicio técnico.
No registra automáticamente los fallos de inicio de sesión
ni aplica un bloqueo al login real.

### Datos públicos y administración

Los datos públicos del usuario incluyen `id`, `email`, `rol` y `estado`.
No incluyen contraseñas, hashes ni tokens de confirmación.

La cuenta administrativa de prueba se preparó manualmente en Atlas.
No existe un formulario público para asignar el rol de administrador.
Su contraseña no se incluye en el repositorio.

## Pruebas automatizadas

Ejecutar:

```powershell
npm.cmd test
```

En la última validación se aprobaron 105 pruebas automatizadas
(71 anteriores y 34 del Sprint 2).

Cubren lógica de negocio, autenticación, sesiones, API, entrega del
frontend, permisos, confirmación, reenvío, acceso con Google,
Google One Tap, correo de confirmación, gestión de alimentos
y el ejercicio técnico de bloqueo.

Las pruebas de alimentos comprueban, entre otros casos:

- Validación de nombre, cantidad, unidad, categoría y fecha.
- Cálculo de la caducidad con la fecha de España.
- Orden por caducidad y resumen de caducados y próximos.
- Aislamiento entre usuarios: otro usuario recibe 404.
- Acceso denegado sin sesión o tras cerrarla.

Las pruebas de One Tap comprueban la audiencia y el `nonce` del token,
el rechazo de correos no verificados, firmas no válidas e intentos
caducados, y que el `nonce` no se pueda reutilizar.

### Pruebas de integración con MongoDB

`test/integracion/cadMongo.test.js` prueba la capa lógica junto con
`CadMongo` sobre una base real: índices, registro, confirmación,
inicio de sesión, reenvío, acceso con Google y alimentos.

Se omiten si no se define `MONGODB_URI_TEST`. Para ejecutarlas:

```powershell
npm.cmd run test:integracion
```

Utilizan la base `MONGODB_DB_TEST` (por defecto
`despensa_inteligente_test`) y vacían sus colecciones antes y después.
Se niegan a ejecutarse sobre la base de `MONGODB_DB`.
El usuario de Atlas necesita el rol `readWrite` sobre la base de pruebas.

Las pruebas de Google comprueban, entre otros casos:

- Creación de cuentas activas con rol usuario.
- Rechazo de correos no verificados e identidades sin identificador.
- Conservación de la identidad y del rol de una cuenta existente.
- Rechazo de cuentas eliminadas.
- Ausencia de vinculación automática por coincidencia de email.
- Inicio del flujo mediante redirección.
- Creación y cierre de sesión.
- Rechazo de retornos sin intento previo.
- Rechazo de un estado incorrecto en el componente simulado.
- Consumo del intento cuando el acceso se cancela.
- Redirección con aviso cuando Google no está configurado.

Las pruebas HTTP de Google utilizan un componente simulado:
no contactan con Google ni requieren credenciales reales.
No constituyen una comprobación criptográfica de tokens reales.

Las pruebas de negocio y HTTP utilizan almacenamiento en memoria
y no modifican Atlas.

GitHub Actions ejecuta las pruebas en los pull requests hacia `main`
y en los cambios integrados en `main`.

## Validaciones manuales realizadas

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

### Comprobaciones del Sprint 2

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

## Registros de actividad

Las peticiones a `/api` generan registros JSON con:

- Identificador de solicitud.
- Fecha.
- Método HTTP.
- Operación.
- Estado HTTP.
- Duración en milisegundos.
- Nivel `INFO`, `WARNING` o `ERROR` según el estado.

El middleware de actividad no incluye cuerpos de petición,
contraseñas, cookies, cadenas de conexión, emails de las rutas
ni parámetros de consulta del retorno de Google.

Esta descripción corresponde a los registros generados por la aplicación.
Los registros de solicitudes de la infraestructura se gestionan por separado.

Se consultan en Cloud Run, en **Observabilidad → Registros**.
Cloud Logging reconoce `severity` como nivel del registro.

## Despliegue

Cloud Build está conectado al repositorio de GitHub.
Los cambios integrados en `main` construyen la imagen mediante
el Dockerfile y se despliegan en Cloud Run.

- Servicio: `despensa-inteligente`.
- Región: `europe-west1`.
- Rama del activador de despliegue: `main`.

### Configuración de producción

- `NODE_ENV=production`.
- `ENABLE_TEST_ACCOUNT=false`.
- `MONGODB_DB=despensa_inteligente`.
- `SESSION_SECRET` configurado de forma privada.
- `APP_URL=https://despensa-inteligente-599179699590.europe-west1.run.app`.
- `SMTP_USER` configurado con la cuenta de envío.
- `GOOGLE_CLIENT_ID` configurado con el identificador OAuth.

Las credenciales privadas se referencian desde Secret Manager:

| Variable | Secreto |
|---|---|
| `MONGODB_URI` | `mongodb-uri` |
| `SMTP_PASSWORD` | `smtp-password` |
| `GOOGLE_CLIENT_SECRET` | `google-client-secret` |
| `TAREAS_TOKEN` | `tareas-token` |

Cloud Run debe referenciar la versión correspondiente de cada secreto.

### Programación de los avisos de caducidad

Crear el secreto y un trabajo de Cloud Scheduler que llame cada día
a las 8:00 (hora de España) a la ruta de avisos:

```powershell
# Generar el token y guardarlo en Secret Manager
$token = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
$token | gcloud secrets create tareas-token --data-file=-

# Tras añadir TAREAS_TOKEN al servicio de Cloud Run:
gcloud scheduler jobs create http avisos-caducidad `
  --location=europe-west1 `
  --schedule="0 8 * * *" `
  --time-zone="Europe/Madrid" `
  --http-method=POST `
  --uri="https://despensa-inteligente-599179699590.europe-west1.run.app/api/tareas/avisos-caducidad" `
  --headers="Authorization=Bearer $token"
```

Su cuenta de servicio necesita el rol
**Secret Manager Secret Accessor** sobre esos secretos.

El usuario de conexión de Atlas tiene `readWrite` sobre
`despensa_inteligente`.

### Configuración de Google

El cliente OAuth tiene autorizadas las siguientes URI de redireccionamiento:

```text
http://localhost:3000/api/auth/google/callback
```

```text
https://despensa-inteligente-599179699590.europe-west1.run.app/api/auth/google/callback
```

Para Google One Tap también deben estar autorizados los orígenes
de JavaScript `http://localhost:3000`, `http://localhost` y
`https://despensa-inteligente-599179699590.europe-west1.run.app`.

Las credenciales configuradas deben pertenecer al mismo cliente OAuth.

## Limitaciones y tareas pendientes

- La cuenta administrativa se prepara manualmente.
- No se ha implementado la vinculación de una cuenta local con Google.
- No se ha implementado la recuperación de contraseñas.
- El intervalo de reenvío se aplica por cuenta; no es un límite global
  de peticiones ni sustituye otras medidas contra el abuso.
- Las pruebas automatizadas no realizan llamadas a los proveedores
  de correo o Google. Las de MongoDB real solo se ejecutan si se
  configura `MONGODB_URI_TEST`.
- El estado de caducidad de los alimentos se calcula con la zona
  horaria de España.
- Con Google configurado, cada visita sin sesión crea una sesión
  temporal para guardar el `nonce` de One Tap. Caduca con el resto
  de sesiones.
- El acceso de red de Atlas utilizado para Cloud Run se ha habilitado
  mediante una entrada temporal `0.0.0.0/0`.
- Debe resolverse la configuración de red de Atlas antes de que
  caduque esa entrada para evitar una nueva pérdida de acceso.

- El acceso de red de Atlas para Cloud Run utiliza una entrada
  permanente `0.0.0.0/0`, sin caducidad.
- Esta configuración permite conexiones desde cualquier IPv4,
  aunque exige credenciales de MongoDB. Queda pendiente restringir
  el acceso de red en una futura mejora.
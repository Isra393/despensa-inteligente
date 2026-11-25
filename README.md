# Despensa Inteligente

Aplicación web para gestionar la despensa de casa: qué alimentos hay, dónde se guardan y cuándo caducan. Avisa por correo de lo que va a caducar, prepara la lista de la compra con lo que se acaba, propone recetas con lo que caduca antes, permite compartir la despensa con las personas con las que vives y muestra cuánto se aprovecha y cuánto se tira.

Proyecto de Israel Amador Rodelgo para la asignatura Procesos de Ingeniería Software.

Aplicación: [Despensa Inteligente](https://despensa-inteligente-599179699590.europe-west1.run.app)

La documentación del proyecto (arquitectura, requisitos, decisiones, procesos, cronología y un documento por sprint) está en [docs/index.md](docs/index.md).

## Tecnologías elegidas (justificación)

- **Backend (Node.js 24 y Express 5):** un único lenguaje, JavaScript, en el servidor y en el cliente, y una API REST ligera. Express sirve también el frontend, de modo que la API y la interfaz comparten origen y la sesión viaja en una cookie sin configurar CORS.
- **Frontend (HTML, CSS y JavaScript sin framework):** la interfaz no necesita compilación y se separa en presentación (`index.html`, `css/`) y comunicación con la API (`js/clienteRest.js`).
- **Base de datos (MongoDB Atlas):** los alimentos, la lista de la compra y el historial son documentos con campos opcionales que han ido creciendo sprint a sprint sin migraciones. Atlas ofrece un nivel gratuito gestionado.
- **Sesiones (express-session y connect-mongo):** las sesiones se guardan en MongoDB, así que sobreviven a los reinicios y se comparten entre las instancias de Cloud Run.
- **Seguridad (bcrypt y google-auth-library):** bcrypt guarda las contraseñas como hash; google-auth-library verifica los tokens del acceso con Google y de One Tap.
- **Correo (Nodemailer con Gmail):** confirmación de cuentas y avisos de caducidad con una contraseña de aplicación.
- **Datos de productos (Open Food Facts):** base abierta y gratuita para rellenar los productos a partir del código de barras.
- **Pruebas (`node:test` y supertest):** el ejecutor de pruebas de Node.js no necesita dependencias adicionales; supertest prueba la API sin abrir un puerto. Las pruebas usan almacenamiento en memoria (`cadMemoria.js`) y no tocan Atlas.
- **CI/CD (GitHub Actions, Cloud Build y Cloud Run):** GitHub Actions ejecuta las pruebas en cada pull request; Cloud Build construye la imagen y la despliega en Cloud Run al integrar en `main`. Las operaciones de Google Cloud se lanzan con GitHub Actions y Workload Identity Federation, sin claves.

## Estructura del repositorio

```text
.
├── backend/                  Aplicación (servidor, frontend y pruebas)
│   ├── server.js             Conexión a MongoDB y arranque del servidor
│   ├── app.js                Configuración de Express y middleware
│   ├── api.js                Rutas HTTP de la API
│   ├── modelo.js             Reglas de negocio y permisos (Sistema)
│   ├── cadMongo.js           Acceso a datos en MongoDB Atlas
│   ├── cadMemoria.js         Acceso a datos en memoria (pruebas)
│   ├── *.js                  Resto de módulos del servidor
│   ├── *.test.js             Pruebas, junto al módulo que prueban
│   ├── frontend/
│   │   ├── index.html
│   │   ├── css/estilos.css
│   │   └── js/               Control de la página y cliente de la API
│   ├── package.json
│   └── .env.example
├── docs/                     Documentación del proyecto
├── infra/                    Script de configuración de Google Cloud
├── .github/workflows/        CI y operaciones de Google Cloud
└── Dockerfile                Imagen de Cloud Run (copia backend/)
```

La descripción de cada módulo está en [docs/arquitectura.md](docs/arquitectura.md).

## Instrucciones de ejecución

Requisitos:

- Node.js 24 y npm.
- Acceso a una base de datos MongoDB Atlas.
- Una cuenta Gmail con contraseña de aplicación para enviar correos.
- Credenciales OAuth de aplicación web para habilitar el acceso con Google.

Instalar las dependencias desde la carpeta `backend`:

```powershell
cd backend
npm.cmd ci
```

Si no existe `backend/.env`, crearlo a partir del ejemplo (desde `backend`):

```powershell
Copy-Item .env.example .env
```

Si ya tenías un `.env` en la raíz del repositorio de una versión anterior,
muévelo a `backend/.env`: el servidor lo busca junto a `server.js`.

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

Arrancar (desde `backend`):

```powershell
npm.cmd start
```

Abrir [http://localhost:3000](http://localhost:3000).

Reiniciar el servidor después de modificar las variables de entorno.

En otros terminales puede utilizarse `npm` en lugar de `npm.cmd`.

### Variables de entorno

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
| `OFF_USER_AGENT` | Opcional. User-Agent para Open Food Facts, idealmente con un correo de contacto: `DespensaInteligente/1.0 (correo@ejemplo.com)`. |
| `MONGODB_URI_TEST` | Opcional. Cadena de conexión para las pruebas de integración. |
| `MONGODB_DB_TEST` | Opcional. Base de las pruebas de integración (por defecto `despensa_inteligente_test`). |

`backend/.env` contiene configuración privada y no se sube al repositorio.
`backend/.env.example` documenta las variables sin credenciales reales.

En producción, `APP_URL` debe utilizar HTTPS.

En Cloud Run se utiliza `ENABLE_TEST_ACCOUNT=false`.
Deshabilitar la preparación no elimina una cuenta que ya esté guardada.

## Persistencia

Los usuarios, los alimentos, la lista de la compra, el historial y las
sesiones se almacenan en las colecciones `usuarios`, `alimentos`,
`listaCompra`, `movimientos` y `sesiones` de la base `despensa_inteligente`.

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
| PATCH | `/api/alimentos/:id/cantidad` | Propietario del alimento |
| GET | `/api/productos/:codigo` | Usuario autenticado (10 por minuto) |
| GET | `/api/hogar` | Usuario autenticado |
| POST | `/api/hogar/invitacion` | Usuario autenticado |
| POST | `/api/hogar/unirse` | Usuario autenticado (5 intentos cada 10 min) |
| POST | `/api/hogar/salir` | Miembro de un hogar compartido |
| DELETE | `/api/hogar/miembros/:email` | Miembro del mismo hogar |
| GET | `/api/estadisticas?meses=6` | Usuario autenticado (1 a 12 meses) |
| GET | `/api/exportar/despensa.csv` | Usuario autenticado |
| GET | `/api/exportar/historial.csv` | Usuario autenticado |
| GET | `/api/recetas` | Usuario autenticado |
| POST | `/api/recetas/:id/lista-compra` | Usuario autenticado |
| DELETE | `/api/alimentos/:id?motivo=terminado` | Propietario del alimento; motivo `terminado`, `tirado` o `error` (por defecto) |
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

`unidad`, `categoria`, `ubicacion` y `fechaCaducidad` son opcionales
(por defecto `unidades`, `otros`, `despensa` y sin fecha).

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
      "ubicacion": "nevera",
      "fechaCaducidad": "2026-12-01",
      "estadoCaducidad": "vigente",
      "diasRestantes": 14,
      "creadoEn": "…",
      "actualizadoEn": "…"
    }
  ],
  "resumen": {
    "total": 1,
    "caducados": 0,
    "proximos": 0,
    "porUbicacion": { "nevera": 1, "congelador": 0, "despensa": 0 }
  }
}
```

Un alimento inexistente o de otro usuario devuelve 404.

`PATCH /api/alimentos/:id/cantidad` recibe `{ "delta": -1 }` (negativo
resta, positivo suma) y devuelve el alimento y la cantidad que se ha
restado de verdad (`consumido`). Si ya no queda nada, devuelve 409.
Cada alimento incluye `paso`, la cantidad que mueven los botones,
y admite un `codigoBarras` opcional (8, 12, 13 o 14 cifras válidas).

`GET /api/productos/:codigo` devuelve:

```json
{
  "producto": {
    "codigo": "8410188012153",
    "nombre": "Leche semidesnatada",
    "marca": "Marca Blanca",
    "categoria": "lácteos y huevos",
    "ubicacion": "nevera",
    "cantidad": 1,
    "unidad": "l"
  },
  "enDespensa": null
}
```

`enDespensa` contiene el alimento con ese código si ya existe.
Responde 400 si el código no es válido, 404 si no se conoce, 429 al
superar el límite por usuario y 503 si Open Food Facts no responde.

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

Ejecutar desde `backend`:

```powershell
cd backend
npm.cmd test
```

En la última validación se aprobaron 178 pruebas automatizadas.
Cada archivo de pruebas está junto al módulo que prueba
(por ejemplo, `backend/modelo.test.js` prueba `backend/modelo.js`).

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

`backend/cadMongo.integracion.test.js` prueba la capa lógica junto con
`CadMongo` sobre una base real: índices, registro, confirmación,
inicio de sesión, reenvío, acceso con Google y alimentos.

Se omiten si no se define `MONGODB_URI_TEST`. Para ejecutarlas:

```powershell
cd backend
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

GitHub Actions ejecuta las pruebas desde `backend` en los pull requests hacia `main`
y en los cambios integrados en `main`.

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
el `Dockerfile` de la raíz, que copia la carpeta `backend`, y se despliegan en Cloud Run.

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

## Estado actual

Las funcionalidades de cada sprint, con sus pull requests y comprobaciones, están en:

- [Sprint 1](docs/sprint-1.md): usuarios, sesiones, persistencia, roles, confirmación por correo y acceso con Google.
- [Sprint 2](docs/sprint-2.md): gestión de alimentos, Google One Tap, estilo visual «Mercado», avisos de caducidad, lista de la compra, ubicaciones, consumo rápido, escáner de código de barras, recetas, hogar, estadísticas y operaciones de Google Cloud.

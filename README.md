# Despensa Inteligente

Proyecto de Israel Amador para la asignatura Procesos de Ingeniería Software.

Aplicación:
https://despensa-inteligente-599179699590.europe-west1.run.app

## Tecnologías y arquitectura

La aplicación utiliza JavaScript, Node.js 24 y Express en el servidor,
y HTML, CSS y JavaScript en el cliente.

Se organiza en capas:

- cliente: interfaz y consultas a la API mediante fetch.
- servidor/api.js: recibe peticiones HTTP y devuelve respuestas.
- servidor/modelo.js: aplica las reglas de negocio y comprueba los permisos.
- servidor/cadMongo.js: guarda y consulta usuarios en MongoDB Atlas.
- servidor/cadMemoria.js: almacenamiento en memoria utilizado en las pruebas.
- servidor/app.js: configuración de Express, sesiones y middleware.
- servidor/registroActividad.js: registros estructurados de peticiones a la API.
- index.js: conexión a MongoDB y arranque del servidor.

Express sirve el frontend y la API desde el mismo origen.
La lógica de negocio y los permisos se ejecutan en el servidor.

bcrypt genera los hashes de las contraseñas.
express-session gestiona las sesiones y connect-mongo las almacena en MongoDB.

## Ejecución local

Requisitos: Node.js 24, npm y acceso a una base de datos MongoDB Atlas.

Instalar dependencias:

```powershell
npm.cmd ci
```

Si no existe un archivo .env, crearlo a partir del ejemplo:

```powershell
Copy-Item .env.example .env
```

Si ya existe un .env configurado, conservarlo.

Generar una clave de sesión:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Completar en .env:

```dotenv
PORT=3000
NODE_ENV=development
SESSION_SECRET=REEMPLAZAR_POR_CLAVE_ALEATORIA
MONGODB_URI=REEMPLAZAR_POR_CADENA_DE_CONEXION
MONGODB_DB=despensa_inteligente
ENABLE_TEST_ACCOUNT=false
```

La cadena de conexión debe incluir las credenciales del usuario de
base de datos. Los caracteres especiales de la contraseña deben
codificarse para una URL.

La IP del equipo debe estar autorizada en la lista de acceso de Atlas.
El usuario de conexión necesita el rol readWrite sobre despensa_inteligente.

Arrancar:

```powershell
npm.cmd start
```

Abrir http://localhost:3000.

En otros terminales puede utilizarse npm en lugar de npm.cmd.

## Variables de entorno

| Variable | Finalidad |
|---|---|
| PORT | Puerto HTTP. Cloud Run lo proporciona automáticamente. |
| NODE_ENV | development en local y production en Cloud Run. |
| SESSION_SECRET | Clave de al menos 32 caracteres para firmar la cookie de sesión. |
| MONGODB_URI | Cadena de conexión privada a MongoDB Atlas. |
| MONGODB_DB | Nombre de la base de datos: despensa_inteligente. |
| ENABLE_TEST_ACCOUNT | true para preparar una cuenta activa de prueba; false para deshabilitar su preparación. |
| TEST_ACCOUNT_EMAIL | Correo de la cuenta de prueba, si se habilita. |
| TEST_ACCOUNT_PASSWORD | Contraseña de la cuenta de prueba, si se habilita. |

.env contiene configuración privada y no se sube al repositorio.
.env.example documenta las variables sin credenciales reales.

En Cloud Run se utiliza ENABLE_TEST_ACCOUNT=false.
Deshabilitar su preparación no elimina una cuenta que ya esté guardada.

## Funcionalidades desarrolladas

### Hito 1: gestión de usuarios

- Separación entre API, lógica de negocio y acceso a datos.
- Creación y consulta de usuarios.
- Estados pendiente, activo y eliminado.
- Eliminación lógica de cuentas.

### Hito 2: autenticación y sesiones

- Interfaz de registro e inicio de sesión.
- Contraseñas almacenadas mediante hash bcrypt.
- Registro de cuentas pendientes de confirmación.
- Inicio de sesión para cuentas activas.
- Consulta de sesión y cierre de sesión.
- Protección de rutas que requieren autenticación.

### Hito 3: persistencia, permisos y registros

- Usuarios almacenados en MongoDB Atlas.
- Sesiones persistentes mediante connect-mongo.
- Índice único sobre el email para impedir duplicados.
- Índice TTL para eliminar sesiones caducadas.
- Roles usuario y administrador.
- Permisos comprobados en la lógica de negocio consultando la cuenta guardada.
- Listado y consulta de cuentas reservados al administrador.
- Eliminación de la propia cuenta o de otras cuentas por un administrador.
- Registros JSON de operaciones, estados HTTP y duración.
- Despliegue en Cloud Run conectado a Atlas.

Los usuarios y las sesiones se almacenan en las colecciones usuarios
y sesiones de la base despensa_inteligente.

La persistencia permite conservar los datos tras reiniciar el servidor
y compartirlos entre instancias. Para conservar una sesión también
deben mantenerse su cookie, su vigencia y el mismo SESSION_SECRET.

## API

| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/salud | Público |
| POST | /api/registro | Público |
| POST | /api/login | Público |
| POST | /api/logout | Cierre de sesión |
| GET | /api/sesion | Usuario autenticado |
| GET | /api/usuarios | Administrador |
| GET | /api/usuarios/:email/activo | Administrador |
| DELETE | /api/usuarios/:email | Administrador o propietario de la cuenta |

El registro público crea cuentas con rol usuario y estado pendiente.
Los listados no devuelven contraseñas ni passwordHash.

Para las pruebas del hito 3 se registró admin@example.com y se asignaron
manualmente en Atlas el rol administrador y el estado activo.
Su contraseña no se incluye en el repositorio.

Esta preparación manual no implementa la confirmación del correo.

## Pruebas automatizadas

Ejecutar:

```powershell
npm.cmd test
```

En la validación del hito 3 pasan 33 pruebas automatizadas de lógica,
autenticación, sesiones, API, frontend y permisos.

Las ocho pruebas específicas de permisos comprueban:

- Listado por administrador sin hashes.
- Rechazo al usuario normal al listar y consultar cuentas.
- Distinción entre cuentas activas y pendientes.
- Eliminación de la propia cuenta.
- Rechazo al eliminar otra cuenta sin permisos.
- Eliminación de otra cuenta por administrador.
- Pérdida de permisos de un administrador eliminado.
- Aplicación del rol actualizado en el almacenamiento.

Las pruebas de permisos utilizan CadMemoria y no modifican Atlas.
La conexión y persistencia de MongoDB se han comprobado manualmente.

GitHub Actions ejecuta las pruebas en los pull requests hacia main
y en los cambios integrados en main.

## Validaciones manuales realizadas

- Conexión local a MongoDB Atlas.
- Sesión conservada tras reiniciar el servidor local.
- Acceso a una cuenta persistida con ENABLE_TEST_ACCOUNT=false.
- Listado de usuarios por administrador en local y en Cloud Run.
- Rechazo al usuario normal en local y en Cloud Run.
- Respuestas de listado sin passwordHash.
- Registro estructurado en Cloud Run de listar_usuarios con estado 403
  y nivel WARNING.
- Compilación y despliegue correctos de h3-persistencia-roles,
  commit 4cd0d8d.

## Registros de actividad

Las peticiones a /api generan registros JSON con:

- Identificador de solicitud.
- Fecha.
- Método HTTP.
- Operación.
- Estado HTTP.
- Duración en milisegundos.
- Nivel INFO, WARNING o ERROR según el estado.

Los registros de actividad no incluyen cuerpos de petición,
contraseñas, cookies, cadenas de conexión ni emails de las rutas.

Se consultan en Cloud Run, en Observabilidad → Registros.
Cloud Logging reconoce severity como nivel del registro.

## Despliegue

Cloud Build está conectado al repositorio de GitHub.
Construye la imagen usando el Dockerfile y la despliega en Cloud Run.

Servicio: despensa-inteligente.
Región: europe-west1.

Durante la validación del hito 3, el activador se configuró para
h3-persistencia-roles. Tras integrar la rama, debe restablecerse
a ^main$ para recuperar el despliegue continuo desde main.

Configuración de producción:

- NODE_ENV=production.
- ENABLE_TEST_ACCOUNT=false.
- MONGODB_DB=despensa_inteligente.
- SESSION_SECRET configurado de forma privada.
- MONGODB_URI referenciada desde el secreto mongodb-uri.

La cuenta de servicio de Cloud Run tiene el rol
Secret Manager Secret Accessor sobre mongodb-uri.

El usuario de conexión de Atlas tiene readWrite únicamente
sobre despensa_inteligente.

## Limitaciones y tareas pendientes

- La confirmación del correo todavía no está implementada.
- La cuenta de administrador se preparó manualmente para las pruebas.
- La gestión de alimentos se desarrollará posteriormente.
- Las pruebas automatizadas de permisos utilizan almacenamiento en memoria;
  no constituyen pruebas de integración con MongoDB.
- El acceso de red de Atlas para probar Cloud Run utiliza una entrada
  temporal 0.0.0.0/0 con caducidad de una semana.

La entrada temporal permite conexiones desde cualquier dirección IPv4,
aunque siguen siendo necesarias las credenciales de MongoDB.
Al caducar, Cloud Run perderá el acceso a Atlas. Antes de esa fecha
debe revisarse la configuración de red necesaria para mantener el servicio.
- Panel gráfico exclusivo para administradores con listado de usuarios,
  email, rol y estado.
- Actualización de la lista y mensajes de carga, lista vacía y errores.
- Limpieza del panel al cerrar sesión.
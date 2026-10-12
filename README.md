# despensa-inteligente
Repositorio para crear una aplicacion de despensa inteligente para la asignatura Procesos de Ingenieria Software de Israel Amador
## Ejecución local

Requisitos: Node.js 24 y npm.

Instalar dependencias:

```bash
npm ci
```

Arrancar la aplicación:

```bash
npm start
```

Abrir http://localhost:3000.

## Pruebas automatizadas

```bash
npm test
```

En PowerShell, si npm.ps1 está bloqueado, utilizar npm.cmd
en lugar de npm.

## Organización inicial

- index.js: arranque del servidor.
- servidor/app.js: configuración de Express.
- cliente/index.html: página de bienvenida.
- test/app.test.js: pruebas de la API y de la página inicial.

## Integración continua

GitHub Actions ejecuta las pruebas en cada pull request
hacia main y en cada cambio integrado en main.
## Gestión de usuarios — Hito 1

El backend está dividido en tres componentes:

- servidor/api.js: recibe peticiones HTTP y devuelve respuestas.
- servidor/modelo.js: aplica las reglas de gestión de usuarios.
- servidor/cadMemoria.js: almacena los usuarios en memoria.

La configuración de Express está en servidor/app.js.
El servidor sirve el frontend y la API desde el mismo origen.

### Operaciones de la API

| Método | Ruta | Operación |
|---|---|---|
| POST | /api/usuarios | Crear usuario enviando un JSON con email. |
| GET | /api/usuarios | Listar usuarios. |
| GET | /api/usuarios/:email/activo | Consultar si una cuenta está activa. |
| DELETE | /api/usuarios/:email | Marcar una cuenta como eliminada. |

Las cuentas nuevas se crean en estado pendiente.
Una cuenta activa es una cuenta confirmada y no eliminada.
Los datos en memoria se pierden al reiniciar y no se comparten
entre instancias del servidor.

Esta versión es un prototipo del hito 1. La autenticación,
los permisos y la persistencia se incorporarán en los
siguientes hitos.

### Pruebas

Ejecutar npm test.
En PowerShell puede utilizarse npm.cmd test.

Actualmente existen 14 pruebas automatizadas:
7 de lógica y 7 de HTTP e interfaz inicial.

### Despliegue continuo

Cloud Build está conectado al repositorio y compila los cambios
de main usando el Dockerfile de la raíz. La imagen se despliega
automáticamente en Cloud Run.

Aplicación:
https://despensa-inteligente-599179699590.europe-west1.run.app
## Tecnologías y arquitectura

Utilizamos JavaScript con Node.js y Express para el servidor, y HTML,
CSS y JavaScript para una interfaz sencilla sin un framework adicional.
bcrypt permite guardar las contraseñas mediante hash y express-session
gestiona las sesiones.

La aplicación se divide en capas:
- cliente: interfaz y cliente REST que consulta la API mediante fetch.
- servidor/api.js: rutas HTTP.
- servidor/modelo.js: lógica de negocio.
- servidor/cadMemoria.js: acceso a los datos en memoria.

Express sirve el frontend y la API desde el mismo origen.
La lógica de negocio se ejecuta en el servidor.

## Ejecución local

Requisito: Node.js 24.

Instalar las dependencias:

```powershell
npm.cmd ci
```

Crear la configuración local:

```powershell
Copy-Item .env.example .env
```

Completar SESSION_SECRET en .env con una clave aleatoria:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Para trabajar en local, utilizar PORT=3000 y NODE_ENV=development.

Arrancar:

```powershell
npm.cmd start
```

Abrir http://localhost:3000.

Si ya existe un archivo .env configurado, conservarlo.

## Variables de entorno

- PORT: puerto del servidor; Cloud Run lo proporciona automáticamente.
- NODE_ENV: development en local y production en Cloud Run.
- SESSION_SECRET: clave para firmar la cookie de sesión, de al menos 32 caracteres.
- ENABLE_TEST_ACCOUNT: true para preparar una cuenta de prueba activa.
- TEST_ACCOUNT_EMAIL: correo de la cuenta de prueba.
- TEST_ACCOUNT_PASSWORD: contraseña de la cuenta de prueba.

El archivo .env contiene configuración privada y no se sube al repositorio.
.env.example documenta las variables sin incluir credenciales reales.

## Funcionalidades del hito 2

- Interfaz de registro e inicio de sesión.
- Contraseñas almacenadas mediante hash bcrypt.
- Cuentas registradas en estado pendiente de confirmación.
- Inicio de sesión para cuentas activas.
- Sesión conservada al recargar la página mientras siga disponible en el servidor.
- Cierre de sesión que invalida la sesión en el servidor.
- Protección de las rutas que requieren autenticación.

La confirmación del correo se implementará en un hito posterior.
Para probar el acceso se puede habilitar una cuenta activa mediante
las variables de entorno. Esta cuenta tiene rol usuario.

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

El registro público siempre crea usuarios con rol usuario.
En este hito no se prepara una cuenta de administrador para acceso manual.

## Pruebas

Ejecutar:

```powershell
npm.cmd test
```

Actualmente hay 25 pruebas automatizadas de lógica de negocio,
autenticación, sesiones, API y entrega del frontend.

GitHub Actions ejecuta las pruebas en los pull requests hacia main
y en los cambios de main.

## Despliegue

Cloud Build está conectado al repositorio de GitHub.
Los cambios integrados en main construyen la imagen usando el Dockerfile
y se despliegan automáticamente en Google Cloud Run.

Aplicación:
https://despensa-inteligente-599179699590.europe-west1.run.app

Las variables de producción se configuran en Cloud Run.

## Limitaciones actuales

Los usuarios y las sesiones se guardan en memoria y se pierden al
reiniciar la instancia. No se comparten entre distintas instancias.

Durante el hito 2 se limita el servicio a una instancia.
En el hito 3 se incorporará una base de datos y almacenamiento
persistente de sesiones.

La gestión de alimentos de la despensa se desarrollará posteriormente.
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
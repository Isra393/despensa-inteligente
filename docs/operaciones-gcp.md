---
type: Proceso
title: Operaciones en Google Cloud con GitHub Actions
description: Flujo de GitHub Actions con Workload Identity Federation para secretos, variables de Cloud Run y Cloud Scheduler.
timestamp: 2026-11-18
---

# Operaciones en Google Cloud con GitHub Actions

El flujo **Operaciones Google Cloud** (`.github/workflows/operaciones-gcp.yml`)
gestiona desde GitHub la configuración de Google Cloud que no forma parte
del despliegue normal: secretos, variables de Cloud Run y Cloud Scheduler.

El despliegue del código no cambia: Cloud Build sigue construyendo y
desplegando en Cloud Run cada cambio que se fusiona en `main`.

## Seguridad

- **Sin claves.** GitHub Actions obtiene credenciales temporales mediante
  Workload Identity Federation. No hay ninguna clave JSON guardada en
  GitHub ni en el repositorio.
- **Solo este flujo y solo desde `main`.** El proveedor de identidades
  rechaza cualquier otro repositorio, rama o flujo (incluido el de CI).
- **Permisos mínimos.** La cuenta `github-operaciones` solo tiene:
  - `roles/secretmanager.admin`: crear el secreto, añadir versiones
    y dar acceso a Cloud Run.
  - `roles/run.developer`: actualizar el servicio de Cloud Run.
  - `roles/cloudscheduler.admin`: gestionar la tarea programada.
  - `roles/iam.serviceAccountUser` sobre la cuenta con la que se
    ejecuta Cloud Run, necesario para desplegar revisiones.
  - `roles/artifactregistry.reader` solo sobre el repositorio
    `cloud-run-source-deploy`, para que Cloud Run pueda leer la imagen
    al crear una revisión.
- El token de las tareas nunca aparece en los registros: el flujo
  lo oculta con `::add-mask::`.
- Solo quien tiene permiso de escritura en el repositorio puede
  lanzar el flujo.

## Configuración inicial (una sola vez)

1. Abrir [Cloud Shell](https://shell.cloud.google.com) con el proyecto
   de la aplicación seleccionado.
2. Ejecutar:

   ```bash
   git clone https://github.com/Isra393/despensa-inteligente.git
   cd despensa-inteligente
   bash infra/configurar-gcp.sh
   ```

3. El script termina mostrando tres valores (`PROYECTO_ID`, `PROVEEDOR`
   y `CUENTA`). Copiarlos en el bloque `env` del flujo, en lugar de
   `PENDIENTE`. No son secretos.

Estado actual: configuración realizada el 17/11/2026 en el proyecto
`despensa-inteligente-511418` (número `599179699590`). Los valores
ya están en el flujo. `configurar-avisos` se ejecutó con éxito ese día:
el secreto `tareas-token` existe, Cloud Run lo usa como `TAREAS_TOKEN`
y la tarea `avisos-caducidad` se ejecuta a diario a las 8:00.

## Operaciones

Se lanzan desde la pestaña **Actions → Operaciones Google Cloud → Run
workflow**, o desde la API de GitHub.

| Operación | Qué hace |
|---|---|
| `estado` | Muestra la URL y la revisión de Cloud Run, si `TAREAS_TOKEN` está configurado y el estado de la tarea programada. No cambia nada. |
| `configurar-avisos` | Crea el secreto `tareas-token` si no existe, da acceso a Cloud Run, añade `TAREAS_TOKEN` al servicio y crea o actualiza la tarea `avisos-caducidad` con el horario indicado. Se puede repetir sin riesgo. |
| `rotar-token-avisos` | Genera un token nuevo y actualiza a la vez Cloud Run y la tarea programada. |
| `ejecutar-avisos` | Lanza ahora la tarea de avisos, sin esperar al horario. |

El campo **horario** usa formato cron en hora de España.
Por defecto es `0 8 * * *` (todos los días a las 8:00).

Cada ejecución deja un resumen del estado en la página del flujo.

## Notas

- `configurar-avisos` necesita que el código de los avisos de caducidad
  ya esté desplegado; si no, la tarea programada recibirá un 404.
- Al rotar el token puede haber unos segundos en los que la tarea
  programada y Cloud Run usen tokens distintos. Si coincide con una
  ejecución, Cloud Scheduler la reintenta.
- Las versiones anteriores del secreto se conservan en Secret Manager.
  Se pueden desactivar desde la consola si se desea.
- Para retirar el acceso: borrar el proveedor `despensa-repo` del grupo
  `github` en *IAM → Workload Identity Federation*.

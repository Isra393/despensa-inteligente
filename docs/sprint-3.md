---
type: Sprint
title: Sprint 3
description: Estilo visual Mercado, avisos de caducidad, lista de la compra automática, ubicaciones y operaciones de Google Cloud.
timestamp: 2026-11-18
---

# Sprint 3

Cada funcionalidad se desarrolló en su propia rama y pull request. Las ramas de avisos, lista de la compra y ubicaciones partían unas de otras, así que se integraron juntas en `main` con el PR #18.

## Pull requests

| PR | Rama | Contenido |
|---|---|---|
| [#13](https://github.com/Isra393/despensa-inteligente/pull/13) | `sprint3-estilo-mercado` | Estilo visual «Mercado» |
| [#14](https://github.com/Isra393/despensa-inteligente/pull/14) | `sprint3-avisos-caducidad` | Avisos de caducidad por correo |
| [#15](https://github.com/Isra393/despensa-inteligente/pull/15) | `sprint3-lista-compra` | Lista de la compra automática |
| [#16](https://github.com/Isra393/despensa-inteligente/pull/16) | `sprint3-ubicaciones` | Ubicaciones de los alimentos |
| [#17](https://github.com/Isra393/despensa-inteligente/pull/17) | `operaciones-gcp` | Operaciones de Google Cloud con GitHub Actions |
| [#18](https://github.com/Isra393/despensa-inteligente/pull/18) | `sprint3-integracion` | Integración de avisos, lista de la compra y ubicaciones en `main` |
| [#19](https://github.com/Isra393/despensa-inteligente/pull/19) | `operaciones-gcp-permiso-imagenes` | Permiso de lectura de imágenes en el script de configuración |

## Estilo visual «Mercado»

Nueva identidad visual para dar un aspecto más profesional:

- Tipografías Bricolage Grotesque (títulos) e Inter (texto),
  cargadas desde Google Fonts.
- Paleta azul marino (`#1b2a41`) con naranja tomate (`#c2410c`)
  sobre fondo cálido; los colores están en variables CSS en
  `backend/frontend/css/estilos.css`.
- Portada con titular, formularios de acceso y ventajas.
- Panel con tarjetas de resumen (caducados, caducan pronto,
  sin prisa y total), lista con punto de color y pastilla de estado,
  y formulario de alta en un panel lateral.
- Barra superior con la cuenta y pie de página.
- En el móvil, el formulario de alta aparece antes de la lista
  y cada alimento se muestra como una tarjeta.
- Contrastes de texto AA, foco visible y enlace para saltar
  al contenido.

## Avisos de caducidad por correo

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

## Lista de la compra automática

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

## Ubicaciones

- Cada alimento indica dónde se guarda: `nevera`, `congelador`
  o `despensa` (por defecto).
- Los alimentos creados antes de esta funcionalidad se tratan como
  de la despensa, sin necesidad de migrar datos.
- Pestañas para ver todo o solo una ubicación, con el número de
  alimentos de cada una.
- La ubicación y la categoría se muestran bajo el nombre del alimento.
- El resumen de `GET /api/alimentos` incluye `porUbicacion`.

## Operaciones de Google Cloud

La configuración de secretos, del token de las tareas y de Cloud Scheduler se automatiza con GitHub Actions y Workload Identity Federation, sin claves de cuentas de servicio. El detalle está en [operaciones-gcp.md](operaciones-gcp.md).

---
type: Sprint
title: Sprint 2
description: Alimentos, One Tap, estilo Mercado, avisos, lista de la compra, ubicaciones, consumo rápido, escáner, recetas, hogar, estadísticas y operaciones de GCP.
timestamp: 2026-11-18
---

# Sprint 2

El sprint empezó completando los apartados pendientes del tutorial y la gestión de alimentos (PR #12). Después se añadieron funcionalidades nuevas, cada una en su propia rama y pull request. Las ramas de avisos, lista de la compra y ubicaciones partían unas de otras, así que se integraron juntas en `main` con el PR #18.

Los nombres de algunas ramas (`sprint3-…`, `sprint4-…`) no coinciden con el sprint: todas estas funcionalidades pertenecen al Sprint 2, como indican los títulos de los pull requests.

## Pull requests

| PR | Rama | Contenido |
|---|---|---|
| [#12](https://github.com/Isra393/despensa-inteligente/pull/12) | `sprint2-alimentos-onetap` | Gestión de alimentos, Google One Tap y pruebas de integración |
| [#13](https://github.com/Isra393/despensa-inteligente/pull/13) | `sprint3-estilo-mercado` | Estilo visual «Mercado» |
| [#14](https://github.com/Isra393/despensa-inteligente/pull/14) | `sprint3-avisos-caducidad` | Avisos de caducidad por correo |
| [#15](https://github.com/Isra393/despensa-inteligente/pull/15) | `sprint3-lista-compra` | Lista de la compra automática |
| [#16](https://github.com/Isra393/despensa-inteligente/pull/16) | `sprint3-ubicaciones` | Ubicaciones de los alimentos |
| [#17](https://github.com/Isra393/despensa-inteligente/pull/17) | `operaciones-gcp` | Operaciones de Google Cloud con GitHub Actions |
| [#18](https://github.com/Isra393/despensa-inteligente/pull/18) | `sprint3-integracion` | Integración de avisos, lista de la compra y ubicaciones en `main` |
| [#19](https://github.com/Isra393/despensa-inteligente/pull/19) | `operaciones-gcp-permiso-imagenes` | Permiso de lectura de imágenes en el script de configuración |
| [#20](https://github.com/Isra393/despensa-inteligente/pull/20) | `sprint4-consumo-rapido` | Restar y sumar cantidades sin editar |
| [#21](https://github.com/Isra393/despensa-inteligente/pull/21) | `sprint4-escaner` | Escáner de código de barras con Open Food Facts |
| [#22](https://github.com/Isra393/despensa-inteligente/pull/22) | `sprint4-recetas` | Recetas con lo que caduca antes |
| [#23](https://github.com/Isra393/despensa-inteligente/pull/23) | `sprint4-hogar` | Despensa compartida (hogar) |
| [#24](https://github.com/Isra393/despensa-inteligente/pull/24) | `sprint4-estadisticas` | Estadísticas de desperdicio y exportación a CSV |

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

## Restar y sumar sin editar

- Cada alimento tiene botones **−** y **+** junto a su cantidad para
  gastarlo o reponerlo sin abrir el formulario.
- El paso depende de la unidad: 1 unidad, 100 g, 100 ml, 0,25 kg o 0,25 l.
- La cantidad nunca baja de 0. Al llegar a 0 se marca «Agotado»
  y el botón **−** se desactiva.
- Si el alimento tiene mínimo, entra o sale de la lista de la compra
  al momento.
- Con el teclado, el foco se queda en el mismo botón para poder
  pulsarlo varias veces seguidas.

## Escáner de código de barras

- El botón **Escanear** del formulario abre la cámara y lee códigos
  EAN-13, EAN-8 y UPC con `BarcodeDetector` (Chrome y Edge, sobre todo
  en Android). En otros navegadores, o sin permiso de cámara, se
  escribe el código a mano.
- El servidor consulta el producto en [Open Food Facts](https://world.openfoodfacts.org)
  y rellena nombre, cantidad del envase, unidad, categoría y ubicación.
  Solo queda indicar la fecha de caducidad.
- Si el producto ya está en la despensa (mismo código), ofrece
  **sumar** un envase al que ya tienes en lugar de duplicarlo.
- Si Open Food Facts no lo conoce, se puede añadir a mano conservando
  el código para la próxima vez.
- Se comprueba el dígito de control del código antes de consultar.
- Las respuestas se guardan 24 horas en caché (1 hora las no
  encontradas) y cada usuario puede hacer 10 búsquedas por minuto,
  porque Open Food Facts limita las consultas por IP.

## Recetas con lo que caduca antes

- Sección **Ideas para cocinar** con hasta 6 recetas según lo que hay
  en casa, ordenadas para aprovechar primero lo que caduca antes.
- Recetario propio de 28 recetas caseras (`backend/recetario.js`).
  Cada ingrediente tiene palabras clave que se buscan en los nombres
  de los alimentos, sin tener en cuenta tildes ni plurales
  («Tomates pera» cuenta como «tomate»).
- Puntuación: un alimento que caduca en los próximos 3 días suma
  mucho más que uno sin prisa, y cada ingrediente obligatorio que
  falta resta. Solo se proponen recetas con al menos la mitad de
  los ingredientes obligatorios.
- Los alimentos caducados o agotados no cuentan como disponibles.
- Cada receta indica qué tienes, qué caduca pronto y qué falta, con
  los pasos desplegables.
- **Añadir lo que falta a la lista** pasa a la lista de la compra los
  ingredientes obligatorios que no tienes, sin repetir los que ya
  están pendientes.

## Despensa compartida (hogar)

- Desde la tarjeta **Tu hogar**, cualquier persona puede invitar a quien
  vive con ella con un **código de invitación** (por ejemplo `ABCD-EFGH`).
- El código sirve **una sola vez** y caduca a las **48 horas**. Solo se
  guarda su huella SHA-256, nunca el código.
- Todos los miembros comparten alimentos y lista de la compra, con los
  mismos permisos. Las preferencias de los avisos son de cada persona.
- Al unirse, si nadie más usaba tu despensa, tus alimentos y tu lista se
  suman a la compartida. Si compartías otra, se quedan allí.
- Cualquier miembro puede salir o quitar a otro. Quien sale empieza con
  una despensa vacía; los datos se quedan con el resto.
- Máximo 6 miembros por hogar y 5 intentos de código cada 10 minutos
  por usuario.
- Los cambios de otros miembros se ven al recargar la página
  (no hay actualización en tiempo real).

Sin migración de datos: los alimentos siguen guardando su despensa en
el campo `usuarioId`, que ahora es el identificador de la despensa.
Cada usuario tiene `hogarId` solo si comparte; si no, su despensa es
la de su propio `id`.

## Estadísticas de desperdicio y exportación

- Al eliminar un alimento, un diálogo pregunta qué ha pasado:
  **Lo hemos terminado**, **Se ha tirado** o **Lo añadí por error**
  (este último no cuenta en las estadísticas).
- Cada gasto con el botón **−** también queda registrado.
- La sección **Tu aprovechamiento** muestra, para los últimos 6 meses:
  - el porcentaje aprovechado (terminados entre terminados y tirados),
  - cuántos alimentos se han terminado y tirado, y cuántos de los
    tirados ya estaban caducados,
  - un gráfico mensual de terminados frente a tirados, con la tabla
    equivalente y la información también accesible con el teclado,
  - los 5 productos que más se tiran (agrupando «Yogur» y «Yogures»).
- Botones para descargar la despensa y el historial en CSV, preparados
  para Excel en español (separador `;`, coma decimal y acentos).
  Los textos que empiezan por `=`, `+`, `-` o `@` se protegen para que
  la hoja de cálculo no los ejecute como fórmulas.
- El historial pertenece a la despensa, así que se comparte con el hogar.
- Colores del gráfico validados para daltonismo y contraste.

## Operaciones de Google Cloud

La configuración de secretos, del token de las tareas y de Cloud Scheduler se automatiza con GitHub Actions y Workload Identity Federation, sin claves de cuentas de servicio. El detalle está en [operaciones-gcp.md](operaciones-gcp.md).

## Comprobaciones de la gestión de alimentos y One Tap

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

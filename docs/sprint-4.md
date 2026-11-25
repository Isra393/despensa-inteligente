---
type: Sprint
title: Sprint 4
description: Consumo rápido, escáner de código de barras, recetas, despensa compartida y estadísticas de desperdicio.
timestamp: 2026-11-18
---

# Sprint 4

## Pull requests

| PR | Rama | Contenido |
|---|---|---|
| [#20](https://github.com/Isra393/despensa-inteligente/pull/20) | `sprint4-consumo-rapido` | Restar y sumar cantidades sin editar |
| [#21](https://github.com/Isra393/despensa-inteligente/pull/21) | `sprint4-escaner` | Escáner de código de barras con Open Food Facts |
| [#22](https://github.com/Isra393/despensa-inteligente/pull/22) | `sprint4-recetas` | Recetas con lo que caduca antes |
| [#23](https://github.com/Isra393/despensa-inteligente/pull/23) | `sprint4-hogar` | Despensa compartida (hogar) |
| [#24](https://github.com/Isra393/despensa-inteligente/pull/24) | `sprint4-estadisticas` | Estadísticas de desperdicio y exportación a CSV |

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

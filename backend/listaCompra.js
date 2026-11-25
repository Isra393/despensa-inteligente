const MAX_ELEMENTOS_LISTA = 200;

// Valida un elemento añadido a mano a la lista de la compra.
// La cantidad es un texto libre opcional ("2 kg", "un paquete").
function validarElementoLista(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return { error: "Los datos del elemento no son válidos" };
  }

  const nombre =
    typeof datos.nombre === "string" ? datos.nombre.trim() : "";

  if (nombre.length < 1 || nombre.length > 80) {
    return { error: "El nombre debe tener entre 1 y 80 caracteres" };
  }

  let cantidad = datos.cantidad ?? "";

  if (typeof cantidad !== "string") {
    return { error: "La cantidad debe ser un texto" };
  }

  cantidad = cantidad.trim();

  if (cantidad.length > 40) {
    return { error: "La cantidad no puede superar los 40 caracteres" };
  }

  return { datos: { nombre, cantidad: cantidad || null } };
}

module.exports = { MAX_ELEMENTOS_LISTA, validarElementoLista };

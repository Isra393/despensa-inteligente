const UNIDADES = ["unidades", "g", "kg", "ml", "l"];

const CATEGORIAS = [
  "fruta y verdura",
  "carne y pescado",
  "lácteos y huevos",
  "panadería",
  "despensa seca",
  "congelados",
  "bebidas",
  "otros"
];

const DIAS_AVISO_CADUCIDAD = 3;
const MAX_ALIMENTOS_POR_USUARIO = 500;
const ZONA_HORARIA = "Europe/Madrid";

// Comprueba que la fecha tiene formato AAAA-MM-DD y existe en el calendario.
function esFechaValida(texto) {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }

  const [anio, mes, dia] = texto.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia &&
    anio >= 2000 &&
    anio <= 2100
  );
}

// Fecha del día en la zona horaria de la aplicación, como AAAA-MM-DD.
function fechaLocal(ahora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(ahora);
}

function diasEntre(desde, hasta) {
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);

  return Math.round((fin - inicio) / (24 * 60 * 60 * 1000));
}

function estadoCaducidad(fechaCaducidad, ahora = new Date()) {
  if (!fechaCaducidad) {
    return { estado: "sin_fecha", diasRestantes: null };
  }

  const diasRestantes = diasEntre(fechaLocal(ahora), fechaCaducidad);

  if (diasRestantes < 0) {
    return { estado: "caducado", diasRestantes };
  }

  if (diasRestantes <= DIAS_AVISO_CADUCIDAD) {
    return { estado: "proximo", diasRestantes };
  }

  return { estado: "vigente", diasRestantes };
}

// Devuelve un objeto limpio con los campos permitidos o un mensaje de error.
function validarDatosAlimento(datos) {
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
    return { error: "Los datos del alimento no son válidos" };
  }

  const nombre =
    typeof datos.nombre === "string" ? datos.nombre.trim() : "";

  if (nombre.length < 1 || nombre.length > 80) {
    return { error: "El nombre debe tener entre 1 y 80 caracteres" };
  }

  const cantidad = datos.cantidad;

  if (
    typeof cantidad !== "number" ||
    !Number.isFinite(cantidad) ||
    cantidad < 0 ||
    cantidad > 100000
  ) {
    return { error: "La cantidad debe ser un número entre 0 y 100000" };
  }

  const unidad = datos.unidad ?? "unidades";

  if (!UNIDADES.includes(unidad)) {
    return { error: "La unidad no es válida" };
  }

  if (unidad === "unidades" && !Number.isInteger(cantidad)) {
    return { error: "Las unidades deben ser un número entero" };
  }

  const categoria = datos.categoria ?? "otros";

  if (!CATEGORIAS.includes(categoria)) {
    return { error: "La categoría no es válida" };
  }

  let fechaCaducidad = datos.fechaCaducidad ?? null;

  if (fechaCaducidad === "") {
    fechaCaducidad = null;
  }

  if (fechaCaducidad !== null && !esFechaValida(fechaCaducidad)) {
    return {
      error: "La fecha de caducidad debe tener el formato AAAA-MM-DD"
    };
  }

  // Cantidad a partir de la cual el alimento pasa a la lista de la compra.
  let stockMinimo = datos.stockMinimo ?? null;

  if (stockMinimo === "") {
    stockMinimo = null;
  }

  if (stockMinimo !== null) {
    if (
      typeof stockMinimo !== "number" ||
      !Number.isFinite(stockMinimo) ||
      stockMinimo < 0 ||
      stockMinimo > 100000
    ) {
      return { error: "El mínimo debe ser un número entre 0 y 100000" };
    }

    if (unidad === "unidades" && !Number.isInteger(stockMinimo)) {
      return { error: "El mínimo en unidades debe ser un número entero" };
    }

    stockMinimo = Math.round(stockMinimo * 1000) / 1000;
  }

  return {
    datos: {
      nombre,
      cantidad: Math.round(cantidad * 1000) / 1000,
      unidad,
      categoria,
      fechaCaducidad,
      stockMinimo
    }
  };
}

function bajoMinimo(alimento) {
  return (
    typeof alimento.stockMinimo === "number" &&
    alimento.cantidad <= alimento.stockMinimo
  );
}

// Ordena por caducidad (primero lo que antes caduca) y después por nombre.
function compararAlimentos(a, b) {
  if (a.fechaCaducidad && b.fechaCaducidad) {
    if (a.fechaCaducidad !== b.fechaCaducidad) {
      return a.fechaCaducidad < b.fechaCaducidad ? -1 : 1;
    }
  } else if (a.fechaCaducidad) {
    return -1;
  } else if (b.fechaCaducidad) {
    return 1;
  }

  return a.nombre.localeCompare(b.nombre, "es");
}

module.exports = {
  UNIDADES,
  CATEGORIAS,
  DIAS_AVISO_CADUCIDAD,
  MAX_ALIMENTOS_POR_USUARIO,
  esFechaValida,
  fechaLocal,
  estadoCaducidad,
  validarDatosAlimento,
  compararAlimentos,
  bajoMinimo
};

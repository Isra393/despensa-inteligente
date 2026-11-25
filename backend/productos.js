// Consulta de productos por código de barras en Open Food Facts.
// La consulta se hace desde el servidor para enviar un User-Agent propio,
// guardar en caché las respuestas y limitar las peticiones por usuario.

const URL_OPEN_FOOD_FACTS = "https://world.openfoodfacts.org/api/v2/product";
const CAMPOS = [
  "code",
  "product_name",
  "product_name_es",
  "generic_name_es",
  "brands",
  "quantity",
  "categories_tags"
].join(",");

const USER_AGENT_POR_DEFECTO =
  "DespensaInteligente/1.0 (+https://github.com/Isra393/despensa-inteligente)";

const DURACION_CACHE = 24 * 60 * 60 * 1000;
const DURACION_CACHE_NO_ENCONTRADO = 60 * 60 * 1000;
const MAX_CACHE = 500;
const TIEMPO_MAXIMO = 5000;

// Comprueba EAN-8, UPC-A (12), EAN-13 y GTIN-14 con su dígito de control.
function codigoValido(codigo) {
  if (typeof codigo !== "string" || !/^(\d{8}|\d{12,14})$/.test(codigo)) {
    return false;
  }

  const digitos = [...codigo].map(Number);
  const control = digitos.pop();

  const suma = digitos
    .reverse()
    .reduce((total, digito, i) => total + digito * (i % 2 === 0 ? 3 : 1), 0);

  return (10 - (suma % 10)) % 10 === control;
}

// Reglas de categorías de Open Food Facts a categorías de la despensa.
const REGLAS_CATEGORIA = [
  { claves: ["dairies", "milks", "yogurts", "cheeses", "eggs", "butters", "creams"],
    categoria: "lácteos y huevos", ubicacion: "nevera" },
  { claves: ["meats", "poultry", "fishes", "seafood", "hams", "sausages"],
    categoria: "carne y pescado", ubicacion: "nevera" },
  { claves: ["fruits", "vegetables", "salads"],
    categoria: "fruta y verdura", ubicacion: "nevera" },
  { claves: ["breads", "bakery", "viennoiseries", "pastries"],
    categoria: "panadería", ubicacion: "despensa" },
  { claves: ["beverages", "waters", "juices", "nectars", "sodas", "wines", "beers",
    "coffees", "teas"],
    categoria: "bebidas", ubicacion: "despensa" },
  { claves: ["cereals", "pastas", "rices", "legumes", "flours", "canned-foods",
    "sauces", "oils", "snacks", "biscuits", "sugars", "spices", "condiments",
    "breakfasts"],
    categoria: "despensa seca", ubicacion: "despensa" }
];

// Open Food Facts ordena las categorías de la más general a la más
// concreta, así que se revisan empezando por la última.
function clasificar(etiquetas) {
  const lista = (Array.isArray(etiquetas) ? etiquetas : [])
    .filter(etiqueta => typeof etiqueta === "string");

  if (lista.some(etiqueta => etiqueta.includes("frozen"))) {
    return { categoria: "congelados", ubicacion: "congelador" };
  }

  for (const etiqueta of [...lista].reverse()) {
    const regla = REGLAS_CATEGORIA.find(({ claves }) =>
      claves.some(clave =>
        etiqueta.endsWith(`:${clave}`) || etiqueta.endsWith(`-${clave}`)
      )
    );

    if (regla) {
      return { categoria: regla.categoria, ubicacion: regla.ubicacion };
    }
  }

  return { categoria: "otros", ubicacion: "despensa" };
}

// Interpreta textos como "1 l", "500 g", "1,5 L", "33 cl" o "6 x 125 g".
function interpretarCantidad(texto) {
  if (typeof texto !== "string") {
    return { cantidad: 1, unidad: "unidades" };
  }

  const paquete = texto.match(/(\d+)\s*[x×]\s*\d/i);

  if (paquete) {
    const unidades = Number(paquete[1]);
    if (unidades >= 1 && unidades <= 1000) {
      return { cantidad: unidades, unidad: "unidades" };
    }
  }

  const medida = texto.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|cl|ml)\b/i);

  if (!medida) {
    return { cantidad: 1, unidad: "unidades" };
  }

  let cantidad = Number(medida[1].replace(",", "."));
  let unidad = medida[2].toLowerCase();

  if (unidad === "cl") {
    cantidad *= 10;
    unidad = "ml";
  } else if (unidad === "mg") {
    cantidad /= 1000;
    unidad = "g";
  }

  if (!Number.isFinite(cantidad) || cantidad <= 0 || cantidad > 100000) {
    return { cantidad: 1, unidad: "unidades" };
  }

  return { cantidad: Math.round(cantidad * 1000) / 1000, unidad };
}

function limpiarTexto(texto, maximo) {
  if (typeof texto !== "string") return "";
  return texto.replace(/\s+/g, " ").trim().slice(0, maximo);
}

function mapearProducto(codigo, producto) {
  const nombre = limpiarTexto(
    producto.product_name_es || producto.product_name || producto.generic_name_es,
    80
  );

  if (!nombre) return null;

  const marca = limpiarTexto(String(producto.brands || "").split(",")[0], 60) || null;

  return {
    codigo,
    nombre,
    marca,
    ...clasificar(producto.categories_tags),
    ...interpretarCantidad(producto.quantity)
  };
}

function crearCatalogoProductos({
  fetch: buscar = globalThis.fetch,
  userAgent = USER_AGENT_POR_DEFECTO,
  ahora = () => Date.now()
} = {}) {
  const cache = new Map();

  function guardar(codigo, producto, duracion) {
    if (cache.size >= MAX_CACHE) {
      // Se descarta la entrada más antigua.
      cache.delete(cache.keys().next().value);
    }

    cache.set(codigo, { producto, caducaEn: ahora() + duracion });
  }

  return {
    // Devuelve el producto, null si no existe, o lanza un error con
    // "codigoError" si Open Food Facts no responde como se espera.
    async buscar(codigo) {
      const guardado = cache.get(codigo);

      if (guardado && guardado.caducaEn > ahora()) {
        return guardado.producto;
      }

      let respuesta;

      try {
        respuesta = await buscar(
          `${URL_OPEN_FOOD_FACTS}/${codigo}?fields=${CAMPOS}`,
          {
            headers: { "User-Agent": userAgent, Accept: "application/json" },
            signal: AbortSignal.timeout(TIEMPO_MAXIMO)
          }
        );
      } catch {
        throw Object.assign(new Error("Sin respuesta"), { codigoError: "no_disponible" });
      }

      if (respuesta.status === 429 || respuesta.status === 503) {
        throw Object.assign(new Error("Límite"), { codigoError: "limite" });
      }

      if (respuesta.status === 404) {
        guardar(codigo, null, DURACION_CACHE_NO_ENCONTRADO);
        return null;
      }

      if (!respuesta.ok) {
        throw Object.assign(new Error("Error"), { codigoError: "no_disponible" });
      }

      let datos;

      try {
        datos = await respuesta.json();
      } catch {
        throw Object.assign(new Error("JSON"), { codigoError: "no_disponible" });
      }

      const producto = datos && datos.status === 1 && datos.product
        ? mapearProducto(codigo, datos.product)
        : null;

      guardar(
        codigo,
        producto,
        producto ? DURACION_CACHE : DURACION_CACHE_NO_ENCONTRADO
      );

      return producto;
    }
  };
}

module.exports = {
  codigoValido,
  clasificar,
  interpretarCantidad,
  mapearProducto,
  crearCatalogoProductos
};

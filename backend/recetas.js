// Sugerencias de recetas según lo que hay en la despensa, dando
// prioridad a los alimentos que caducan antes.
const { RECETAS, BASICOS } = require("./recetario");

const MAX_SUGERENCIAS = 6;

// "Plátanos maduros" -> ["platanos", "maduros"]
function palabras(texto) {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Formas singulares posibles: "tomates" -> tomates, tomate, tomat.
function variantes(palabra) {
  const formas = new Set([palabra]);
  if (palabra.endsWith("s")) formas.add(palabra.slice(0, -1));
  if (palabra.endsWith("es")) formas.add(palabra.slice(0, -2));
  return formas;
}

// Una clave coincide si todas sus palabras aparecen en el nombre.
function coincide(clave, nombreAlimento) {
  const delAlimento = palabras(nombreAlimento).map(variantes);

  return palabras(clave).every(palabra =>
    delAlimento.some(formas => formas.has(palabra))
  );
}

// Peso de un alimento: cuanto antes caduca, más interesa usarlo.
function urgencia(alimento) {
  if (alimento.estadoCaducidad === "proximo") {
    return 10 + (3 - Math.max(0, alimento.diasRestantes)) * 2;
  }

  if (alimento.estadoCaducidad === "vigente") return 3;
  return 2;
}

// Los alimentos caducados o agotados no cuentan como disponibles.
function disponibles(alimentos) {
  return alimentos.filter(alimento =>
    alimento.cantidad > 0 && alimento.estadoCaducidad !== "caducado"
  );
}

function evaluarReceta(receta, alimentos) {
  let puntuacion = 0;
  const aprovecha = [];

  const ingredientes = receta.ingredientes.map(ingrediente => {
    // Si hay varios alimentos que encajan, se usa el más urgente.
    const candidatos = alimentos
      .filter(alimento => ingrediente.claves.some(clave => coincide(clave, alimento.nombre)))
      .sort((a, b) => urgencia(b) - urgencia(a));

    const usado = candidatos[0];

    if (!usado) {
      if (!ingrediente.opcional) puntuacion -= 4;
      return { nombre: ingrediente.nombre, opcional: ingrediente.opcional, estado: "falta" };
    }

    puntuacion += urgencia(usado);

    if (usado.estadoCaducidad === "proximo") {
      aprovecha.push({ nombre: usado.nombre, diasRestantes: usado.diasRestantes });
    }

    return {
      nombre: ingrediente.nombre,
      opcional: ingrediente.opcional,
      estado: usado.estadoCaducidad === "proximo" ? "caduca_pronto" : "tienes",
      alimento: usado.nombre
    };
  });

  const obligatorios = ingredientes.filter(i => !i.opcional);
  const tiene = obligatorios.filter(i => i.estado !== "falta").length;

  return {
    id: receta.id,
    nombre: receta.nombre,
    minutos: receta.minutos,
    raciones: receta.raciones,
    ingredientes,
    basicos: BASICOS,
    pasos: receta.pasos,
    aprovecha,
    faltan: obligatorios.filter(i => i.estado === "falta").map(i => i.nombre),
    cobertura: obligatorios.length === 0 ? 1 : tiene / obligatorios.length,
    puntuacion
  };
}

// Devuelve las mejores recetas: al menos la mitad de los ingredientes
// obligatorios en casa, ordenadas por puntuación y, a igualdad,
// por las que menos ingredientes necesitan comprar.
function sugerirRecetas(alimentos, { limite = MAX_SUGERENCIAS } = {}) {
  const enCasa = disponibles(alimentos);

  if (enCasa.length === 0) return [];

  return RECETAS
    .map(receta => evaluarReceta(receta, enCasa))
    .filter(receta => receta.cobertura >= 0.5)
    .sort((a, b) =>
      b.puntuacion - a.puntuacion ||
      a.faltan.length - b.faltan.length ||
      a.minutos - b.minutos
    )
    .slice(0, limite);
}

function buscarReceta(id) {
  return RECETAS.find(receta => receta.id === id) ?? null;
}

module.exports = {
  palabras,
  coincide,
  sugerirRecetas,
  evaluarReceta,
  buscarReceta,
  disponibles
};

// Estadísticas de consumo y desperdicio, y exportación a CSV.
const { fechaLocal } = require("./alimentos");
const { palabras } = require("./recetas");

// Tipos de movimiento:
// - consumo:   se ha gastado parte con el botón −
// - terminado: se ha eliminado porque se acabó
// - tirado:    se ha eliminado porque se tiró
const TIPOS_MOVIMIENTO = ["consumo", "terminado", "tirado"];
const MOTIVOS_ELIMINACION = ["terminado", "tirado", "error"];

// Dos palabras equivalentes son iguales o una es la otra seguida de «s»/«es»:
// así «Tomate»/«Tomates» y «Yogur»/«Yogures» son el mismo alimento, pero
// «Tomate» no se mezcla con «Tomate cherry» ni «Leche» con «Lechuga».
function palabrasEquivalentes(a, b) {
  return a === b
    || `${a}s` === b
    || `${a}es` === b
    || `${b}s` === a
    || `${b}es` === a;
}

// Los nombres se agrupan si tienen las mismas palabras, todas equivalentes.
function nombresEquivalentes(a, b) {
  return a.length === b.length
    && a.every((palabra, i) => palabrasEquivalentes(palabra, b[i]));
}

// "2026-03" de una fecha, con el calendario de España.
function mesLocal(fecha) {
  return fechaLocal(new Date(fecha)).slice(0, 7);
}

// Los últimos `meses` meses, del más antiguo al actual.
function ultimosMeses(ahora, meses) {
  const [anio, mes] = mesLocal(ahora).split("-").map(Number);

  return Array.from({ length: meses }, (_, i) => {
    const fecha = new Date(Date.UTC(anio, mes - 1 - (meses - 1 - i), 1));
    return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function calcularEstadisticas(movimientos, { ahora = new Date(), meses = 6 } = {}) {
  const claves = ultimosMeses(ahora, meses);
  const porMes = new Map(
    claves.map(mes => [mes, { mes, terminados: 0, tirados: 0, consumos: 0 }])
  );

  const tiradosPorNombre = [];
  let tiradosCaducados = 0;

  for (const movimiento of movimientos) {
    const fila = porMes.get(mesLocal(movimiento.fecha));
    if (!fila) continue;

    if (movimiento.tipo === "terminado") fila.terminados++;
    if (movimiento.tipo === "consumo") fila.consumos++;

    if (movimiento.tipo === "tirado") {
      fila.tirados++;
      if (movimiento.caducado) tiradosCaducados++;

      // Se agrupan nombres equivalentes ("Yogur", "yogures").
      const normalizado = palabras(movimiento.nombre);
      const grupo = tiradosPorNombre.find(g =>
        nombresEquivalentes(g.normalizado, normalizado)
      );

      if (grupo) {
        grupo.veces++;
      } else {
        tiradosPorNombre.push({ nombre: movimiento.nombre, normalizado, veces: 1 });
      }
    }
  }

  const mensual = [...porMes.values()];
  const terminados = mensual.reduce((t, m) => t + m.terminados, 0);
  const tirados = mensual.reduce((t, m) => t + m.tirados, 0);
  const consumos = mensual.reduce((t, m) => t + m.consumos, 0);

  return {
    meses,
    desde: claves[0],
    mensual,
    totales: {
      terminados,
      tirados,
      consumos,
      tiradosCaducados,
      // Porcentaje de alimentos retirados que se aprovecharon.
      aprovechamiento: terminados + tirados === 0
        ? null
        : Math.round((terminados / (terminados + tirados)) * 100)
    },
    masTirados: tiradosPorNombre
      .map(({ nombre, veces }) => ({ nombre, veces }))
      .sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, "es"))
      .slice(0, 5)
  };
}

// ---------------------------------------------------------------
// CSV para hojas de cálculo en español: separador «;», coma decimal
// y marca BOM para que Excel reconozca los acentos.
// ---------------------------------------------------------------

function celdaCsv(valor) {
  if (valor === null || valor === undefined) return "";

  let texto = typeof valor === "number"
    ? String(valor).replace(".", ",")
    : String(valor);

  // Evita que una hoja de cálculo interprete el texto como fórmula.
  if (typeof valor === "string" && /^[=+\-@\t\r]/.test(texto)) {
    texto = `'${texto}`;
  }

  if (/[;"\r\n]/.test(texto)) {
    texto = `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

function generarCsv(cabeceras, filas) {
  const lineas = [cabeceras, ...filas].map(fila => fila.map(celdaCsv).join(";"));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}

const NOMBRES_ESTADO = {
  caducado: "Caducado",
  proximo: "Caduca pronto",
  vigente: "En buen estado",
  sin_fecha: "Sin fecha"
};

function csvDespensa(alimentos) {
  return generarCsv(
    ["Alimento", "Cantidad", "Unidad", "Categoría", "Ubicación", "Caduca", "Estado", "Mínimo", "Código de barras"],
    alimentos.map(a => [
      a.nombre,
      a.cantidad,
      a.unidad,
      a.categoria,
      a.ubicacion,
      a.fechaCaducidad,
      NOMBRES_ESTADO[a.estadoCaducidad] ?? a.estadoCaducidad,
      a.stockMinimo,
      a.codigoBarras
    ])
  );
}

const NOMBRES_TIPO = { consumo: "Consumo", terminado: "Terminado", tirado: "Tirado" };

function csvHistorial(movimientos) {
  return generarCsv(
    ["Fecha", "Tipo", "Alimento", "Cantidad", "Unidad", "Categoría", "Estaba caducado"],
    [...movimientos]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .map(m => [
        fechaLocal(new Date(m.fecha)),
        NOMBRES_TIPO[m.tipo] ?? m.tipo,
        m.nombre,
        m.cantidad,
        m.unidad,
        m.categoria,
        m.caducado ? "Sí" : "No"
      ])
  );
}

module.exports = {
  TIPOS_MOVIMIENTO,
  MOTIVOS_ELIMINACION,
  mesLocal,
  ultimosMeses,
  calcularEstadisticas,
  celdaCsv,
  csvDespensa,
  csvHistorial
};

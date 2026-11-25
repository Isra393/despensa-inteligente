const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("../servidor/app");
const { Sistema } = require("../servidor/modelo");
const { CadMemoria } = require("../servidor/cadMemoria");
const {
  ultimosMeses,
  calcularEstadisticas,
  celdaCsv,
  csvDespensa
} = require("../servidor/estadisticas");

const AHORA = new Date("2026-03-10T11:00:00Z");

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  for (const [i, email] of ["ana@example.com", "luis@example.com"].entries()) {
    await cad.guardar({
      id: `${i + 1}`.repeat(8) + "-1111-4111-8111-111111111111",
      email,
      rol: "usuario",
      estado: "activo"
    });
  }

  return { cad, sistema };
}

function movimiento(tipo, fecha, nombre = "Leche", caducado = false) {
  return { tipo, fecha: new Date(fecha), nombre, caducado };
}

test("Meses: devuelve el periodo con el calendario de España", () => {
  assert.deepEqual(
    ultimosMeses(AHORA, 3),
    ["2026-01", "2026-02", "2026-03"]
  );

  // 31 de diciembre a las 23:30 UTC ya es 1 de enero en Madrid.
  assert.deepEqual(
    ultimosMeses(new Date("2025-12-31T23:30:00Z"), 2),
    ["2025-12", "2026-01"]
  );
});

test("Estadísticas: cuenta por mes, calcula el aprovechamiento y el ranking", () => {
  const datos = calcularEstadisticas([
    movimiento("terminado", "2026-03-02"),
    movimiento("terminado", "2026-03-05"),
    movimiento("terminado", "2026-02-10"),
    movimiento("tirado", "2026-03-04", "Yogur", true),
    movimiento("tirado", "2026-02-20", "Yogures", true),
    movimiento("tirado", "2026-02-21", "Lechuga"),
    movimiento("consumo", "2026-03-06"),
    movimiento("terminado", "2025-01-01") // fuera del periodo
  ], { ahora: AHORA, meses: 3 });

  assert.deepEqual(datos.mensual, [
    { mes: "2026-01", terminados: 0, tirados: 0, consumos: 0 },
    { mes: "2026-02", terminados: 1, tirados: 2, consumos: 0 },
    { mes: "2026-03", terminados: 2, tirados: 1, consumos: 1 }
  ]);

  assert.deepEqual(datos.totales, {
    terminados: 3,
    tirados: 3,
    consumos: 1,
    tiradosCaducados: 2,
    aprovechamiento: 50
  });

  // «Yogur» y «Yogures» cuentan como el mismo producto.
  assert.deepEqual(datos.masTirados, [
    { nombre: "Yogur", veces: 2 },
    { nombre: "Lechuga", veces: 1 }
  ]);
});

test("Ranking: unifica singular y plural sin recortar palabras arbitrariamente", () => {
  const ahora = new Date("2026-11-23T11:00:00Z");
  const opciones = { ahora, meses: 1 };

  const ranking = nombres => calcularEstadisticas(
    nombres.map((nombre, i) => movimiento("tirado", `2026-11-${20 + i}`, nombre)),
    opciones
  ).masTirados;

  // Tomate/Tomates en ambos órdenes y conservando el primer nombre visible.
  assert.deepEqual(ranking(["Tomate", "Tomates"]), [{ nombre: "Tomate", veces: 2 }]);
  assert.deepEqual(ranking(["Tomates", "Tomate"]), [{ nombre: "Tomates", veces: 2 }]);

  // Yogur/Yogures en ambos órdenes.
  assert.deepEqual(ranking(["Yogur", "Yogures"]), [{ nombre: "Yogur", veces: 2 }]);
  assert.deepEqual(ranking(["Yogures", "Yogur"]), [{ nombre: "Yogures", veces: 2 }]);

  // Mayúsculas, tildes y espacios no impiden la agrupación.
  assert.deepEqual(ranking(["Tomate", "  TOMATES "]), [{ nombre: "Tomate", veces: 2 }]);
  assert.deepEqual(ranking(["Yógur", "YOGURES"]), [{ nombre: "Yógur", veces: 2 }]);

  // Nombres compuestos: plurales equivalentes, pero sin mezclar productos distintos.
  assert.deepEqual(
    ranking(["Tomate frito", "Tomates fritos", "Tomate cherry", "Leche", "Lechuga"]),
    [
      { nombre: "Tomate frito", veces: 2 },
      { nombre: "Leche", veces: 1 },
      { nombre: "Lechuga", veces: 1 },
      { nombre: "Tomate cherry", veces: 1 }
    ]
  );

  // No se muta la entrada y solo cuentan los «tirado» dentro del periodo.
  const movimientos = [
    movimiento("tirado", "2026-11-20", "Tomate"),
    movimiento("tirado", "2026-11-21", "Tomates", true),
    movimiento("terminado", "2026-11-22", "Tomates"),
    movimiento("consumo", "2026-11-23", "Tomates"),
    movimiento("tirado", "2026-10-31", "Tomates"),
    movimiento("tirado", "2026-12-01", "Tomates")
  ];
  const copia = movimientos.map(m => ({ ...m, fecha: new Date(m.fecha) }));

  const datos = calcularEstadisticas(movimientos, opciones);

  assert.deepEqual(movimientos, copia);
  assert.deepEqual(datos.masTirados, [{ nombre: "Tomate", veces: 2 }]);
  assert.deepEqual(datos.mensual, [
    { mes: "2026-11", terminados: 1, tirados: 2, consumos: 1 }
  ]);
  assert.equal(datos.totales.tirados, 2);
  assert.equal(datos.totales.tiradosCaducados, 1);
});

test("Estadísticas: sin datos, el aprovechamiento es null", () => {
  const datos = calcularEstadisticas([], { ahora: AHORA, meses: 6 });

  assert.equal(datos.totales.aprovechamiento, null);
  assert.equal(datos.mensual.length, 6);
  assert.equal(datos.desde, "2025-10");
});

test("Movimientos: consumir, terminar y tirar quedan registrados", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  const leche = await sistema.crearAlimento(email, { nombre: "Leche", cantidad: 2 }, AHORA);
  const yogur = await sistema.crearAlimento(email, {
    nombre: "Yogur", cantidad: 4, fechaCaducidad: "2026-03-01"
  }, AHORA);
  const error = await sistema.crearAlimento(email, { nombre: "Error", cantidad: 1 }, AHORA);

  await sistema.ajustarCantidad(email, leche.id, { delta: -1 }, AHORA);
  await sistema.ajustarCantidad(email, leche.id, { delta: 3 }, AHORA); // sumar no cuenta
  await sistema.eliminarAlimento(email, leche.id, "terminado", AHORA);
  await sistema.eliminarAlimento(email, yogur.id, "tirado", AHORA);
  await sistema.eliminarAlimento(email, error.id, undefined, AHORA);

  const datos = await sistema.obtenerEstadisticas(email, 1, AHORA);

  assert.deepEqual(datos.totales, {
    terminados: 1,
    tirados: 1,
    consumos: 1,
    tiradosCaducados: 1,
    aprovechamiento: 50
  });
});

test("Movimientos: el motivo se valida y no se registra si el alimento no existe", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  const pan = await sistema.crearAlimento(email, { nombre: "Pan", cantidad: 1 }, AHORA);

  await assert.rejects(
    sistema.eliminarAlimento(email, pan.id, "regalado", AHORA),
    { estadoHTTP: 400 }
  );

  await assert.rejects(
    sistema.eliminarAlimento("luis@example.com", pan.id, "tirado", AHORA),
    { estadoHTTP: 404 }
  );

  const datos = await sistema.obtenerEstadisticas(email, 1, AHORA);
  assert.equal(datos.totales.tirados, 0);

  for (const meses of [0, 13, "seis", 2.5]) {
    await assert.rejects(
      sistema.obtenerEstadisticas(email, meses, AHORA),
      { estadoHTTP: 400 }
    );
  }
});

test("Movimientos: el historial se comparte con el hogar", async () => {
  const { sistema } = await preparar();

  const pan = await sistema.crearAlimento("luis@example.com", { nombre: "Pan", cantidad: 1 }, AHORA);
  await sistema.eliminarAlimento("luis@example.com", pan.id, "tirado", AHORA);

  const { codigo } = await sistema.crearInvitacionHogar("ana@example.com", AHORA);
  await sistema.unirseHogar("luis@example.com", codigo, AHORA);

  const datos = await sistema.obtenerEstadisticas("ana@example.com", 1, AHORA);
  assert.equal(datos.totales.tirados, 1);
});

test("CSV: escapa separadores, comillas y fórmulas", () => {
  assert.equal(celdaCsv("Leche; entera"), '"Leche; entera"');
  assert.equal(celdaCsv('Queso "curado"'), '"Queso ""curado"""');
  assert.equal(celdaCsv("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(celdaCsv("-2+3"), "'-2+3");
  assert.equal(celdaCsv(0.25), "0,25");
  assert.equal(celdaCsv(-1), "-1");
  assert.equal(celdaCsv(null), "");
});

test("CSV: la despensa lleva BOM, cabecera y una fila por alimento", () => {
  const csv = csvDespensa([{
    nombre: "Leche",
    cantidad: 1.5,
    unidad: "l",
    categoria: "lácteos y huevos",
    ubicacion: "nevera",
    fechaCaducidad: "2026-03-12",
    estadoCaducidad: "proximo",
    stockMinimo: null,
    codigoBarras: "8410188012153"
  }]);

  assert.ok(csv.startsWith("﻿Alimento;Cantidad;Unidad;"));
  assert.ok(csv.includes("Leche;1,5;l;lácteos y huevos;nevera;2026-03-12;Caduca pronto;;8410188012153\r\n"));
});

test("API estadísticas y exportación: requieren sesión y responden", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  await request(app).get("/api/estadisticas").expect(401);
  await request(app).get("/api/exportar/despensa.csv").expect(401);

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  const agente = request.agent(app);
  await agente
    .post("/api/login")
    .send({ email: "ana@example.com", password: "ClavePrueba123" })
    .expect(200);

  const creado = await agente.post("/api/alimentos").send({ nombre: "Pan", cantidad: 1 }).expect(201);

  await agente.delete(`/api/alimentos/${creado.body.alimento.id}?motivo=regalado`).expect(400);
  await agente.delete(`/api/alimentos/${creado.body.alimento.id}?motivo=tirado`).expect(200);

  const datos = await agente.get("/api/estadisticas?meses=3").expect(200);
  assert.equal(datos.body.totales.tirados, 1);
  assert.equal(datos.body.mensual.length, 3);

  await agente.get("/api/estadisticas?meses=99").expect(400);

  const csv = await agente.get("/api/exportar/historial.csv").expect(200);
  assert.match(csv.headers["content-type"], /^text\/csv; charset=utf-8/);
  assert.match(csv.headers["content-disposition"], /^attachment; filename="historial-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.match(csv.text, /Tirado;Pan;1;unidades/);

  await agente.get("/api/exportar/despensa.csv").expect(200);
});

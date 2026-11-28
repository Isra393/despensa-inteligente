const test = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");
const {
  esFechaValida,
  estadoCaducidad,
  validarDatosAlimento,
  tieneExistencias
} = require("./alimentos");

// 10 de marzo de 2026 a mediodía en España.
const AHORA = new Date("2026-03-10T11:00:00Z");

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  await cad.guardar({
    id: "11111111-1111-4111-8111-111111111111",
    email: "ana@example.com",
    rol: "usuario",
    estado: "activo"
  });

  await cad.guardar({
    id: "22222222-2222-4222-8222-222222222222",
    email: "luis@example.com",
    rol: "usuario",
    estado: "activo"
  });

  await cad.guardar({
    id: "33333333-3333-4333-8333-333333333333",
    email: "pendiente@example.com",
    rol: "usuario",
    estado: "pendiente"
  });

  return { cad, sistema };
}

const leche = {
  nombre: "  Leche entera ",
  cantidad: 2,
  unidad: "l",
  categoria: "lácteos y huevos",
  fechaCaducidad: "2026-03-12"
};

test("Fechas: acepta fechas reales y rechaza las inexistentes", () => {
  assert.equal(esFechaValida("2026-02-28"), true);
  assert.equal(esFechaValida("2028-02-29"), true);
  assert.equal(esFechaValida("2026-02-29"), false);
  assert.equal(esFechaValida("2026-13-01"), false);
  assert.equal(esFechaValida("10/03/2026"), false);
  assert.equal(esFechaValida(20260310), false);
});

test("Caducidad: clasifica caducado, próximo, vigente y sin fecha", () => {
  assert.deepEqual(estadoCaducidad("2026-03-09", AHORA), {
    estado: "caducado",
    diasRestantes: -1
  });
  assert.deepEqual(estadoCaducidad("2026-03-10", AHORA), {
    estado: "proximo",
    diasRestantes: 0
  });
  assert.deepEqual(estadoCaducidad("2026-03-13", AHORA), {
    estado: "proximo",
    diasRestantes: 3
  });
  assert.deepEqual(estadoCaducidad("2026-03-14", AHORA), {
    estado: "vigente",
    diasRestantes: 4
  });
  assert.deepEqual(estadoCaducidad(null, AHORA), {
    estado: "sin_fecha",
    diasRestantes: null
  });
});

test("Caducidad: usa el día de España y no el de UTC", () => {
  // 23:30 UTC del día 9 ya es día 10 en Madrid (UTC+1).
  const nocheUTC = new Date("2026-03-09T23:30:00Z");

  assert.equal(estadoCaducidad("2026-03-09", nocheUTC).estado, "caducado");
});

test("Validación: limpia los datos y aplica valores por defecto", () => {
  const { datos } = validarDatosAlimento({
    nombre: " Arroz ",
    cantidad: 1
  });

  assert.deepEqual(datos, {
    nombre: "Arroz",
    cantidad: 1,
    unidad: "unidades",
    categoria: "otros",
    ubicacion: "despensa",
    fechaCaducidad: null,
    stockMinimo: null,
    codigoBarras: null
  });
});

test("Validación: rechaza datos incorrectos", () => {
  const casos = [
    null,
    [],
    { nombre: "", cantidad: 1 },
    { nombre: "x".repeat(81), cantidad: 1 },
    { nombre: "Pan", cantidad: -1 },
    { nombre: "Pan", cantidad: "2" },
    { nombre: "Pan", cantidad: Infinity },
    { nombre: "Pan", cantidad: 1.5, unidad: "unidades" },
    { nombre: "Pan", cantidad: 1, unidad: "toneladas" },
    { nombre: "Pan", cantidad: 1, categoria: "juguetes" },
    { nombre: "Pan", cantidad: 1, fechaCaducidad: "mañana" }
  ];

  for (const caso of casos) {
    assert.ok(
      validarDatosAlimento(caso).error,
      `Debería rechazar ${JSON.stringify(caso)}`
    );
  }
});

test("Validación: ignora campos no permitidos", () => {
  const { datos } = validarDatosAlimento({
    nombre: "Pan",
    cantidad: 1,
    usuarioId: "otro",
    id: "falso",
    rol: "administrador"
  });

  assert.equal(datos.usuarioId, undefined);
  assert.equal(datos.id, undefined);
  assert.equal(datos.rol, undefined);
});

test("Alimentos: crea y lista con estado de caducidad", async () => {
  const { sistema } = await preparar();

  const creado = await sistema.crearAlimento(
    "ana@example.com",
    leche,
    AHORA
  );

  assert.equal(creado.nombre, "Leche entera");
  assert.equal(creado.estadoCaducidad, "proximo");
  assert.equal(creado.diasRestantes, 2);
  assert.equal(creado.usuarioId, undefined);

  const { alimentos, resumen } = await sistema.listarAlimentos(
    "ana@example.com",
    AHORA
  );

  assert.equal(alimentos.length, 1);
  assert.deepEqual(resumen, {
    total: 1,
    caducados: 0,
    proximos: 1,
    porUbicacion: { nevera: 0, congelador: 0, despensa: 1 }
  });
});

test("Alimentos: ordena por caducidad y deja al final los que no tienen fecha", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  await sistema.crearAlimento(email, { nombre: "Sal", cantidad: 1 }, AHORA);
  await sistema.crearAlimento(
    email,
    { nombre: "Yogur", cantidad: 4, fechaCaducidad: "2026-03-20" },
    AHORA
  );
  await sistema.crearAlimento(
    email,
    { nombre: "Queso", cantidad: 1, fechaCaducidad: "2026-03-01" },
    AHORA
  );

  const { alimentos, resumen } = await sistema.listarAlimentos(email, AHORA);

  assert.deepEqual(
    alimentos.map(a => a.nombre),
    ["Queso", "Yogur", "Sal"]
  );
  assert.deepEqual(resumen, {
    total: 3,
    caducados: 1,
    proximos: 0,
    porUbicacion: { nevera: 0, congelador: 0, despensa: 3 }
  });
});

test("Alimentos: cada usuario solo ve y modifica los suyos", async () => {
  const { sistema } = await preparar();

  const deAna = await sistema.crearAlimento(
    "ana@example.com",
    leche,
    AHORA
  );

  const deLuis = await sistema.listarAlimentos("luis@example.com", AHORA);
  assert.equal(deLuis.alimentos.length, 0);

  await assert.rejects(
    sistema.actualizarAlimento(
      "luis@example.com",
      deAna.id,
      { nombre: "Robado", cantidad: 0 }
    ),
    { estadoHTTP: 404 }
  );

  await assert.rejects(
    sistema.eliminarAlimento("luis@example.com", deAna.id),
    { estadoHTTP: 404 }
  );

  const { alimentos } = await sistema.listarAlimentos(
    "ana@example.com",
    AHORA
  );
  assert.equal(alimentos[0].nombre, "Leche entera");
});

test("Alimentos: actualiza conservando la fecha de creación", async () => {
  const { sistema } = await preparar();
  const despues = new Date("2026-03-11T09:00:00Z");

  const creado = await sistema.crearAlimento(
    "ana@example.com",
    leche,
    AHORA
  );

  const actualizado = await sistema.actualizarAlimento(
    "ana@example.com",
    creado.id,
    { ...leche, cantidad: 0.5 },
    despues
  );

  assert.equal(actualizado.id, creado.id);
  assert.equal(actualizado.cantidad, 0.5);
  assert.deepEqual(actualizado.creadoEn, AHORA);
  assert.deepEqual(actualizado.actualizadoEn, despues);
});

test("Alimentos: elimina y después devuelve 404", async () => {
  const { sistema } = await preparar();

  const creado = await sistema.crearAlimento(
    "ana@example.com",
    leche,
    AHORA
  );

  await sistema.eliminarAlimento("ana@example.com", creado.id);

  await assert.rejects(
    sistema.eliminarAlimento("ana@example.com", creado.id),
    { estadoHTTP: 404 }
  );
});

test("Alimentos: rechaza identificadores con formato incorrecto", async () => {
  const { sistema } = await preparar();

  await assert.rejects(
    sistema.eliminarAlimento("ana@example.com", "../usuarios"),
    { estadoHTTP: 404 }
  );
});

test("Alimentos: exige una cuenta activa", async () => {
  const { sistema } = await preparar();

  await assert.rejects(
    sistema.crearAlimento("pendiente@example.com", leche),
    { estadoHTTP: 401 }
  );
});

test("Alimentos: limita el número de alimentos por usuario", async () => {
  const { cad, sistema } = await preparar();

  // Simula una despensa llena sin crear 500 registros.
  cad.contarAlimentos = async () => 500;

  await assert.rejects(
    sistema.crearAlimento("ana@example.com", leche),
    { estadoHTTP: 409 }
  );
});

test("Ubicaciones: valida y usa despensa por defecto", () => {
  for (const ubicacion of ["nevera", "congelador", "despensa"]) {
    assert.equal(
      validarDatosAlimento({ nombre: "Pan", cantidad: 1, ubicacion })
        .datos.ubicacion,
      ubicacion
    );
  }

  for (const ubicacion of ["armario", "", 3, null]) {
    const resultado = validarDatosAlimento({
      nombre: "Pan", cantidad: 1, ubicacion
    });

    // null equivale a no indicarla: se usa la despensa.
    if (ubicacion === null) {
      assert.equal(resultado.datos.ubicacion, "despensa");
    } else {
      assert.ok(resultado.error, `Debería rechazar ${ubicacion}`);
    }
  }
});

test("Ubicaciones: cuenta los alimentos de cada sitio", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  await sistema.crearAlimento(email, { nombre: "Leche", cantidad: 1, ubicacion: "nevera" });
  await sistema.crearAlimento(email, { nombre: "Yogur", cantidad: 4, ubicacion: "nevera" });
  await sistema.crearAlimento(email, { nombre: "Guisantes", cantidad: 1, ubicacion: "congelador" });
  await sistema.crearAlimento(email, { nombre: "Arroz", cantidad: 1 });

  const { resumen, alimentos } = await sistema.listarAlimentos(email, AHORA);

  assert.deepEqual(resumen.porUbicacion, {
    nevera: 2,
    congelador: 1,
    despensa: 1
  });
  assert.equal(alimentos.find(a => a.nombre === "Arroz").ubicacion, "despensa");
});

test("Ubicaciones: los alimentos antiguos sin ubicación son de la despensa", async () => {
  const { cad, sistema } = await preparar();

  // Alimento guardado antes de existir el campo.
  await cad.guardarAlimento({
    id: "44444444-4444-4444-8444-444444444444",
    usuarioId: "11111111-1111-4111-8111-111111111111",
    nombre: "Lentejas",
    cantidad: 1,
    unidad: "kg",
    categoria: "despensa seca",
    fechaCaducidad: null,
    creadoEn: AHORA,
    actualizadoEn: AHORA
  });

  const { alimentos, resumen } = await sistema.listarAlimentos(
    "ana@example.com",
    AHORA
  );

  assert.equal(alimentos[0].ubicacion, "despensa");
  assert.equal(resumen.porUbicacion.despensa, 1);
});

test("Ubicaciones: se puede mover un alimento", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";
  const datos = { nombre: "Pan", cantidad: 1, ubicacion: "despensa" };

  const pan = await sistema.crearAlimento(email, datos);
  const movido = await sistema.actualizarAlimento(
    email, pan.id, { ...datos, ubicacion: "congelador" }
  );

  assert.equal(movido.ubicacion, "congelador");
});

test("Existencias: solo cuentan las cantidades mayores que 0", () => {
  assert.equal(tieneExistencias({ cantidad: 1 }), true);
  assert.equal(tieneExistencias({ cantidad: 0.001 }), true);
  assert.equal(tieneExistencias({ cantidad: 0 }), false);
  assert.equal(tieneExistencias({ cantidad: -1 }), false);
  assert.equal(tieneExistencias({ cantidad: Number.NaN }), false);
  assert.equal(tieneExistencias({ cantidad: "2" }), false);
  assert.equal(tieneExistencias({}), false);
});

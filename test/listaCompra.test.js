const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("../servidor/app");
const { Sistema } = require("../servidor/modelo");
const { CadMemoria } = require("../servidor/cadMemoria");
const { validarDatosAlimento } = require("../servidor/alimentos");
const { validarElementoLista } = require("../servidor/listaCompra");

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

test("Stock mínimo: opcional y validado", () => {
  assert.equal(
    validarDatosAlimento({ nombre: "Pan", cantidad: 1 }).datos.stockMinimo,
    null
  );

  assert.equal(
    validarDatosAlimento({ nombre: "Pan", cantidad: 1, stockMinimo: "" })
      .datos.stockMinimo,
    null
  );

  assert.equal(
    validarDatosAlimento({
      nombre: "Leche", cantidad: 1, unidad: "l", stockMinimo: 0.5
    }).datos.stockMinimo,
    0.5
  );

  for (const stockMinimo of [-1, "2", 100001, 1.5]) {
    assert.ok(
      validarDatosAlimento({ nombre: "Pan", cantidad: 1, stockMinimo }).error,
      `Debería rechazar ${stockMinimo}`
    );
  }
});

test("Elemento manual: valida nombre y cantidad", () => {
  assert.deepEqual(
    validarElementoLista({ nombre: " Huevos ", cantidad: " 12 " }).datos,
    { nombre: "Huevos", cantidad: "12" }
  );

  assert.deepEqual(
    validarElementoLista({ nombre: "Sal" }).datos,
    { nombre: "Sal", cantidad: null }
  );

  for (const datos of [
    null,
    { nombre: "" },
    { nombre: "x".repeat(81) },
    { nombre: "Pan", cantidad: 2 },
    { nombre: "Pan", cantidad: "x".repeat(41) }
  ]) {
    assert.ok(validarElementoLista(datos).error);
  }
});

test("Lista: incluye los alimentos que llegan a su mínimo", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  await sistema.crearAlimento(email, {
    nombre: "Leche", cantidad: 1, unidad: "l", stockMinimo: 1
  });
  await sistema.crearAlimento(email, {
    nombre: "Arroz", cantidad: 2, unidad: "kg", stockMinimo: 1
  });
  await sistema.crearAlimento(email, {
    nombre: "Huevos", cantidad: 0, stockMinimo: 0
  });
  await sistema.crearAlimento(email, { nombre: "Sal", cantidad: 0 });

  const { automaticos } = await sistema.obtenerListaCompra(email);

  assert.deepEqual(automaticos.map(a => a.nombre), ["Huevos", "Leche"]);
  assert.equal(automaticos[1].stockMinimo, 1);
});

test("Lista: el alimento sale al reponerlo", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";
  const datos = { nombre: "Leche", cantidad: 0, unidad: "l", stockMinimo: 1 };

  const leche = await sistema.crearAlimento(email, datos);
  assert.equal(leche.bajoMinimo, true);

  const repuesta = await sistema.actualizarAlimento(
    email, leche.id, { ...datos, cantidad: 4 }
  );
  assert.equal(repuesta.bajoMinimo, false);

  const { automaticos } = await sistema.obtenerListaCompra(email);
  assert.equal(automaticos.length, 0);
});

test("Lista: añade, marca, borra y vacía los comprados", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";
  const t = i => new Date(Date.UTC(2026, 2, 10, 10, i));

  const pan = await sistema.agregarElementoLista(email, { nombre: "Pan" }, t(1));
  const tomates = await sistema.agregarElementoLista(
    email, { nombre: "Tomates", cantidad: "1 kg" }, t(2)
  );
  await sistema.agregarElementoLista(email, { nombre: "Café" }, t(3));

  await sistema.marcarElementoLista(email, pan.id, { comprado: true });

  // Los comprados van al final.
  let { manuales } = await sistema.obtenerListaCompra(email);
  assert.deepEqual(manuales.map(e => e.nombre), ["Tomates", "Café", "Pan"]);
  assert.equal(manuales[0].cantidad, "1 kg");

  await sistema.eliminarElementoLista(email, tomates.id);

  assert.deepEqual(
    await sistema.eliminarElementosComprados(email),
    { eliminados: 1 }
  );

  ({ manuales } = await sistema.obtenerListaCompra(email));
  assert.deepEqual(manuales.map(e => e.nombre), ["Café"]);
});

test("Lista: cada usuario solo ve y modifica la suya", async () => {
  const { sistema } = await preparar();

  const pan = await sistema.agregarElementoLista(
    "ana@example.com", { nombre: "Pan" }
  );

  const deLuis = await sistema.obtenerListaCompra("luis@example.com");
  assert.equal(deLuis.manuales.length, 0);

  await assert.rejects(
    sistema.marcarElementoLista("luis@example.com", pan.id, { comprado: true }),
    { estadoHTTP: 404 }
  );

  await assert.rejects(
    sistema.eliminarElementoLista("luis@example.com", pan.id),
    { estadoHTTP: 404 }
  );

  // Vaciar comprados no afecta a otros usuarios.
  await sistema.marcarElementoLista(
    "ana@example.com", pan.id, { comprado: true }
  );
  assert.deepEqual(
    await sistema.eliminarElementosComprados("luis@example.com"),
    { eliminados: 0 }
  );
});

test("Lista: valida el marcado y limita el tamaño", async () => {
  const { cad, sistema } = await preparar();
  const email = "ana@example.com";

  const pan = await sistema.agregarElementoLista(email, { nombre: "Pan" });

  await assert.rejects(
    sistema.marcarElementoLista(email, pan.id, { comprado: "sí" }),
    { estadoHTTP: 400 }
  );

  cad.contarElementosLista = async () => 200;

  await assert.rejects(
    sistema.agregarElementoLista(email, { nombre: "Más" }),
    { estadoHTTP: 409 }
  );
});

test("API lista de la compra: flujo completo con sesión", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  await request(app).get("/api/lista-compra").expect(401);

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  const agente = request.agent(app);
  await agente
    .post("/api/login")
    .send({ email: "ana@example.com", password: "ClavePrueba123" })
    .expect(200);

  await agente
    .post("/api/alimentos")
    .send({ nombre: "Leche", cantidad: 0, unidad: "l", stockMinimo: 1 })
    .expect(201);

  const creado = await agente
    .post("/api/lista-compra")
    .send({ nombre: "Pan" })
    .expect(201);

  const id = creado.body.elemento.id;

  await agente
    .patch(`/api/lista-compra/${id}`)
    .send({ comprado: true })
    .expect(200);

  const lista = await agente.get("/api/lista-compra").expect(200);
  assert.equal(lista.body.automaticos[0].nombre, "Leche");
  assert.equal(lista.body.manuales[0].comprado, true);

  const vaciado = await agente.delete("/api/lista-compra/comprados").expect(200);
  assert.deepEqual(vaciado.body, { eliminados: 1 });

  await agente.delete(`/api/lista-compra/${id}`).expect(404);
  await agente.post("/api/lista-compra").send({ nombre: "" }).expect(400);
});

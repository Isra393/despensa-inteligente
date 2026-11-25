const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");
const { validarAjuste } = require("./alimentos");

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

test("Ajuste: valida el valor según la unidad", () => {
  assert.equal(validarAjuste(-1, "unidades"), null);
  assert.equal(validarAjuste(0.25, "l"), null);

  for (const [delta, unidad] of [
    [0, "g"], [-0.5, "unidades"], ["1", "g"], [Infinity, "g"], [200000, "g"]
  ]) {
    assert.ok(validarAjuste(delta, unidad), `Debería rechazar ${delta} ${unidad}`);
  }
});

test("Ajuste: resta y suma sin pasar por el formulario", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  const huevos = await sistema.crearAlimento(email, { nombre: "Huevos", cantidad: 6 });
  assert.equal(huevos.paso, 1);

  let resultado = await sistema.ajustarCantidad(email, huevos.id, { delta: -1 });
  assert.equal(resultado.alimento.cantidad, 5);
  assert.equal(resultado.consumido, 1);

  resultado = await sistema.ajustarCantidad(email, huevos.id, { delta: 2 });
  assert.equal(resultado.alimento.cantidad, 7);
  assert.equal(resultado.consumido, 0);
});

test("Ajuste: nunca baja de 0 y avisa si ya no queda", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  const leche = await sistema.crearAlimento(email, {
    nombre: "Leche", cantidad: 0.1, unidad: "l"
  });
  assert.equal(leche.paso, 0.25);

  const { alimento, consumido } = await sistema.ajustarCantidad(
    email, leche.id, { delta: -0.25 }
  );

  assert.equal(alimento.cantidad, 0);
  assert.equal(consumido, 0.1);

  await assert.rejects(
    sistema.ajustarCantidad(email, leche.id, { delta: -0.25 }),
    { estadoHTTP: 409 }
  );
});

test("Ajuste: evita errores de redondeo con decimales", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  const aceite = await sistema.crearAlimento(email, {
    nombre: "Aceite", cantidad: 1, unidad: "l"
  });

  let cantidad;
  for (let i = 0; i < 3; i++) {
    ({ alimento: { cantidad } } = await sistema.ajustarCantidad(
      email, aceite.id, { delta: -0.1 }
    ));
  }

  assert.equal(cantidad, 0.7);
});

test("Ajuste: actualiza la lista de la compra al llegar al mínimo", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  const pan = await sistema.crearAlimento(email, {
    nombre: "Pan", cantidad: 2, stockMinimo: 1
  });

  const { alimento } = await sistema.ajustarCantidad(email, pan.id, { delta: -1 });
  assert.equal(alimento.bajoMinimo, true);

  const { automaticos } = await sistema.obtenerListaCompra(email);
  assert.deepEqual(automaticos.map(a => a.nombre), ["Pan"]);
});

test("Ajuste: solo el propietario puede cambiar la cantidad", async () => {
  const { sistema } = await preparar();

  const pan = await sistema.crearAlimento("ana@example.com", {
    nombre: "Pan", cantidad: 2
  });

  await assert.rejects(
    sistema.ajustarCantidad("luis@example.com", pan.id, { delta: -1 }),
    { estadoHTTP: 404 }
  );

  await assert.rejects(
    sistema.ajustarCantidad("ana@example.com", pan.id, { delta: -0.5 }),
    { estadoHTTP: 400 }
  );
});

test("API ajuste de cantidad: requiere sesión y responde con el alimento", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  const agente = request.agent(app);
  await agente
    .post("/api/login")
    .send({ email: "ana@example.com", password: "ClavePrueba123" })
    .expect(200);

  const creado = await agente
    .post("/api/alimentos")
    .send({ nombre: "Yogur", cantidad: 4 })
    .expect(201);

  const ruta = `/api/alimentos/${creado.body.alimento.id}/cantidad`;

  await request(app).patch(ruta).send({ delta: -1 }).expect(401);

  const respuesta = await agente.patch(ruta).send({ delta: -1 }).expect(200);
  assert.equal(respuesta.body.alimento.cantidad, 3);
  assert.equal(respuesta.body.consumido, 1);

  await agente.patch(ruta).send({ delta: "mucho" }).expect(400);
});

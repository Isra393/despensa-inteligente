const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  for (const email of ["ana@example.com", "luis@example.com"]) {
    await sistema.registrarUsuario(email, "ClavePrueba123");
    const usuario = await cad.buscarPorEmail(email);
    await cad.guardar({ ...usuario, estado: "activo" });
  }

  async function iniciar(email) {
    const agente = request.agent(app);

    await agente
      .post("/api/login")
      .send({ email, password: "ClavePrueba123" })
      .expect(200);

    return agente;
  }

  return { app, iniciar };
}

const pan = {
  nombre: "Pan de molde",
  cantidad: 1,
  unidad: "unidades",
  categoria: "panadería",
  fechaCaducidad: "2099-01-01"
};

test("API alimentos: exige sesión iniciada", async () => {
  const { app } = await preparar();

  await request(app).get("/api/alimentos").expect(401);
  await request(app).post("/api/alimentos").send(pan).expect(401);
});

test("API alimentos: crea, lista, actualiza y elimina", async () => {
  const { iniciar } = await preparar();
  const ana = await iniciar("ana@example.com");

  const creado = await ana
    .post("/api/alimentos")
    .send(pan)
    .expect(201);

  const id = creado.body.alimento.id;
  assert.equal(creado.body.alimento.estadoCaducidad, "vigente");

  const lista = await ana.get("/api/alimentos").expect(200);
  assert.equal(lista.body.alimentos.length, 1);
  assert.equal(lista.body.resumen.total, 1);

  const actualizado = await ana
    .put(`/api/alimentos/${id}`)
    .send({ ...pan, cantidad: 3 })
    .expect(200);

  assert.equal(actualizado.body.alimento.cantidad, 3);

  await ana.delete(`/api/alimentos/${id}`).expect(200);

  const vacia = await ana.get("/api/alimentos").expect(200);
  assert.equal(vacia.body.alimentos.length, 0);
});

test("API alimentos: valida los datos recibidos", async () => {
  const { iniciar } = await preparar();
  const ana = await iniciar("ana@example.com");

  const respuesta = await ana
    .post("/api/alimentos")
    .send({ nombre: "", cantidad: 1 })
    .expect(400);

  assert.match(respuesta.body.error, /nombre/);
});

test("API alimentos: otro usuario no puede modificar ni borrar", async () => {
  const { iniciar } = await preparar();
  const ana = await iniciar("ana@example.com");
  const luis = await iniciar("luis@example.com");

  const creado = await ana.post("/api/alimentos").send(pan).expect(201);
  const id = creado.body.alimento.id;

  await luis
    .put(`/api/alimentos/${id}`)
    .send({ ...pan, nombre: "Cambiado" })
    .expect(404);

  await luis.delete(`/api/alimentos/${id}`).expect(404);

  const listaLuis = await luis.get("/api/alimentos").expect(200);
  assert.equal(listaLuis.body.alimentos.length, 0);

  const listaAna = await ana.get("/api/alimentos").expect(200);
  assert.equal(listaAna.body.alimentos[0].nombre, "Pan de molde");
});

test("API alimentos: tras cerrar sesión ya no hay acceso", async () => {
  const { iniciar } = await preparar();
  const ana = await iniciar("ana@example.com");

  await ana.post("/api/logout").expect(200);
  await ana.get("/api/alimentos").expect(401);
});

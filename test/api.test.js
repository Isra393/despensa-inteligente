const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { crearApp } = require("../servidor/app");

test("Crear y listar usuarios mediante la API", async () => {
  const app = crearApp();

  const alta = await request(app)
    .post("/api/usuarios")
    .send({ email: "ana@example.com" });

  assert.equal(alta.status, 201);
  assert.equal(alta.body.email, "ana@example.com");
  assert.equal(alta.body.estado, "pendiente");

  const listado = await request(app).get("/api/usuarios");

  assert.equal(listado.status, 200);
  assert.equal(listado.body.length, 1);
  assert.equal(listado.body[0].email, "ana@example.com");
});

test("Un registro duplicado devuelve 409", async () => {
  const app = crearApp();

  await request(app)
    .post("/api/usuarios")
    .send({ email: "ana@example.com" });

  const respuesta = await request(app)
    .post("/api/usuarios")
    .send({ email: "ana@example.com" });

  assert.equal(respuesta.status, 409);
  assert.equal(respuesta.body.error, "El email ya está registrado");
});

test("Un registro sin email devuelve 400", async () => {
  const respuesta = await request(crearApp())
    .post("/api/usuarios")
    .send({});

  assert.equal(respuesta.status, 400);
  assert.equal(respuesta.body.error, "El email es obligatorio");
});

test("Consultar y eliminar una cuenta mediante la API", async () => {
  const app = crearApp();

  await request(app)
    .post("/api/usuarios")
    .send({ email: "ana@example.com" });

  const consulta = await request(app)
    .get("/api/usuarios/ana%40example.com/activo");

  assert.equal(consulta.status, 200);
  assert.equal(consulta.body.activo, false);

  const eliminacion = await request(app)
    .delete("/api/usuarios/ana%40example.com");

  assert.equal(eliminacion.status, 200);

  const segundaEliminacion = await request(app)
    .delete("/api/usuarios/ana%40example.com");

  assert.equal(segundaEliminacion.status, 404);
});

test("Un JSON incorrecto devuelve 400", async () => {
  const respuesta = await request(crearApp())
    .post("/api/usuarios")
    .set("Content-Type", "application/json")
    .send('{"email":');

  assert.equal(respuesta.status, 400);
  assert.equal(respuesta.body.error, "El JSON no es válido");
});
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { randomBytes } = require("node:crypto");
const { crearApp: crearAppBase } = require("../servidor/app");

function crearApp() {
  return crearAppBase(undefined, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });
}

test("La API de salud responde correctamente", async () => {
  const respuesta = await request(crearApp())
    .get("/api/salud");

  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.body, {
    estado: "ok",
    aplicacion: "Despensa Inteligente"
  });
});

test("El servidor sirve la página de bienvenida", async () => {
  const respuesta = await request(crearApp())
    .get("/");

  assert.equal(respuesta.status, 200);
  assert.match(respuesta.headers["content-type"], /text\/html/);
  assert.match(respuesta.text, /Despensa Inteligente/);
});
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { randomBytes } = require("node:crypto");
const { crearApp: crearAppBase } = require("./app");

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
test("La página enlaza estilos y scripts que el servidor entrega", async () => {
  const app = crearApp();
  const pagina = await request(app).get("/");
  const recursos = [
    ...pagina.text.matchAll(/(?:href|src)="(\/(?:css|js)\/[^"]+)"/g)
  ].map((coincidencia) => coincidencia[1]);

  assert.ok(recursos.includes("/css/estilos.css"));
  assert.ok(recursos.includes("/js/controlWeb.js"));

  for (const recurso of recursos) {
    const respuesta = await request(app).get(recurso);
    assert.equal(respuesta.status, 200, `No se sirve ${recurso}`);
  }
});

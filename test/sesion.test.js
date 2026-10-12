const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { randomBytes } = require("node:crypto");
const { crearSesion } = require("../servidor/sesion");

function crearAppPrueba() {
  const app = express();

  app.use(crearSesion({
    secret: randomBytes(32).toString("hex")
  }));

  // Rutas exclusivas de esta prueba; no forman parte de la aplicación.
  app.post("/guardar", (req, res) => {
    req.session.usuario = "usuario-de-prueba";
    res.json({ guardado: true });
  });

  app.get("/consultar", (req, res) => {
    res.json({ usuario: req.session.usuario || null });
  });

  return app;
}

test("La sesión exige un secreto suficientemente largo", () => {
  assert.throws(
    () => crearSesion({ secret: "corto" }),
    /SESSION_SECRET/
  );
});

test("Una visita sin sesión no crea una cookie", async () => {
  const respuesta = await request(crearAppPrueba())
    .get("/consultar");

  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.usuario, null);
  assert.equal(respuesta.headers["set-cookie"], undefined);
});

test("La cookie permite recuperar la sesión entre peticiones", async () => {
  const app = crearAppPrueba();
  const cliente = request.agent(app);

  const guardado = await cliente.post("/guardar");

  assert.equal(guardado.status, 200);

  const cookie = guardado.headers["set-cookie"][0];

  assert.match(cookie, /despensa\.sid=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);

  const consulta = await cliente.get("/consultar");

  assert.equal(consulta.body.usuario, "usuario-de-prueba");

  // Otro cliente no comparte la sesión.
  const otroCliente = await request(app).get("/consultar");
  assert.equal(otroCliente.body.usuario, null);
});
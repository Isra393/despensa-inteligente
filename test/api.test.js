const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("../servidor/app");
const { Sistema } = require("../servidor/modelo");
const { CadMemoria } = require("../servidor/cadMemoria");

function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  return { app, cad, sistema };
}

async function prepararCuentaActiva(cad, sistema) {
  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");

  // Solo prepara datos de prueba; no existe una ruta de activación.
  await cad.guardar({ ...usuario, estado: "activo" });
}

test("El registro crea una cuenta pendiente sin devolver el hash", async () => {
  const { app } = preparar();

  const respuesta = await request(app)
    .post("/api/registro")
    .send({
      email: "ana@example.com",
      password: "ClavePrueba123"
    });

  assert.equal(respuesta.status, 201);
  assert.equal(respuesta.body.usuario.estado, "pendiente");
  assert.equal(respuesta.body.usuario.passwordHash, undefined);
});

test("El registro duplicado devuelve 409", async () => {
  const { app } = preparar();
  const datos = {
    email: "ana@example.com",
    password: "ClavePrueba123"
  };

  await request(app).post("/api/registro").send(datos);

  const respuesta = await request(app)
    .post("/api/registro")
    .send(datos);

  assert.equal(respuesta.status, 409);
});

test("Una cuenta pendiente no obtiene sesión", async () => {
  const { app } = preparar();
  const cliente = request.agent(app);
  const datos = {
    email: "ana@example.com",
    password: "ClavePrueba123"
  };

  await cliente.post("/api/registro").send(datos);

  const login = await cliente.post("/api/login").send(datos);
  assert.equal(login.status, 403);

  const sesion = await cliente.get("/api/sesion");
  assert.equal(sesion.status, 401);
});

test("Las rutas protegidas rechazan peticiones sin sesión", async () => {
  const { app } = preparar();

  for (const ruta of [
    "/api/sesion",
    "/api/usuarios",
    "/api/usuarios/ana%40example.com/activo"
  ]) {
    const respuesta = await request(app).get(ruta);
    assert.equal(respuesta.status, 401);
  }

  const eliminacion = await request(app)
    .delete("/api/usuarios/ana%40example.com");

  assert.equal(eliminacion.status, 401);
});

test("El login conserva la sesión y el logout invalida la cookie anterior", async () => {
  const { app, cad, sistema } = preparar();
  await prepararCuentaActiva(cad, sistema);

  const cliente = request.agent(app);

  const login = await cliente.post("/api/login").send({
    email: "ana@example.com",
    password: "ClavePrueba123"
  });

  assert.equal(login.status, 200);

  const cookieAnterior = login.headers["set-cookie"][0].split(";")[0];

  const sesion = await cliente.get("/api/sesion");
  assert.equal(sesion.status, 200);
  assert.equal(sesion.body.usuario.email, "ana@example.com");

  const logout = await cliente.post("/api/logout");
  assert.equal(logout.status, 200);

  const reutilizacion = await request(app)
    .get("/api/sesion")
    .set("Cookie", cookieAnterior);

  assert.equal(reutilizacion.status, 401);
});

test("Un usuario normal no puede listar ni eliminar otra cuenta", async () => {
  const { app, cad, sistema } = preparar();
  await prepararCuentaActiva(cad, sistema);

  const cliente = request.agent(app);

  await cliente.post("/api/login").send({
    email: "ana@example.com",
    password: "ClavePrueba123"
  });

  const listado = await cliente.get("/api/usuarios");
  assert.equal(listado.status, 403);

  const eliminacion = await cliente
    .delete("/api/usuarios/otra%40example.com");

  assert.equal(eliminacion.status, 403);
});

test("Un JSON incorrecto devuelve 400", async () => {
  const { app } = preparar();

  const respuesta = await request(app)
    .post("/api/registro")
    .set("Content-Type", "application/json")
    .send('{"email":');

  assert.equal(respuesta.status, 400);
});
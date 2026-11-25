const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");

function preparar() {
  const enviados = [];
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  const correo = {
    async enviarConfirmacion(email, token) {
      enviados.push({ email, token });
    }
  };

  const app = crearApp(sistema, {
    secret: "secreto-de-pruebas-con-al-menos-32-caracteres",
    produccion: false,
    correo
  });

  return { app, cad, enviados };
}

test("El registro envía el token sin exponerlo en la respuesta", async () => {
  const { app, cad, enviados } = preparar();

  const respuesta = await request(app)
    .post("/api/registro")
    .send({
      email: "correo@example.com",
      password: "ClavePrueba123"
    })
    .expect(201);

  assert.equal(respuesta.body.correoEnviado, true);
  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].email, "correo@example.com");

  assert.match(enviados[0].token, /^[a-f0-9]{64}$/);

  assert.equal(
    JSON.stringify(respuesta.body).includes(enviados[0].token),
    false
  );

  assert.equal(respuesta.body.usuario.passwordHash, undefined);
  assert.equal(
    respuesta.body.usuario.confirmacionTokenHash,
    undefined
  );

  const guardado = await cad.buscarPorEmail("correo@example.com");

  assert.equal(guardado.estado, "pendiente");
  assert.notEqual(
    guardado.confirmacionTokenHash,
    enviados[0].token
  );
});

test("La API confirma sin sesión y permite después iniciar sesión", async () => {
  const { app, enviados } = preparar();

  await request(app)
    .post("/api/registro")
    .send({
      email: "acceso@example.com",
      password: "ClavePrueba123"
    })
    .expect(201);

  await request(app)
    .post("/api/login")
    .send({
      email: "acceso@example.com",
      password: "ClavePrueba123"
    })
    .expect(403);

  await request(app)
    .post("/api/confirmar-cuenta")
    .send({ token: enviados[0].token })
    .expect(200);

  await request(app)
    .post("/api/login")
    .send({
      email: "acceso@example.com",
      password: "ClavePrueba123"
    })
    .expect(200);

  await request(app)
    .post("/api/confirmar-cuenta")
    .send({ token: enviados[0].token })
    .expect(400);
});

test("La API rechaza un token inventado", async () => {
  const { app } = preparar();

  await request(app)
    .post("/api/confirmar-cuenta")
    .send({ token: "a".repeat(64) })
    .expect(400);
});
test("El reenvío responde igual para una cuenta inexistente y una pendiente", async () => {
  const { app, cad, enviados } = preparar();

  await request(app)
    .post("/api/registro")
    .send({
      email: "reenvio@example.com",
      password: "ClavePrueba123"
    })
    .expect(201);

  const usuario = await cad.buscarPorEmail("reenvio@example.com");
  usuario.confirmacionEnviadaEn = new Date(Date.now() - 61000);
  await cad.guardar(usuario);

  const inexistente = await request(app)
    .post("/api/reenviar-confirmacion")
    .send({ email: "inexistente@example.com" })
    .expect(200);

  const pendiente = await request(app)
    .post("/api/reenviar-confirmacion")
    .send({ email: "reenvio@example.com" })
    .expect(200);

  assert.deepEqual(pendiente.body, inexistente.body);

  // Un envío del registro y otro del reenvío.
  assert.equal(enviados.length, 2);
  assert.notEqual(enviados[0].token, enviados[1].token);

  await request(app)
    .post("/api/confirmar-cuenta")
    .send({ token: enviados[0].token })
    .expect(400);

  await request(app)
    .post("/api/confirmar-cuenta")
    .send({ token: enviados[1].token })
    .expect(200);
});

test("El reenvío inmediato no envía un segundo correo", async () => {
  const { app, enviados } = preparar();

  await request(app)
    .post("/api/registro")
    .send({
      email: "espera@example.com",
      password: "ClavePrueba123"
    })
    .expect(201);

  await request(app)
    .post("/api/reenviar-confirmacion")
    .send({ email: "espera@example.com" })
    .expect(200);

  assert.equal(enviados.length, 1);
});
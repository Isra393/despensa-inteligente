const test = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");

function preparar() {
  const cad = new CadMemoria();
  return { cad, sistema: new Sistema(cad) };
}

function identidad(cambios = {}) {
  return {
    sub: "google-123",
    email: "google@example.com",
    email_verified: true,
    ...cambios
  };
}

test("Google: crea una cuenta activa con rol usuario", async () => {
  const { sistema, cad } = preparar();

  const usuario = await sistema.loginGoogle(identidad());

  assert.equal(usuario.email, "google@example.com");
  assert.equal(usuario.estado, "activo");
  assert.equal(usuario.rol, "usuario");

  const guardado = await cad.buscarPorEmail(usuario.email);

  assert.equal(guardado.googleSub, "google-123");
  assert.equal(guardado.passwordHash, undefined);
  assert.equal(usuario.googleSub, undefined);
});

test("Google: rechaza un correo no verificado", async () => {
  const { sistema, cad } = preparar();

  await assert.rejects(
    () => sistema.loginGoogle(
      identidad({ email_verified: false })
    ),
    error => error.estadoHTTP === 401
  );

  assert.equal((await cad.listar()).length, 0);
});

test("Google: rechaza una identidad sin identificador", async () => {
  const { sistema } = preparar();

  await assert.rejects(
    () => sistema.loginGoogle(identidad({ sub: "" })),
    error => error.estadoHTTP === 401
  );
});

test("Google: reutiliza la cuenta y conserva su rol", async () => {
  const { sistema, cad } = preparar();

  const primero = await sistema.loginGoogle(identidad());
  const guardado = await cad.buscarPorEmail(primero.email);

  guardado.rol = "administrador";
  await cad.guardar(guardado);

  const segundo = await sistema.loginGoogle(identidad());

  assert.equal(segundo.id, primero.id);
  assert.equal(segundo.rol, "administrador");
  assert.equal((await cad.listar()).length, 1);
});

test("Google: no permite acceder a una cuenta eliminada", async () => {
  const { sistema } = preparar();

  const usuario = await sistema.loginGoogle(identidad());
  await sistema.eliminarUsuario(usuario.email);

  await assert.rejects(
    () => sistema.loginGoogle(identidad()),
    error => error.estadoHTTP === 403
  );
});

test("Google: no vincula una cuenta existente por email", async () => {
  const { sistema, cad } = preparar();

  await sistema.registrarUsuario(
    "google@example.com",
    "Password123!"
  );

  await assert.rejects(
    () => sistema.loginGoogle(identidad()),
    error => error.estadoHTTP === 409
  );

  const guardado = await cad.buscarPorEmail(
    "google@example.com"
  );

  assert.equal(guardado.estado, "pendiente");
  assert.equal(guardado.googleSub, undefined);
  assert.ok(guardado.passwordHash);
});

test("Google: identifica por sub aunque cambie el correo de Google", async () => {
  const { sistema, cad } = preparar();

  const primero = await sistema.loginGoogle(identidad());

  const segundo = await sistema.loginGoogle(
    identidad({ email: "otro@example.com" })
  );

  assert.equal(segundo.id, primero.id);
  assert.equal(segundo.email, primero.email);
  assert.equal((await cad.listar()).length, 1);
});
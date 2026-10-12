const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const { Sistema } = require("../servidor/modelo");
const { CadMemoria } = require("../servidor/cadMemoria");

function preparar() {
  const cad = new CadMemoria();
  return { cad, sistema: new Sistema(cad) };
}

test("El registro guarda un hash y no devuelve la contraseña", async () => {
  const { cad, sistema } = preparar();

  const resultado = await sistema.registrarUsuario(
    "ana@example.com",
    "ClavePrueba123"
  );

  const almacenado = await cad.buscarPorEmail("ana@example.com");

  assert.equal(resultado.estado, "pendiente");
  assert.equal(resultado.passwordHash, undefined);
  assert.equal(almacenado.password, undefined);
  assert.notEqual(almacenado.passwordHash, "ClavePrueba123");
  assert.equal(
    await bcrypt.compare("ClavePrueba123", almacenado.passwordHash),
    true
  );

  const listado = await sistema.listarUsuarios();
  assert.equal(listado[0].passwordHash, undefined);
});

test("El registro rechaza contraseñas cortas", async () => {
  const { sistema } = preparar();

  await assert.rejects(
    () => sistema.registrarUsuario("ana@example.com", "123"),
    { estadoHTTP: 400 }
  );
});

test("El registro rechaza emails duplicados", async () => {
  const { sistema } = preparar();

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");

  await assert.rejects(
    () => sistema.registrarUsuario("ANA@example.com", "OtraClave123"),
    { estadoHTTP: 409 }
  );
});

test("Una cuenta pendiente no puede iniciar sesión", async () => {
  const { sistema } = preparar();

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");

  await assert.rejects(
    () => sistema.loginUsuario("ana@example.com", "ClavePrueba123"),
    { estadoHTTP: 403 }
  );
});

test("Una cuenta activa accede con su contraseña correcta", async () => {
  const { cad, sistema } = preparar();

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");

  const usuario = await cad.buscarPorEmail("ana@example.com");

  // Simula una cuenta confirmada para comprobar el login.
  await cad.guardar({ ...usuario, estado: "activo" });

  const resultado = await sistema.loginUsuario(
    "ana@example.com",
    "ClavePrueba123"
  );

  assert.equal(resultado.email, "ana@example.com");
  assert.equal(resultado.passwordHash, undefined);

  await assert.rejects(
    () => sistema.loginUsuario("ana@example.com", "Incorrecta123"),
    { estadoHTTP: 401 }
  );
});

test("Una cuenta eliminada no puede iniciar sesión", async () => {
  const { cad, sistema } = preparar();

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");

  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  await sistema.eliminarUsuario("ana@example.com");

  await assert.rejects(
    () => sistema.loginUsuario("ana@example.com", "ClavePrueba123"),
    { estadoHTTP: 401 }
  );
});
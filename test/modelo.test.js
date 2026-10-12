const test = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo");
const { CadMemoria } = require("../servidor/cadMemoria");

function crearSistema() {
  return new Sistema(new CadMemoria());
}

test("Crear usuario normaliza el email y deja la cuenta pendiente", async () => {
  const sistema = crearSistema();

  const usuario = await sistema.agregarUsuario("  ANA@EXAMPLE.COM ");

  assert.equal(usuario.email, "ana@example.com");
  assert.equal(usuario.estado, "pendiente");
  assert.equal(usuario.rol, "usuario");
  assert.ok(usuario.id);
});

test("Rechazar un email ya registrado", async () => {
  const sistema = crearSistema();
  await sistema.agregarUsuario("ana@example.com");

  await assert.rejects(
    () => sistema.agregarUsuario("ANA@example.com"),
    { estadoHTTP: 409 }
  );
});

test("Rechazar un email incorrecto", async () => {
  const sistema = crearSistema();

  await assert.rejects(
    () => sistema.agregarUsuario("correo-incorrecto"),
    { estadoHTTP: 400 }
  );
});

test("Listar los usuarios registrados", async () => {
  const sistema = crearSistema();
  await sistema.agregarUsuario("ana@example.com");
  await sistema.agregarUsuario("luis@example.com");

  const usuarios = await sistema.listarUsuarios();

  assert.equal(usuarios.length, 2);
  assert.deepEqual(
    usuarios.map(usuario => usuario.email).sort(),
    ["ana@example.com", "luis@example.com"]
  );
});

test("Una cuenta pendiente no está activa", async () => {
  const sistema = crearSistema();
  await sistema.agregarUsuario("ana@example.com");

  assert.equal(await sistema.usuarioActivo("ana@example.com"), false);
});

test("Una cuenta activa pasa a inactiva al eliminarla", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const usuario = await sistema.agregarUsuario("ana@example.com");

  // Preparación del caso: simula una cuenta ya confirmada.
  await cad.guardar({ ...usuario, estado: "activo" });

  assert.equal(await sistema.usuarioActivo(usuario.email), true);

  await sistema.eliminarUsuario(usuario.email);

  assert.equal(await sistema.usuarioActivo(usuario.email), false);
  assert.equal(
    (await cad.buscarPorEmail(usuario.email)).estado,
    "eliminado"
  );
});

test("Eliminar un usuario inexistente devuelve un error", async () => {
  const sistema = crearSistema();

  await assert.rejects(
    () => sistema.eliminarUsuario("nadie@example.com"),
    { estadoHTTP: 404 }
  );
});
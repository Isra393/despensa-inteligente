const test = require("node:test");
const assert = require("node:assert/strict");
const { Sistema } = require("../servidor/modelo");
const { CadMemoria } = require("../servidor/cadMemoria");

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  await cad.guardar({
    id: "admin-1",
    email: "admin@example.com",
    rol: "administrador",
    estado: "activo",
    passwordHash: "hash-de-prueba",
  });

  await cad.guardar({
    id: "usuario-1",
    email: "usuario@example.com",
    rol: "usuario",
    estado: "activo",
  });

  await cad.guardar({
    id: "usuario-2",
    email: "otro@example.com",
    rol: "usuario",
    estado: "pendiente",
  });

  return { cad, sistema };
}

test("El administrador puede listar sin recibir hashes", async () => {
  const { sistema } = await preparar();

  const usuarios = await sistema.listarUsuariosAutorizado(
    "admin@example.com"
  );

  assert.equal(usuarios.length, 3);
  assert.ok(usuarios.every(
    (usuario) => !("passwordHash" in usuario)
  ));
});

test("Un usuario no puede listar ni consultar cuentas activas", async () => {
  const { sistema } = await preparar();

  await assert.rejects(
    sistema.listarUsuariosAutorizado("usuario@example.com"),
    { estadoHTTP: 403 }
  );

  await assert.rejects(
    sistema.usuarioActivoAutorizado(
      "usuario@example.com",
      "admin@example.com"
    ),
    { estadoHTTP: 403 }
  );
});

test("El administrador distingue cuentas activas y pendientes", async () => {
  const { sistema } = await preparar();

  assert.equal(
    await sistema.usuarioActivoAutorizado(
      "admin@example.com",
      "usuario@example.com"
    ),
    true
  );

  assert.equal(
    await sistema.usuarioActivoAutorizado(
      "admin@example.com",
      "otro@example.com"
    ),
    false
  );
});

test("Un usuario puede eliminar su propia cuenta", async () => {
  const { cad, sistema } = await preparar();

  await sistema.eliminarUsuarioAutorizado(
    "usuario@example.com",
    "usuario@example.com"
  );

  const usuario = await cad.buscarPorEmail(
    "usuario@example.com"
  );

  assert.equal(usuario.estado, "eliminado");

  await assert.rejects(
    sistema.obtenerUsuarioSesion("usuario@example.com"),
    { estadoHTTP: 401 }
  );
});

test("Un usuario no puede eliminar otra cuenta", async () => {
  const { cad, sistema } = await preparar();

  await assert.rejects(
    sistema.eliminarUsuarioAutorizado(
      "usuario@example.com",
      "otro@example.com"
    ),
    { estadoHTTP: 403 }
  );

  const otro = await cad.buscarPorEmail("otro@example.com");
  assert.equal(otro.estado, "pendiente");
});

test("El administrador puede eliminar otra cuenta", async () => {
  const { cad, sistema } = await preparar();

  await sistema.eliminarUsuarioAutorizado(
    "admin@example.com",
    "otro@example.com"
  );

  const otro = await cad.buscarPorEmail("otro@example.com");
  assert.equal(otro.estado, "eliminado");
});

test("Un administrador eliminado pierde sus permisos", async () => {
  const { cad, sistema } = await preparar();

  const admin = await cad.buscarPorEmail("admin@example.com");
  await cad.guardar({ ...admin, estado: "eliminado" });

  await assert.rejects(
    sistema.listarUsuariosAutorizado("admin@example.com"),
    { estadoHTTP: 401 }
  );
});

test("Los permisos se actualizan al cambiar el rol guardado", async () => {
  const { cad, sistema } = await preparar();

  const admin = await cad.buscarPorEmail("admin@example.com");
  await cad.guardar({ ...admin, rol: "usuario" });

  await assert.rejects(
    sistema.listarUsuariosAutorizado("admin@example.com"),
    { estadoHTTP: 403 }
  );
});
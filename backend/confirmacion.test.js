const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");

const {
  crearConfirmacion,
  resumirToken,
  DURACION_CONFIRMACION_MS
} = require("./confirmacion");

test("La confirmación genera un token aleatorio de 32 bytes", () => {
  const resultado = crearConfirmacion();

  assert.match(resultado.token, /^[a-f0-9]{64}$/);
});

test("El hash corresponde al token y no contiene el token original", () => {
  const resultado = crearConfirmacion();

  const esperado = createHash("sha256")
    .update(resultado.token)
    .digest("hex");

  assert.equal(resultado.tokenHash, esperado);
  assert.notEqual(resultado.tokenHash, resultado.token);
});

test("La confirmación caduca exactamente a las 24 horas", () => {
  const ahora = Date.parse("2026-11-16T18:00:00Z");
  const resultado = crearConfirmacion(ahora);

  assert.equal(
    resultado.caducaEn.getTime(),
    ahora + DURACION_CONFIRMACION_MS
  );
});

test("Dos confirmaciones generan tokens diferentes", () => {
  const primera = crearConfirmacion();
  const segunda = crearConfirmacion();

  assert.notEqual(primera.token, segunda.token);
});

test("Un token mal formado no produce un hash válido", () => {
  for (const token of [
    undefined,
    null,
    123,
    "",
    "token-inventado",
    "a".repeat(63),
    "a".repeat(65),
    "g".repeat(64)
  ]) {
    assert.equal(resumirToken(token), null);
  }
});
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");

test("Confirmar una cuenta permite iniciar sesión", async () => {
  const sistema = new Sistema(new CadMemoria());

  const resultado = await sistema.registrarUsuarioConConfirmacion(
    "confirmar@example.com",
    "ClavePrueba123"
  );

  assert.equal(resultado.usuario.estado, "pendiente");

  await assert.rejects(
    sistema.loginUsuario(
      "confirmar@example.com",
      "ClavePrueba123"
    ),
    error => error.estadoHTTP === 403
  );

  const confirmado = await sistema.confirmarCuenta(resultado.token);

  assert.equal(confirmado.estado, "activo");

  const acceso = await sistema.loginUsuario(
    "confirmar@example.com",
    "ClavePrueba123"
  );

  assert.equal(acceso.estado, "activo");
  assert.equal(acceso.passwordHash, undefined);
});

test("El token de confirmación solo puede utilizarse una vez", async () => {
  const sistema = new Sistema(new CadMemoria());

  const { token } = await sistema.registrarUsuarioConConfirmacion(
    "unuso@example.com",
    "ClavePrueba123"
  );

  await sistema.confirmarCuenta(token);

  await assert.rejects(
    sistema.confirmarCuenta(token),
    error => error.estadoHTTP === 400
  );
});

test("Un token caducado no activa la cuenta", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  const { token } = await sistema.registrarUsuarioConConfirmacion(
    "caducado@example.com",
    "ClavePrueba123"
  );

  const usuario = await cad.buscarPorEmail("caducado@example.com");

  usuario.confirmacionCaducaEn = new Date(Date.now() - 1000);
  await cad.guardar(usuario);

  await assert.rejects(
    sistema.confirmarCuenta(token),
    error => error.estadoHTTP === 400
  );

  const guardado = await cad.buscarPorEmail(usuario.email);
  assert.equal(guardado.estado, "pendiente");
});

test("La confirmación no reactiva una cuenta eliminada", async () => {
  const sistema = new Sistema(new CadMemoria());

  const { token } = await sistema.registrarUsuarioConConfirmacion(
    "eliminado@example.com",
    "ClavePrueba123"
  );

  await sistema.eliminarUsuario("eliminado@example.com");

  await assert.rejects(
    sistema.confirmarCuenta(token),
    error => error.estadoHTTP === 400
  );
  
});
test("El reenvío inmediato queda limitado", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  await sistema.registrarUsuarioConConfirmacion(
    "limite@example.com",
    "ClavePrueba123"
  );

  const resultado = await sistema.prepararReenvioConfirmacion(
    "limite@example.com"
  );

  assert.equal(resultado, null);
});

test("El reenvío sustituye el token anterior", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  const original = await sistema.registrarUsuarioConConfirmacion(
    "reenviar@example.com",
    "ClavePrueba123"
  );

  // Simula el paso del tiempo sin esperar un minuto.
  const usuario = await cad.buscarPorEmail("reenviar@example.com");
  usuario.confirmacionEnviadaEn = new Date(Date.now() - 61000);
  await cad.guardar(usuario);

  const nuevo = await sistema.prepararReenvioConfirmacion(
    "reenviar@example.com"
  );

  assert.ok(nuevo);
  assert.notEqual(nuevo.token, original.token);

  await assert.rejects(
    sistema.confirmarCuenta(original.token),
    error => error.estadoHTTP === 400
  );

  const confirmado = await sistema.confirmarCuenta(nuevo.token);
  assert.equal(confirmado.estado, "activo");
});

test("No se prepara reenvío para cuentas inexistentes o activas", async () => {
  const sistema = new Sistema(new CadMemoria());

  assert.equal(
    await sistema.prepararReenvioConfirmacion(
      "inexistente@example.com"
    ),
    null
  );

  const { token } = await sistema.registrarUsuarioConConfirmacion(
    "activa@example.com",
    "ClavePrueba123"
  );

  await sistema.confirmarCuenta(token);

  assert.equal(
    await sistema.prepararReenvioConfirmacion(
      "activa@example.com"
    ),
    null
  );
});

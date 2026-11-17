// Pruebas de integración de la capa lógica (Sistema) con la capa de
// acceso a datos real (CadMongo) sobre una base de datos de pruebas.
//
// Solo se ejecutan si se define MONGODB_URI_TEST. Usan la base indicada
// en MONGODB_DB_TEST (por defecto, despensa_inteligente_test) y vacían
// sus colecciones antes y después. Nunca se ejecutan sobre la base de
// producción.
require("dotenv").config({ quiet: true });

const test = require("node:test");
const assert = require("node:assert/strict");
const { CadMongo } = require("../../servidor/cadMongo");
const { Sistema } = require("../../servidor/modelo");

const URI = process.env.MONGODB_URI_TEST;
const BASE = process.env.MONGODB_DB_TEST || "despensa_inteligente_test";
const PRODUCCION = process.env.MONGODB_DB || "despensa_inteligente";

const motivoOmision = !URI
  ? "Define MONGODB_URI_TEST para ejecutar las pruebas con MongoDB"
  : BASE === PRODUCCION
    ? "MONGODB_DB_TEST no puede ser la base de producción"
    : false;

test.describe("Integración Sistema + CadMongo", { skip: motivoOmision }, () => {
  let cad;
  let sistema;

  async function vaciar() {
    await cad.usuarios.deleteMany({});
    await cad.alimentos.deleteMany({});
    await cad.listaCompra.deleteMany({});
  }

  async function cuentaActiva(email) {
    await sistema.registrarUsuario(email, "ClavePrueba123");
    const usuario = await cad.buscarPorEmail(email);
    await cad.guardar({ ...usuario, estado: "activo" });
  }

  test.before(async () => {
    cad = await CadMongo.conectar(URI, BASE);
    sistema = new Sistema(cad);
  });

  test.beforeEach(vaciar);

  test.after(async () => {
    if (cad) {
      await vaciar();
      await cad.cerrar();
    }
  });

  test("conectar crea los índices necesarios", async () => {
    const usuarios = await cad.usuarios.indexes();
    const alimentos = await cad.alimentos.indexes();

    const clave = indice => JSON.stringify(indice.key);

    assert.ok(usuarios.some(i => clave(i) === '{"email":1}' && i.unique));
    assert.ok(usuarios.some(i => clave(i) === '{"googleSub":1}' && i.unique));
    assert.ok(
      alimentos.some(i => clave(i) === '{"usuarioId":1,"id":1}' && i.unique)
    );

    const lista = await cad.listaCompra.indexes();
    assert.ok(
      lista.some(i => clave(i) === '{"usuarioId":1,"id":1}' && i.unique)
    );
  });

  test("registro, confirmación e inicio de sesión", async () => {
    const { usuario, token } = await sistema.registrarUsuarioConConfirmacion(
      "ana@example.com",
      "ClavePrueba123"
    );

    assert.equal(usuario.estado, "pendiente");

    const guardado = await cad.buscarPorEmail("ana@example.com");
    assert.equal(guardado._id, undefined);
    assert.notEqual(guardado.passwordHash, "ClavePrueba123");
    assert.ok(guardado.confirmacionTokenHash);

    await assert.rejects(
      sistema.loginUsuario("ana@example.com", "ClavePrueba123"),
      { estadoHTTP: 403 }
    );

    await sistema.confirmarCuenta(token);

    // El token es de un solo uso.
    await assert.rejects(sistema.confirmarCuenta(token), { estadoHTTP: 400 });

    const sesion = await sistema.loginUsuario(
      "ana@example.com",
      "ClavePrueba123"
    );
    assert.equal(sesion.estado, "activo");
  });

  test("el índice único impide emails duplicados", async () => {
    await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");

    await assert.rejects(
      cad.guardar({
        id: "otro-id",
        email: "ana@example.com",
        rol: "usuario",
        estado: "pendiente"
      }),
      { estadoHTTP: 409 }
    );
  });

  test("el reenvío respeta el intervalo mínimo", async () => {
    await sistema.registrarUsuarioConConfirmacion(
      "ana@example.com",
      "ClavePrueba123"
    );

    // Recién registrado: aún no ha pasado un minuto.
    assert.equal(
      await sistema.prepararReenvioConfirmacion("ana@example.com"),
      null
    );

    const usuario = await cad.buscarPorEmail("ana@example.com");
    await cad.guardar({
      ...usuario,
      confirmacionEnviadaEn: new Date(Date.now() - 2 * 60 * 1000)
    });

    const reenvio = await sistema.prepararReenvioConfirmacion(
      "ana@example.com"
    );
    assert.match(reenvio.token, /^[a-f0-9]{64}$/);
  });

  test("acceso con Google crea la cuenta y la reutiliza", async () => {
    const identidad = {
      sub: "google-123",
      email: "g@example.com",
      email_verified: true
    };

    const primera = await sistema.loginGoogle(identidad);
    const segunda = await sistema.loginGoogle(identidad);

    assert.equal(primera.id, segunda.id);
    assert.equal((await cad.listar()).length, 1);
  });

  test("CRUD de alimentos aislado por usuario", async () => {
    await cuentaActiva("ana@example.com");
    await cuentaActiva("luis@example.com");

    const creado = await sistema.crearAlimento("ana@example.com", {
      nombre: "Leche",
      cantidad: 2,
      unidad: "l",
      categoria: "lácteos y huevos",
      fechaCaducidad: "2099-12-31"
    });

    const lista = await sistema.listarAlimentos("ana@example.com");
    assert.equal(lista.alimentos.length, 1);
    assert.equal(lista.alimentos[0]._id, undefined);
    assert.equal(lista.alimentos[0].usuarioId, undefined);

    assert.equal(
      (await sistema.listarAlimentos("luis@example.com")).alimentos.length,
      0
    );

    await assert.rejects(
      sistema.eliminarAlimento("luis@example.com", creado.id),
      { estadoHTTP: 404 }
    );

    const actualizado = await sistema.actualizarAlimento(
      "ana@example.com",
      creado.id,
      { nombre: "Leche", cantidad: 1, unidad: "l" }
    );
    assert.equal(actualizado.cantidad, 1);
    assert.equal(
      new Date(actualizado.creadoEn).getTime(),
      new Date(creado.creadoEn).getTime()
    );

    assert.equal(await cad.contarAlimentos(
      (await cad.buscarPorEmail("ana@example.com")).id
    ), 1);

    await sistema.eliminarAlimento("ana@example.com", creado.id);
    assert.equal(
      (await sistema.listarAlimentos("ana@example.com")).alimentos.length,
      0
    );
  });

  test("lista de la compra aislada por usuario", async () => {
    await cuentaActiva("ana@example.com");
    await cuentaActiva("luis@example.com");

    await sistema.crearAlimento("ana@example.com", {
      nombre: "Leche", cantidad: 0, unidad: "l", stockMinimo: 1
    });

    const pan = await sistema.agregarElementoLista(
      "ana@example.com", { nombre: "Pan" }
    );

    await assert.rejects(
      sistema.eliminarElementoLista("luis@example.com", pan.id),
      { estadoHTTP: 404 }
    );

    await sistema.marcarElementoLista(
      "ana@example.com", pan.id, { comprado: true }
    );

    const lista = await sistema.obtenerListaCompra("ana@example.com");
    assert.equal(lista.automaticos[0].nombre, "Leche");
    assert.equal(lista.manuales[0]._id, undefined);
    assert.equal(lista.manuales[0].comprado, true);

    assert.deepEqual(
      await sistema.eliminarElementosComprados("ana@example.com"),
      { eliminados: 1 }
    );
  });
});

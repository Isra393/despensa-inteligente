const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");

const AHORA = new Date("2026-03-10T11:00:00Z");
const EMAILS = ["ana@example.com", "luis@example.com", "marta@example.com"];

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  for (const [i, email] of EMAILS.entries()) {
    await cad.guardar({
      id: `${i + 1}`.repeat(8) + "-1111-4111-8111-111111111111",
      email,
      rol: "usuario",
      estado: "activo"
    });
  }

  return { cad, sistema };
}

async function nombres(sistema, email) {
  const { alimentos } = await sistema.listarAlimentos(email, AHORA);
  return alimentos.map(a => a.nombre).sort();
}

async function unir(sistema, anfitrion, invitado) {
  const { codigo } = await sistema.crearInvitacionHogar(anfitrion, AHORA);
  return sistema.unirseHogar(invitado, codigo, AHORA);
}

test("Hogar: al principio cada uno tiene su despensa", async () => {
  const { sistema } = await preparar();

  const hogar = await sistema.obtenerHogar("ana@example.com", AHORA);

  assert.equal(hogar.compartido, false);
  assert.deepEqual(hogar.miembros, [{ email: "ana@example.com", soyYo: true }]);
  assert.equal(hogar.invitacion, null);
});

test("Hogar: el código tiene buen formato y solo se guarda su huella", async () => {
  const { cad, sistema } = await preparar();

  const { codigo, caducaEn } = await sistema.crearInvitacionHogar("ana@example.com", AHORA);

  assert.match(codigo, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(caducaEn.getTime() - AHORA.getTime(), 48 * 60 * 60 * 1000);

  const ana = await cad.buscarPorEmail("ana@example.com");
  assert.match(ana.invitacionHogar.codigoHash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(ana).includes(codigo.replace("-", "")));

  const hogar = await sistema.obtenerHogar("ana@example.com", AHORA);
  assert.deepEqual(hogar.invitacion, { caducaEn });
});

test("Hogar: al unirse se comparten alimentos y lista", async () => {
  const { sistema } = await preparar();

  await sistema.crearAlimento("ana@example.com", { nombre: "Leche", cantidad: 1 }, AHORA);
  await sistema.crearAlimento("luis@example.com", { nombre: "Pan", cantidad: 1 }, AHORA);
  await sistema.agregarElementoLista("luis@example.com", { nombre: "Café" }, AHORA);

  const resultado = await unir(sistema, "ana@example.com", "luis@example.com");

  assert.equal(resultado.compartido, true);
  assert.equal(resultado.alimentosMovidos, 1);

  // Los dos ven lo mismo: lo de Ana más lo que traía Luis.
  assert.deepEqual(await nombres(sistema, "ana@example.com"), ["Leche", "Pan"]);
  assert.deepEqual(await nombres(sistema, "luis@example.com"), ["Leche", "Pan"]);

  const { manuales } = await sistema.obtenerListaCompra("ana@example.com");
  assert.deepEqual(manuales.map(e => e.nombre), ["Café"]);

  // Y ambos pueden modificar lo del otro.
  const { alimentos } = await sistema.listarAlimentos("luis@example.com", AHORA);
  const leche = alimentos.find(a => a.nombre === "Leche");
  const { alimento } = await sistema.ajustarCantidad("luis@example.com", leche.id, { delta: -1 });
  assert.equal(alimento.cantidad, 0);
});

test("Hogar: el código es de un solo uso y caduca", async () => {
  const { sistema } = await preparar();

  const { codigo } = await sistema.crearInvitacionHogar("ana@example.com", AHORA);
  await sistema.unirseHogar("luis@example.com", codigo.toLowerCase(), AHORA);

  await assert.rejects(
    sistema.unirseHogar("marta@example.com", codigo, AHORA),
    { estadoHTTP: 400 }
  );

  const otra = await sistema.crearInvitacionHogar("ana@example.com", AHORA);
  const dentroDe3Dias = new Date(AHORA.getTime() + 3 * 24 * 60 * 60 * 1000);

  await assert.rejects(
    sistema.unirseHogar("marta@example.com", otra.codigo, dentroDe3Dias),
    { estadoHTTP: 400 }
  );

  for (const codigoFalso of ["", null, "ABCD", "ABCD-EFG1", "ZZZZ-ZZZZ"]) {
    await assert.rejects(
      sistema.unirseHogar("marta@example.com", codigoFalso, AHORA),
      { estadoHTTP: 400 }
    );
  }
});

test("Hogar: no se puede usar el código propio ni el del mismo hogar", async () => {
  const { sistema } = await preparar();

  const { codigo } = await sistema.crearInvitacionHogar("ana@example.com", AHORA);

  await assert.rejects(
    sistema.unirseHogar("ana@example.com", codigo, AHORA),
    { estadoHTTP: 409 }
  );

  // El intento fallido no gasta el código.
  await sistema.unirseHogar("luis@example.com", codigo, AHORA);

  const deLuis = await sistema.crearInvitacionHogar("luis@example.com", AHORA);
  await assert.rejects(
    sistema.unirseHogar("ana@example.com", deLuis.codigo, AHORA),
    { estadoHTTP: 409 }
  );
});

test("Hogar: cualquier miembro puede invitar y el límite es de 6", async () => {
  const { cad, sistema } = await preparar();

  await unir(sistema, "ana@example.com", "luis@example.com");
  // Luis invita a Marta al hogar de Ana.
  await unir(sistema, "luis@example.com", "marta@example.com");

  const hogar = await sistema.obtenerHogar("marta@example.com", AHORA);
  assert.equal(hogar.miembros.length, 3);
  assert.deepEqual(hogar.miembros[0], { email: "marta@example.com", soyYo: true });

  for (let i = 4; i <= 6; i++) {
    const email = `persona${i}@example.com`;
    await cad.guardar({ id: `id-${i}`, email, rol: "usuario", estado: "activo" });
    await unir(sistema, "ana@example.com", email);
  }

  await assert.rejects(
    sistema.crearInvitacionHogar("ana@example.com", AHORA),
    { estadoHTTP: 409 }
  );
});

test("Hogar: quien sale empieza con una despensa vacía", async () => {
  const { sistema } = await preparar();

  await sistema.crearAlimento("ana@example.com", { nombre: "Leche", cantidad: 1 }, AHORA);
  await unir(sistema, "ana@example.com", "luis@example.com");

  // Incluso quien creó el hogar puede salir: los demás conservan los datos.
  const hogarAna = await sistema.salirHogar("ana@example.com", AHORA);

  assert.equal(hogarAna.compartido, false);
  assert.deepEqual(await nombres(sistema, "ana@example.com"), []);
  assert.deepEqual(await nombres(sistema, "luis@example.com"), ["Leche"]);

  await assert.rejects(
    sistema.salirHogar("luis@example.com", AHORA),
    { estadoHTTP: 409 }
  );
});

test("Hogar: unirse desde un hogar compartido deja allí sus datos", async () => {
  const { sistema } = await preparar();

  await sistema.crearAlimento("ana@example.com", { nombre: "Leche", cantidad: 1 }, AHORA);
  await unir(sistema, "ana@example.com", "luis@example.com");

  // Luis se va al hogar de Marta: la leche se queda con Ana.
  await unir(sistema, "marta@example.com", "luis@example.com");

  assert.deepEqual(await nombres(sistema, "ana@example.com"), ["Leche"]);
  assert.deepEqual(await nombres(sistema, "luis@example.com"), []);
  assert.equal((await sistema.obtenerHogar("ana@example.com", AHORA)).compartido, false);
});

test("Hogar: se puede quitar a otro miembro, pero no a alguien de fuera", async () => {
  const { sistema } = await preparar();

  await unir(sistema, "ana@example.com", "luis@example.com");

  await assert.rejects(
    sistema.quitarMiembroHogar("ana@example.com", "marta@example.com", AHORA),
    { estadoHTTP: 404 }
  );

  await assert.rejects(
    sistema.quitarMiembroHogar("ana@example.com", "ana@example.com", AHORA),
    { estadoHTTP: 400 }
  );

  const hogar = await sistema.quitarMiembroHogar("ana@example.com", "luis@example.com", AHORA);
  assert.equal(hogar.compartido, false);
  assert.equal((await sistema.obtenerHogar("luis@example.com", AHORA)).compartido, false);
});

test("Hogar: las cuentas eliminadas no cuentan como miembros", async () => {
  const { sistema } = await preparar();

  await unir(sistema, "ana@example.com", "luis@example.com");
  await sistema.eliminarUsuario("luis@example.com");

  const hogar = await sistema.obtenerHogar("ana@example.com", AHORA);
  assert.equal(hogar.compartido, false);
});

test("Hogar: los avisos de caducidad llegan a cada miembro que los activa", async () => {
  const { sistema } = await preparar();

  await sistema.crearAlimento(
    "ana@example.com",
    { nombre: "Yogur", cantidad: 1, fechaCaducidad: "2026-03-11" },
    AHORA
  );
  await unir(sistema, "ana@example.com", "luis@example.com");
  await sistema.actualizarPreferenciasAvisos(
    "luis@example.com",
    { activo: true, diasAntelacion: 3 }
  );

  const avisos = await sistema.prepararAvisosCaducidad(AHORA);

  assert.deepEqual(avisos.map(a => a.email), ["luis@example.com"]);
  assert.equal(avisos[0].alimentos[0].nombre, "Yogur");
});

test("API hogar: flujo completo y límite de intentos", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  await request(app).get("/api/hogar").expect(401);

  const agentes = {};

  for (const email of ["ana@example.com", "luis@example.com"]) {
    await sistema.registrarUsuario(email, "ClavePrueba123");
    const usuario = await cad.buscarPorEmail(email);
    await cad.guardar({ ...usuario, estado: "activo" });

    agentes[email] = request.agent(app);
    await agentes[email]
      .post("/api/login")
      .send({ email, password: "ClavePrueba123" })
      .expect(200);
  }

  const ana = agentes["ana@example.com"];
  const luis = agentes["luis@example.com"];

  await ana.post("/api/alimentos").send({ nombre: "Leche", cantidad: 1 }).expect(201);

  const { body: { codigo } } = await ana.post("/api/hogar/invitacion").expect(201);
  const unido = await luis.post("/api/hogar/unirse").send({ codigo }).expect(200);
  assert.equal(unido.body.compartido, true);

  const lista = await luis.get("/api/alimentos").expect(200);
  assert.equal(lista.body.alimentos[0].nombre, "Leche");

  await luis.delete("/api/hogar/miembros/ana@example.com").expect(200);
  assert.equal((await ana.get("/api/hogar").expect(200)).body.compartido, false);
  await ana.post("/api/hogar/salir").expect(409);

  // Tras 5 intentos en 10 minutos, se bloquea.
  for (let i = 0; i < 5; i++) {
    await ana.post("/api/hogar/unirse").send({ codigo: "AAAA-AAAA" }).expect(400);
  }
  await ana.post("/api/hogar/unirse").send({ codigo: "AAAA-AAAA" }).expect(429);
});

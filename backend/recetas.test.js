const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");
const { coincide, sugerirRecetas } = require("./recetas");
const { RECETAS } = require("./recetario");

// 10 de marzo de 2026.
const AHORA = new Date("2026-03-10T11:00:00Z");

function alimento(nombre, estadoCaducidad = "vigente", diasRestantes = 10, cantidad = 1) {
  return { nombre, estadoCaducidad, diasRestantes, cantidad };
}

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  await cad.guardar({
    id: "11111111-1111-4111-8111-111111111111",
    email: "ana@example.com",
    rol: "usuario",
    estado: "activo"
  });

  return { cad, sistema };
}

test("Recetario: identificadores únicos y recetas completas", () => {
  const ids = RECETAS.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const receta of RECETAS) {
    assert.ok(receta.nombre && receta.minutos > 0 && receta.raciones > 0, receta.id);
    assert.ok(receta.pasos.length >= 2, receta.id);
    assert.ok(receta.ingredientes.some(i => !i.opcional), receta.id);
  }
});

test("Recetas: reconoce ingredientes con plurales, tildes y nombres largos", () => {
  assert.equal(coincide("tomate", "Tomates pera"), true);
  assert.equal(coincide("champinon", "Champiñones"), true);
  assert.equal(coincide("carne picada", "Carne picada de ternera"), true);
  assert.equal(coincide("tortilla trigo", "Tortilla de patatas"), false);
  assert.equal(coincide("ajo", "Ajonjolí"), false);
});

test("Recetas: prioriza las que aprovechan lo que caduca antes", () => {
  const recetas = sugerirRecetas([
    alimento("Huevos"),
    alimento("Espinacas", "proximo", 1),
    alimento("Patatas")
  ]);

  assert.equal(recetas[0].id, "tortilla-espinacas");
  assert.deepEqual(recetas[0].aprovecha, [{ nombre: "Espinacas", diasRestantes: 1 }]);
  assert.ok(recetas.some(r => r.id === "tortilla-patatas"));
});

test("Recetas: no cuenta lo caducado ni lo agotado", () => {
  const recetas = sugerirRecetas([
    alimento("Huevos", "caducado", -2),
    alimento("Patatas", "vigente", 10, 0)
  ]);

  assert.deepEqual(recetas, []);
});

test("Recetas: exige al menos la mitad de los ingredientes obligatorios", () => {
  const recetas = sugerirRecetas([alimento("Calabacín")]);

  for (const receta of recetas) {
    assert.ok(receta.cobertura >= 0.5, receta.id);
  }

  // La crema de calabacín necesita 3 obligatorios: con 1 no basta.
  assert.ok(!recetas.some(r => r.id === "crema-calabacin"));
});

test("Recetas: marca lo que falta y lo que caduca pronto", () => {
  const [batido] = sugerirRecetas([alimento("Plátanos maduros", "proximo", 0)])
    .filter(r => r.id === "batido-platano");

  assert.deepEqual(
    batido.ingredientes.map(i => [i.nombre, i.estado]),
    [["plátanos", "caduca_pronto"], ["leche", "falta"], ["yogur", "falta"]]
  );
  assert.deepEqual(batido.faltan, ["leche"]);
});

test("Recetas: añade a la lista solo lo que falta y no está pendiente", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  await sistema.crearAlimento(email, { nombre: "Plátanos", cantidad: 3 }, AHORA);
  await sistema.agregarElementoLista(email, { nombre: "Leche" }, AHORA);

  // Para el bizcocho faltan huevos, harina y azúcar (el yogur no está).
  await sistema.crearAlimento(email, { nombre: "Yogur natural", cantidad: 4 }, AHORA);

  let resultado = await sistema.agregarFaltantesALista(email, "batido-platano", AHORA);
  assert.deepEqual(resultado, { agregados: [], yaEstaban: ["leche"] });

  resultado = await sistema.agregarFaltantesALista(email, "bizcocho-yogur", AHORA);
  assert.deepEqual(resultado.agregados, ["huevos", "harina", "azúcar"]);

  const { manuales } = await sistema.obtenerListaCompra(email);
  assert.deepEqual(
    manuales.map(e => e.nombre),
    ["Leche", "huevos", "harina", "azúcar"]
  );
  assert.equal(manuales[1].cantidad, "Para: Bizcocho de yogur");

  // Repetirlo no duplica nada.
  resultado = await sistema.agregarFaltantesALista(email, "bizcocho-yogur", AHORA);
  assert.deepEqual(resultado.agregados, []);

  await assert.rejects(
    sistema.agregarFaltantesALista(email, "no-existe", AHORA),
    { estadoHTTP: 404 }
  );
});

test("API recetas: requiere sesión y devuelve sugerencias", async () => {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false
  });

  await request(app).get("/api/recetas").expect(401);

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  const agente = request.agent(app);
  await agente
    .post("/api/login")
    .send({ email: "ana@example.com", password: "ClavePrueba123" })
    .expect(200);

  let respuesta = await agente.get("/api/recetas").expect(200);
  assert.deepEqual(respuesta.body, { recetas: [], caducanPronto: 0 });

  await agente.post("/api/alimentos").send({ nombre: "Huevos", cantidad: 6 }).expect(201);
  await agente.post("/api/alimentos").send({ nombre: "Patatas", cantidad: 1, unidad: "kg" }).expect(201);

  respuesta = await agente.get("/api/recetas").expect(200);
  assert.ok(respuesta.body.recetas.some(r => r.id === "tortilla-patatas"));

  respuesta = await agente
    .post("/api/recetas/tortilla-espinacas/lista-compra")
    .expect(200);
  assert.deepEqual(respuesta.body.agregados, ["espinacas"]);
});

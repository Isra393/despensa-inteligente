const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");
const {
  codigoValido,
  clasificar,
  interpretarCantidad,
  mapearProducto,
  crearCatalogoProductos
} = require("./productos");
const { validarDatosAlimento } = require("./alimentos");

const LECHE = "8410188012153";

function respuestaJson(cuerpo, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return cuerpo; }
  };
}

// Simula Open Food Facts y registra las peticiones recibidas.
function offSimulado(respuestas) {
  const peticiones = [];

  async function fetch(url, opciones) {
    peticiones.push({ url, opciones });
    const codigo = url.split("/").pop().split("?")[0];
    const respuesta = respuestas[codigo];

    if (respuesta instanceof Error) throw respuesta;
    return respuesta ?? respuestaJson({ status: 0 }, 404);
  }

  return { fetch, peticiones };
}

const productoLeche = {
  status: 1,
  product: {
    code: LECHE,
    product_name: "Semi-skimmed milk",
    product_name_es: "Leche semidesnatada",
    brands: "Marca Blanca, Otra",
    quantity: "1 l",
    categories_tags: ["en:dairies", "en:milks", "en:semi-skimmed-milks"]
  }
};

test("Código de barras: comprueba longitud y dígito de control", () => {
  for (const valido of [LECHE, "96385074", "036000291452", "10012345678902"]) {
    assert.equal(codigoValido(valido), true, valido);
  }

  for (const invalido of ["8410188012154", "123", "841018801215a", "", null, 8410188012153]) {
    assert.equal(codigoValido(invalido), false, String(invalido));
  }
});

test("Productos: clasifica por la categoría más concreta", () => {
  const casos = [
    [["en:beverages", "en:fruit-juices", "en:orange-juices"], "bebidas", "despensa"],
    [["en:dairies", "en:milks"], "lácteos y huevos", "nevera"],
    [["en:plant-based-foods", "en:frozen-vegetables"], "congelados", "congelador"],
    [["en:cereals-and-potatoes", "en:pastas"], "despensa seca", "despensa"],
    [["en:meats", "en:poultry"], "carne y pescado", "nevera"],
    [["en:desconocida"], "otros", "despensa"],
    [null, "otros", "despensa"]
  ];

  for (const [etiquetas, categoria, ubicacion] of casos) {
    assert.deepEqual(clasificar(etiquetas), { categoria, ubicacion });
  }
});

test("Productos: interpreta la cantidad del envase", () => {
  assert.deepEqual(interpretarCantidad("1 l"), { cantidad: 1, unidad: "l" });
  assert.deepEqual(interpretarCantidad("1,5 L"), { cantidad: 1.5, unidad: "l" });
  assert.deepEqual(interpretarCantidad("500g"), { cantidad: 500, unidad: "g" });
  assert.deepEqual(interpretarCantidad("33 cl"), { cantidad: 330, unidad: "ml" });
  assert.deepEqual(interpretarCantidad("6 x 125 g"), { cantidad: 6, unidad: "unidades" });
  assert.deepEqual(interpretarCantidad("una docena"), { cantidad: 1, unidad: "unidades" });
  assert.deepEqual(interpretarCantidad(undefined), { cantidad: 1, unidad: "unidades" });
});

test("Productos: el resultado cumple la validación de alimentos", () => {
  const producto = mapearProducto(LECHE, productoLeche.product);

  assert.deepEqual(producto, {
    codigo: LECHE,
    nombre: "Leche semidesnatada",
    marca: "Marca Blanca",
    categoria: "lácteos y huevos",
    ubicacion: "nevera",
    cantidad: 1,
    unidad: "l"
  });

  const { error } = validarDatosAlimento({
    nombre: producto.nombre,
    cantidad: producto.cantidad,
    unidad: producto.unidad,
    categoria: producto.categoria,
    ubicacion: producto.ubicacion,
    codigoBarras: producto.codigo
  });

  assert.equal(error, undefined);
  assert.equal(mapearProducto(LECHE, { product_name: "  " }), null);
});

test("Catálogo: envía User-Agent propio y guarda en caché", async () => {
  const off = offSimulado({ [LECHE]: respuestaJson(productoLeche) });
  const catalogo = crearCatalogoProductos({ fetch: off.fetch, userAgent: "Prueba/1.0" });

  const primero = await catalogo.buscar(LECHE);
  const segundo = await catalogo.buscar(LECHE);

  assert.equal(primero.nombre, "Leche semidesnatada");
  assert.deepEqual(segundo, primero);
  assert.equal(off.peticiones.length, 1);
  assert.equal(off.peticiones[0].opciones.headers["User-Agent"], "Prueba/1.0");
  assert.match(off.peticiones[0].url, /\/api\/v2\/product\/8410188012153\?fields=/);
});

test("Catálogo: la caché caduca", async () => {
  let reloj = 0;
  const off = offSimulado({ [LECHE]: respuestaJson(productoLeche) });
  const catalogo = crearCatalogoProductos({ fetch: off.fetch, ahora: () => reloj });

  await catalogo.buscar(LECHE);
  reloj = 25 * 60 * 60 * 1000;
  await catalogo.buscar(LECHE);

  assert.equal(off.peticiones.length, 2);
});

test("Catálogo: distingue no encontrado, límite y caída", async () => {
  const off = offSimulado({
    "96385074": respuestaJson({}, 429),
    "036000291452": new Error("timeout")
  });
  const catalogo = crearCatalogoProductos({ fetch: off.fetch });

  assert.equal(await catalogo.buscar(LECHE), null);
  await assert.rejects(catalogo.buscar("96385074"), { codigoError: "limite" });
  await assert.rejects(catalogo.buscar("036000291452"), { codigoError: "no_disponible" });
});

async function prepararApp(catalogoProductos) {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false,
    catalogoProductos
  });

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  const agente = request.agent(app);
  await agente
    .post("/api/login")
    .send({ email: "ana@example.com", password: "ClavePrueba123" })
    .expect(200);

  return { app, agente };
}

test("API productos: busca, valida y avisa si ya está en la despensa", async () => {
  const off = offSimulado({ [LECHE]: respuestaJson(productoLeche) });
  const { app, agente } = await prepararApp(crearCatalogoProductos({ fetch: off.fetch }));

  await request(app).get(`/api/productos/${LECHE}`).expect(401);
  await agente.get("/api/productos/12345").expect(400);
  await agente.get("/api/productos/96385074").expect(404);

  let respuesta = await agente.get(`/api/productos/${LECHE}`).expect(200);
  assert.equal(respuesta.body.producto.nombre, "Leche semidesnatada");
  assert.equal(respuesta.body.enDespensa, null);

  await agente
    .post("/api/alimentos")
    .send({ nombre: "Leche", cantidad: 1, unidad: "l", codigoBarras: LECHE })
    .expect(201);

  respuesta = await agente.get(`/api/productos/${LECHE}`).expect(200);
  assert.equal(respuesta.body.enDespensa.nombre, "Leche");
});

test("API productos: si el catálogo falla, sigue sirviendo lo que ya tienes", async () => {
  const off = offSimulado({ [LECHE]: new Error("caído") });
  const { agente } = await prepararApp(crearCatalogoProductos({ fetch: off.fetch }));

  await agente.get(`/api/productos/${LECHE}`).expect(503);

  await agente
    .post("/api/alimentos")
    .send({ nombre: "Leche", cantidad: 1, unidad: "l", codigoBarras: LECHE })
    .expect(201);

  const respuesta = await agente.get(`/api/productos/${LECHE}`).expect(200);
  assert.equal(respuesta.body.producto, null);
  assert.equal(respuesta.body.enDespensa.nombre, "Leche");
});

test("API productos: limita las búsquedas por usuario", async () => {
  const off = offSimulado({});
  const { agente } = await prepararApp(crearCatalogoProductos({ fetch: off.fetch }));

  for (let i = 0; i < 10; i++) {
    await agente.get("/api/productos/96385074").expect(404);
  }

  await agente.get("/api/productos/96385074").expect(429);
});

test("API productos: 503 si no hay catálogo configurado", async () => {
  const { agente } = await prepararApp(undefined);
  await agente.get(`/api/productos/${LECHE}`).expect(503);
});

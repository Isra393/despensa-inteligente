const test = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");
const { enviarAvisosCaducidad } = require("./avisos");
const {
  crearCorreo,
  asuntoAviso,
  describirCaducidad
} = require("./correo");

// 10 de marzo de 2026 a las 8:00 en España.
const AHORA = new Date("2026-03-10T07:00:00Z");
const TOKEN = "t".repeat(40);

async function preparar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  const usuarios = [
    ["ana@example.com", "activo"],
    ["luis@example.com", "activo"],
    ["baja@example.com", "eliminado"]
  ];

  for (const [i, [email, estado]] of usuarios.entries()) {
    await cad.guardar({
      id: `${i + 1}`.repeat(8) + "-1111-4111-8111-111111111111",
      email,
      rol: "usuario",
      estado
    });
  }

  return { cad, sistema };
}

function correoSimulado({ falla = [] } = {}) {
  const enviados = [];

  return {
    enviados,
    async enviarAvisoCaducidad(email, alimentos) {
      if (falla.includes(email)) throw new Error("SMTP caído");
      enviados.push({ email, alimentos });
    }
  };
}

async function alimento(sistema, email, nombre, fechaCaducidad) {
  return sistema.crearAlimento(
    email,
    { nombre, cantidad: 1, fechaCaducidad },
    AHORA
  );
}

test("Avisos: desactivados por defecto, con 3 días de antelación", async () => {
  const { sistema } = await preparar();

  assert.deepEqual(
    await sistema.obtenerPreferenciasAvisos("ana@example.com"),
    { activo: false, diasAntelacion: 3 }
  );
});

test("Avisos: guarda y valida las preferencias", async () => {
  const { sistema } = await preparar();

  const guardadas = await sistema.actualizarPreferenciasAvisos(
    "ana@example.com",
    { activo: true, diasAntelacion: 5 }
  );

  assert.deepEqual(guardadas, { activo: true, diasAntelacion: 5 });

  for (const datos of [
    null,
    { activo: "sí", diasAntelacion: 3 },
    { activo: true, diasAntelacion: 0 },
    { activo: true, diasAntelacion: 8 },
    { activo: true, diasAntelacion: 2.5 }
  ]) {
    await assert.rejects(
      sistema.actualizarPreferenciasAvisos("ana@example.com", datos),
      { estadoHTTP: 400 }
    );
  }
});

test("Avisos: solo incluye usuarios activos que los han pedido", async () => {
  const { sistema, cad } = await preparar();

  await alimento(sistema, "ana@example.com", "Leche", "2026-03-11");
  await alimento(sistema, "luis@example.com", "Yogur", "2026-03-11");

  await sistema.actualizarPreferenciasAvisos(
    "ana@example.com",
    { activo: true, diasAntelacion: 3 }
  );

  // Una cuenta dada de baja con avisos activos no recibe nada.
  const baja = await cad.buscarPorEmail("baja@example.com");
  await cad.guardar({
    ...baja,
    avisosCaducidad: { activo: true, diasAntelacion: 3 }
  });

  const avisos = await sistema.prepararAvisosCaducidad(AHORA);

  assert.deepEqual(avisos.map(a => a.email), ["ana@example.com"]);
});

test("Avisos: incluye caducados y próximos según la antelación", async () => {
  const { sistema } = await preparar();
  const email = "ana@example.com";

  await alimento(sistema, email, "Caducado", "2026-03-08");
  await alimento(sistema, email, "Mañana", "2026-03-11");
  await alimento(sistema, email, "En dos días", "2026-03-12");
  await alimento(sistema, email, "En cinco días", "2026-03-15");
  await alimento(sistema, email, "Sin fecha", null);

  await sistema.actualizarPreferenciasAvisos(
    email,
    { activo: true, diasAntelacion: 1 }
  );

  const [aviso] = await sistema.prepararAvisosCaducidad(AHORA);

  assert.deepEqual(
    aviso.alimentos.map(a => a.nombre),
    ["Caducado", "Mañana"]
  );
});

test("Avisos: no avisa si no hay nada que caduque", async () => {
  const { sistema } = await preparar();

  await alimento(sistema, "ana@example.com", "Arroz", null);
  await sistema.actualizarPreferenciasAvisos(
    "ana@example.com",
    { activo: true, diasAntelacion: 3 }
  );

  assert.deepEqual(await sistema.prepararAvisosCaducidad(AHORA), []);
});

test("Avisos: envía una sola vez al día", async () => {
  const { sistema } = await preparar();
  const correo = correoSimulado();

  await alimento(sistema, "ana@example.com", "Leche", "2026-03-11");
  await sistema.actualizarPreferenciasAvisos(
    "ana@example.com",
    { activo: true, diasAntelacion: 3 }
  );

  assert.deepEqual(
    await enviarAvisosCaducidad(sistema, correo, AHORA),
    { pendientes: 1, enviados: 1, fallidos: 0 }
  );

  // Segunda ejecución el mismo día: no se repite.
  assert.deepEqual(
    await enviarAvisosCaducidad(sistema, correo, AHORA),
    { pendientes: 0, enviados: 0, fallidos: 0 }
  );

  // Al día siguiente vuelve a avisar.
  const manana = new Date("2026-03-11T07:00:00Z");
  const resultado = await enviarAvisosCaducidad(sistema, correo, manana);

  assert.equal(resultado.enviados, 1);
  assert.equal(correo.enviados.length, 2);
});

test("Avisos: un fallo de envío no detiene al resto y se reintenta", async () => {
  const { sistema } = await preparar();
  const correo = correoSimulado({ falla: ["ana@example.com"] });

  for (const email of ["ana@example.com", "luis@example.com"]) {
    await alimento(sistema, email, "Leche", "2026-03-11");
    await sistema.actualizarPreferenciasAvisos(
      email,
      { activo: true, diasAntelacion: 3 }
    );
  }

  const resultado = await enviarAvisosCaducidad(sistema, correo, AHORA);

  assert.deepEqual(resultado, { pendientes: 2, enviados: 1, fallidos: 1 });

  // El aviso fallido sigue pendiente para un nuevo intento.
  const pendientes = await sistema.prepararAvisosCaducidad(AHORA);
  assert.deepEqual(pendientes.map(a => a.email), ["ana@example.com"]);
});

test("Correo de aviso: asunto, texto y HTML escapado", async () => {
  const enviados = [];
  const correo = crearCorreo(
    {
      SMTP_USER: "remitente@example.com",
      SMTP_PASSWORD: "clave",
      APP_URL: "http://localhost:3000"
    },
    { transporte: { async sendMail(m) { enviados.push(m); } } }
  );

  await correo.enviarAvisoCaducidad("ana@example.com", [
    { nombre: "<b>Queso</b>", cantidad: 1, unidad: "unidades", diasRestantes: -2 },
    { nombre: "Leche", cantidad: 2, unidad: "l", diasRestantes: 1 }
  ]);

  const [mensaje] = enviados;

  assert.equal(
    mensaje.subject,
    "Tu despensa: 1 alimento caduca pronto y 1 ya ha caducado"
  );
  assert.match(mensaje.text, /Leche \(2 l\): caduca mañana/);
  assert.match(mensaje.text, /caducó hace 2 días/);
  assert.ok(mensaje.html.includes("&lt;b&gt;Queso&lt;/b&gt;"));
  assert.ok(!mensaje.html.includes("<b>Queso</b>"));
  assert.ok(mensaje.html.includes('href="http://localhost:3000/"'));

  await assert.rejects(correo.enviarAvisoCaducidad("ana@example.com", []));
});

test("Correo de aviso: describe la caducidad", () => {
  const casos = [[-3, "caducó hace 3 días"], [-1, "caducó ayer"],
    [0, "caduca hoy"], [1, "caduca mañana"], [4, "caduca en 4 días"]];

  for (const [dias, texto] of casos) {
    assert.equal(describirCaducidad({ diasRestantes: dias }), texto);
  }

  assert.equal(
    asuntoAviso([{ diasRestantes: 2 }, { diasRestantes: 0 }]),
    "Tu despensa: 2 alimentos caducan pronto"
  );
});

function prepararApp(opciones = {}) {
  const tokenTareas = "tokenTareas" in opciones ? opciones.tokenTareas : TOKEN;
  const { correo } = opciones;
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);
  const app = crearApp(sistema, {
    secret: randomBytes(32).toString("hex"),
    produccion: false,
    tokenTareas,
    correo: correo ?? {
      ...correoSimulado(),
      async enviarConfirmacion() {}
    }
  });

  return { app, cad, sistema };
}

test("Tarea HTTP: exige el token correcto", async () => {
  const { app } = prepararApp();
  const ruta = "/api/tareas/avisos-caducidad";

  await request(app).post(ruta).expect(401);

  await request(app)
    .post(ruta)
    .set("Authorization", "Bearer token-incorrecto")
    .expect(401);

  const respuesta = await request(app)
    .post(ruta)
    .set("Authorization", `Bearer ${TOKEN}`)
    .expect(200);

  assert.deepEqual(respuesta.body, { pendientes: 0, enviados: 0, fallidos: 0 });
});

test("Tarea HTTP: ignora el salto de línea final del secreto", async () => {
  const { app } = prepararApp({ tokenTareas: `${TOKEN}\n` });

  await request(app)
    .post("/api/tareas/avisos-caducidad")
    .set("Authorization", `Bearer ${TOKEN}`)
    .expect(200);
});

test("Tarea HTTP: desactivada sin token o con uno demasiado corto", async () => {
  for (const tokenTareas of [undefined, "corto"]) {
    const { app } = prepararApp({ tokenTareas });

    await request(app)
      .post("/api/tareas/avisos-caducidad")
      .set("Authorization", "Bearer corto")
      .expect(503);
  }
});

test("Preferencias HTTP: requieren sesión y se guardan", async () => {
  const { app, cad, sistema } = prepararApp();

  await request(app).get("/api/preferencias/avisos").expect(401);

  await sistema.registrarUsuario("ana@example.com", "ClavePrueba123");
  const usuario = await cad.buscarPorEmail("ana@example.com");
  await cad.guardar({ ...usuario, estado: "activo" });

  const agente = request.agent(app);
  await agente
    .post("/api/login")
    .send({ email: "ana@example.com", password: "ClavePrueba123" })
    .expect(200);

  await agente
    .put("/api/preferencias/avisos")
    .send({ activo: true, diasAntelacion: 2 })
    .expect(200);

  const respuesta = await agente.get("/api/preferencias/avisos").expect(200);
  assert.deepEqual(respuesta.body, { activo: true, diasAntelacion: 2 });

  await agente
    .put("/api/preferencias/avisos")
    .send({ activo: true, diasAntelacion: 30 })
    .expect(400);
});

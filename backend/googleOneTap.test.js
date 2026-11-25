const test = require("node:test");
const assert = require("node:assert/strict");
const { crearGoogle } = require("./google");

const ENV = {
  GOOGLE_CLIENT_ID: "cliente-prueba.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "secreto-prueba",
  APP_URL: "http://localhost:3000"
};

// Cliente OAuth simulado: devuelve la identidad indicada sin contactar
// con Google. Registra la audiencia con la que se ha verificado.
function clienteSimulado(identidad, { falla = false } = {}) {
  const llamadas = [];

  return {
    llamadas,
    async verifyIdToken(opciones) {
      llamadas.push(opciones);

      if (falla) {
        throw new Error("Firma no válida");
      }

      return { getPayload: () => identidad };
    }
  };
}

function preparar(identidad, opciones) {
  const cliente = clienteSimulado(identidad, opciones);
  const google = crearGoogle(ENV, { cliente });
  const intento = google.prepararOneTap();

  return { cliente, google, intento };
}

test("One Tap: el nonce es aleatorio y caduca", () => {
  const google = crearGoogle(ENV, { cliente: clienteSimulado({}) });

  const a = google.prepararOneTap();
  const b = google.prepararOneTap();

  assert.match(a.nonce, /^[a-f0-9]{64}$/);
  assert.notEqual(a.nonce, b.nonce);
  assert.ok(a.caducaEn > Date.now());
  assert.equal(google.clientId, ENV.GOOGLE_CLIENT_ID);
});

test("One Tap: acepta un token con el nonce correcto", async () => {
  const identidad = {
    sub: "123",
    email: "ana@example.com",
    email_verified: true
  };

  const { cliente, google, intento } = preparar(identidad);
  identidad.nonce = intento.nonce;

  const resultado = await google.verificarCredencial("token", intento);

  assert.deepEqual(resultado, {
    sub: "123",
    email: "ana@example.com",
    email_verified: true
  });

  // Comprueba que el token se verifica para nuestra aplicación.
  assert.equal(cliente.llamadas[0].audience, ENV.GOOGLE_CLIENT_ID);
});

test("One Tap: rechaza un nonce distinto", async () => {
  const { google, intento } = preparar({
    sub: "123",
    email: "ana@example.com",
    email_verified: true,
    nonce: "otro-nonce"
  });

  await assert.rejects(
    google.verificarCredencial("token", intento),
    { estadoHTTP: 401 }
  );
});

test("One Tap: rechaza correos no verificados", async () => {
  const identidad = {
    sub: "123",
    email: "ana@example.com",
    email_verified: false
  };

  const { google, intento } = preparar(identidad);
  identidad.nonce = intento.nonce;

  await assert.rejects(
    google.verificarCredencial("token", intento),
    { estadoHTTP: 401 }
  );
});

test("One Tap: rechaza tokens con firma no válida", async () => {
  const { google, intento } = preparar({}, { falla: true });

  await assert.rejects(
    google.verificarCredencial("token", intento),
    { estadoHTTP: 401 }
  );
});

test("One Tap: rechaza intentos caducados o ausentes", async () => {
  const { cliente, google, intento } = preparar({});

  await assert.rejects(
    google.verificarCredencial("token", { ...intento, caducaEn: Date.now() - 1 }),
    { estadoHTTP: 401 }
  );

  await assert.rejects(
    google.verificarCredencial("token", undefined),
    { estadoHTTP: 401 }
  );

  await assert.rejects(
    google.verificarCredencial("", intento),
    { estadoHTTP: 401 }
  );

  // No se llega a contactar con Google en ninguno de los casos.
  assert.equal(cliente.llamadas.length, 0);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { crearApp } = require("./app");
const { Sistema, ErrorNegocio } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");

function preparar({ disponible = true } = {}) {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  // Simula el componente de Google, sin llamadas externas.
  const google = {
    async iniciar() {
      return {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        intento: {
          state: "estado-prueba",
          nonce: "nonce-prueba",
          codeVerifier: "verificador-prueba",
          caducaEn: Date.now() + 60000
        }
      };
    },

    async completar({ code, state }, intento) {
      if (
        !intento ||
        state !== intento.state ||
        code !== "codigo-valido"
      ) {
        throw new ErrorNegocio("Acceso Google no válido", 401);
      }

      return {
        sub: "google-api-123",
        email: "google-api@example.com",
        email_verified: true
      };
    },

    clientId: "cliente-prueba.apps.googleusercontent.com",

    prepararOneTap() {
      return {
        nonce: "nonce-one-tap",
        caducaEn: Date.now() + 60000
      };
    },

    async verificarCredencial(credential, intento) {
      if (
        !intento ||
        intento.nonce !== "nonce-one-tap" ||
        credential !== "token-one-tap-valido"
      ) {
        throw new ErrorNegocio("Acceso Google no válido", 401);
      }

      return {
        sub: "google-one-tap-1",
        email: "one-tap@example.com",
        email_verified: true
      };
    }
  };

  const app = crearApp(sistema, {
    secret: "clave-de-pruebas-google-de-al-menos-32-caracteres",
    produccion: false,
    google: disponible ? google : null
  });

  return {
    agente: request.agent(app),
    cad
  };
}

test("Google HTTP: redirige al proveedor", async () => {
  const { agente } = preparar();

  const respuesta = await agente
    .get("/api/auth/google")
    .expect(302);

  assert.equal(
    respuesta.headers.location,
    "https://accounts.google.com/o/oauth2/v2/auth"
  );
  assert.ok(respuesta.headers["set-cookie"]);
});

test("Google HTTP: crea sesión y permite cerrarla", async () => {
  const { agente } = preparar();

  await agente.get("/api/auth/google").expect(302);

  await agente
    .get("/api/auth/google/callback")
    .query({
      code: "codigo-valido",
      state: "estado-prueba"
    })
    .expect(302)
    .expect("Location", "/");

  const respuesta = await agente
    .get("/api/sesion")
    .expect(200);

  assert.equal(
    respuesta.body.usuario.email,
    "google-api@example.com"
  );
  assert.equal(respuesta.body.usuario.rol, "usuario");
  assert.equal(respuesta.body.usuario.googleSub, undefined);

  await agente.post("/api/logout").expect(200);
  await agente.get("/api/sesion").expect(401);
});

test("Google HTTP: rechaza un retorno sin intento previo", async () => {
  const { agente, cad } = preparar();

  await agente
    .get("/api/auth/google/callback")
    .query({
      code: "codigo-valido",
      state: "estado-prueba"
    })
    .expect(302)
    .expect("Location", "/#error-google=fallo");

  assert.equal((await cad.listar()).length, 0);
  await agente.get("/api/sesion").expect(401);
});

test("Google HTTP: rechaza un estado incorrecto", async () => {
  const { agente, cad } = preparar();

  await agente.get("/api/auth/google").expect(302);

  await agente
    .get("/api/auth/google/callback")
    .query({
      code: "codigo-valido",
      state: "estado-incorrecto"
    })
    .expect(302)
    .expect("Location", "/#error-google=fallo");

  assert.equal((await cad.listar()).length, 0);
  await agente.get("/api/sesion").expect(401);
});

test("Google HTTP: consume el intento si se cancela", async () => {
  const { agente, cad } = preparar();

  await agente.get("/api/auth/google").expect(302);

  await agente
    .get("/api/auth/google/callback")
    .query({
      error: "access_denied",
      state: "estado-prueba"
    })
    .expect(302)
    .expect("Location", "/#error-google=cancelado");

  // El intento cancelado ya no puede reutilizarse.
  await agente
    .get("/api/auth/google/callback")
    .query({
      code: "codigo-valido",
      state: "estado-prueba"
    })
    .expect(302)
    .expect("Location", "/#error-google=fallo");

  assert.equal((await cad.listar()).length, 0);
});

test("Google HTTP: redirige con aviso si no está configurado", async () => {
  const { agente } = preparar({ disponible: false });

  await agente
    .get("/api/auth/google")
    .expect(302)
    .expect("Location", "/#error-google=no_disponible");
});

test("Google HTTP: avisa si el correo ya tiene cuenta local", async () => {
  const { agente, cad } = preparar();

  await cad.guardar({
    id: "local-1",
    email: "google-api@example.com",
    rol: "usuario",
    estado: "activo",
    passwordHash: "hash"
  });

  await agente.get("/api/auth/google").expect(302);

  await agente
    .get("/api/auth/google/callback")
    .query({ code: "codigo-valido", state: "estado-prueba" })
    .expect(302)
    .expect("Location", "/#error-google=cuenta_existente");

  await agente.get("/api/sesion").expect(401);
});

test("One Tap HTTP: entrega el client ID y un nonce", async () => {
  const { agente } = preparar();

  const respuesta = await agente
    .get("/api/auth/google/one-tap")
    .expect(200);

  assert.deepEqual(respuesta.body, {
    disponible: true,
    clientId: "cliente-prueba.apps.googleusercontent.com",
    nonce: "nonce-one-tap"
  });
});

test("One Tap HTTP: crea la sesión con un token válido", async () => {
  const { agente } = preparar();

  await agente.get("/api/auth/google/one-tap").expect(200);

  const respuesta = await agente
    .post("/api/auth/google/one-tap")
    .send({ credential: "token-one-tap-valido" })
    .expect(200);

  assert.equal(respuesta.body.usuario.email, "one-tap@example.com");

  const sesion = await agente.get("/api/sesion").expect(200);
  assert.equal(sesion.body.usuario.email, "one-tap@example.com");
});

test("One Tap HTTP: exige pedir antes el nonce", async () => {
  const { agente, cad } = preparar();

  await agente
    .post("/api/auth/google/one-tap")
    .send({ credential: "token-one-tap-valido" })
    .expect(401);

  assert.equal((await cad.listar()).length, 0);
});

test("One Tap HTTP: el nonce no se puede reutilizar", async () => {
  const { agente } = preparar();

  await agente.get("/api/auth/google/one-tap").expect(200);

  await agente
    .post("/api/auth/google/one-tap")
    .send({ credential: "token-falso" })
    .expect(401);

  await agente
    .post("/api/auth/google/one-tap")
    .send({ credential: "token-one-tap-valido" })
    .expect(401);

  await agente.get("/api/sesion").expect(401);
});

test("One Tap HTTP: indica que no está disponible sin configuración", async () => {
  const { agente } = preparar({ disponible: false });

  const respuesta = await agente
    .get("/api/auth/google/one-tap")
    .expect(200);

  assert.deepEqual(respuesta.body, { disponible: false });
  await agente
    .post("/api/auth/google/one-tap")
    .send({ credential: "x" })
    .expect(503);
});
const { randomBytes } = require("node:crypto");
const { OAuth2Client } = require("google-auth-library");
const { ErrorNegocio } = require("./modelo");

// El parámetro "cliente" permite sustituir el cliente OAuth en las pruebas.
function crearGoogle(env = process.env, { cliente: clienteInyectado } = {}) {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    APP_URL
  } = env;

  // Permite ejecutar las pruebas sin credenciales reales.
  if (!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !APP_URL) {
    throw new Error("Falta configurar el acceso con Google");
  }

  const base = new URL(APP_URL);

  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("APP_URL no es válida");
  }

  if (
    env.NODE_ENV === "production" &&
    base.protocol !== "https:"
  ) {
    throw new Error("APP_URL debe usar HTTPS en producción");
  }

  const callback = new URL(
    "/api/auth/google/callback",
    base
  ).toString();

  const cliente = clienteInyectado || new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    callback
  );

  function errorAcceso() {
    return new ErrorNegocio(
      "No se ha podido completar el acceso con Google. " +
      "Vuelve a intentarlo.",
      401
    );
  }

  function identidadValida(identidad, nonce) {
    return (
      identidad &&
      identidad.nonce === nonce &&
      identidad.email_verified === true &&
      typeof identidad.sub === "string" &&
      identidad.sub.length > 0 &&
      typeof identidad.email === "string" &&
      identidad.email.length > 0
    );
  }

  function intentoValido(intento) {
    return (
      intento &&
      typeof intento.nonce === "string" &&
      intento.nonce.length > 0 &&
      Number.isFinite(intento.caducaEn) &&
      Date.now() < intento.caducaEn
    );
  }

  return {
    clientId: GOOGLE_CLIENT_ID,

    // Google One Tap: el navegador recibe un ID token firmado por Google
    // y lo envía al servidor, que lo verifica antes de crear la sesión.
    prepararOneTap() {
      return {
        nonce: randomBytes(32).toString("hex"),
        caducaEn: Date.now() + 10 * 60 * 1000
      };
    },

    async verificarCredencial(credential, intento) {
      if (
        !intentoValido(intento) ||
        typeof credential !== "string" ||
        credential.length === 0 ||
        credential.length > 4096
      ) {
        throw errorAcceso();
      }

      try {
        const ticket = await cliente.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID
        });

        const identidad = ticket.getPayload();

        if (!identidadValida(identidad, intento.nonce)) {
          throw errorAcceso();
        }

        return {
          sub: identidad.sub,
          email: identidad.email,
          email_verified: true
        };
      } catch {
        throw errorAcceso();
      }
    },

    async iniciar() {
      const state = randomBytes(32).toString("hex");
      const nonce = randomBytes(32).toString("hex");

      const {
        codeVerifier,
        codeChallenge
      } = await cliente.generateCodeVerifierAsync();

      const url = cliente.generateAuthUrl({
        scope: ["openid", "email"],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        prompt: "select_account"
      });

      return {
        url,
        intento: {
          state,
          nonce,
          codeVerifier,
          caducaEn: Date.now() + 10 * 60 * 1000
        }
      };
    },

    async completar({ code, state }, intento) {
      if (
        !intento ||
        typeof code !== "string" ||
        code.length === 0 ||
        typeof state !== "string" ||
        state !== intento.state ||
        typeof intento.nonce !== "string" ||
        typeof intento.codeVerifier !== "string" ||
        !Number.isFinite(intento.caducaEn) ||
        Date.now() >= intento.caducaEn
      ) {
        throw errorAcceso();
      }

      try {
        const { tokens } = await cliente.getToken({
          code,
          codeVerifier: intento.codeVerifier
        });

        if (!tokens.id_token) {
          throw errorAcceso();
        }

        const ticket = await cliente.verifyIdToken({
          idToken: tokens.id_token,
          audience: GOOGLE_CLIENT_ID
        });

        const identidad = ticket.getPayload();

        if (!identidadValida(identidad, intento.nonce)) {
          throw errorAcceso();
        }

        return {
          sub: identidad.sub,
          email: identidad.email,
          email_verified: true
        };
      } catch {
        // Evita mostrar tokens o detalles privados del proveedor.
        throw errorAcceso();
      }
    }
  };
}

module.exports = { crearGoogle };
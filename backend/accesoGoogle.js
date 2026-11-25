const express = require("express");
const { ErrorNegocio } = require("./modelo");

function guardarSesion(req) {
  return new Promise((resolve, reject) => {
    req.session.save(error => {
      if (error) return reject(error);
      resolve();
    });
  });
}

function regenerarSesion(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate(error => {
      if (error) return reject(error);
      resolve();
    });
  });
}

function noDisponible() {
  return new ErrorNegocio(
    "El acceso con Google no está disponible",
    503
  );
}

// Traduce un error a un código breve que el cliente convierte en un
// mensaje comprensible. No se envían detalles internos al navegador.
function codigoError(error) {
  if (error instanceof ErrorNegocio) {
    if (error.estadoHTTP === 503) return "no_disponible";
    if (error.estadoHTTP === 409) return "cuenta_existente";
    if (error.estadoHTTP === 403) return "cuenta_no_permitida";
    return "fallo";
  }

  console.error("Error interno en el acceso con Google");
  return "fallo";
}

function redirigirConError(res, codigo) {
  res.redirect(`/#error-google=${codigo}`);
}

async function iniciarSesionGoogle(req, sistema, identidad) {
  const usuario = await sistema.loginGoogle(identidad);

  // Sustituye la sesión anterior tras autenticar al usuario.
  await regenerarSesion(req);

  req.session.email = usuario.email;
  await guardarSesion(req);

  return usuario;
}

function crearAccesoGoogle(sistema, google) {
  const router = express.Router();

  // Flujo con redirección (botón «Continuar con Google»).
  router.get("/auth/google", async (req, res) => {
    try {
      if (!google) throw noDisponible();

      const { url, intento } = await google.iniciar();

      req.session.googleOAuth = intento;
      await guardarSesion(req);

      res.redirect(url);
    } catch (error) {
      redirigirConError(res, codigoError(error));
    }
  });

  router.get("/auth/google/callback", async (req, res) => {
    try {
      if (!google) throw noDisponible();

      const intento = req.session.googleOAuth;

      // Consume el intento antes de contactar con Google.
      delete req.session.googleOAuth;
      await guardarSesion(req);

      if (req.query.error !== undefined) {
        return redirigirConError(res, "cancelado");
      }

      const identidad = await google.completar(
        {
          code: req.query.code,
          state: req.query.state
        },
        intento
      );

      await iniciarSesionGoogle(req, sistema, identidad);

      res.redirect("/");
    } catch (error) {
      redirigirConError(res, codigoError(error));
    }
  });

  // Google One Tap. Primero el navegador pide un nonce de un solo uso,
  // que Google incluye dentro del ID token firmado.
  router.get("/auth/google/one-tap", async (req, res, next) => {
    try {
      // Sin Google configurado, el cliente simplemente no muestra One Tap.
      if (!google) {
        return res.json({ disponible: false });
      }

      const intento = google.prepararOneTap();

      req.session.googleOneTap = intento;
      await guardarSesion(req);

      res.json({
        disponible: true,
        clientId: google.clientId,
        nonce: intento.nonce
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/google/one-tap", async (req, res, next) => {
    try {
      if (!google) throw noDisponible();

      const intento = req.session.googleOneTap;

      // El nonce solo sirve para un intento, tanto si sale bien como si no.
      delete req.session.googleOneTap;
      await guardarSesion(req);

      const identidad = await google.verificarCredencial(
        req.body?.credential,
        intento
      );

      const usuario = await iniciarSesionGoogle(req, sistema, identidad);

      res.json({ usuario });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { crearAccesoGoogle };

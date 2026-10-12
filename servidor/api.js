const express = require("express");
const { NOMBRE_COOKIE, opcionesCookie } = require("./sesion");

function crearApi(sistema, { produccion = false } = {}) {
  const router = express.Router();

  router.post("/registro", async (req, res, next) => {
    try {
      const usuario = await sistema.registrarUsuario(
        req.body?.email,
        req.body?.password
      );

      res.status(201).json({
        usuario,
        mensaje: "Cuenta creada, pendiente de confirmación"
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const usuario = await sistema.loginUsuario(
        req.body?.email,
        req.body?.password
      );

      // Sustituye la sesión anterior al iniciar sesión.
      req.session.regenerate(error => {
        if (error) return next(error);

        req.session.email = usuario.email;

        req.session.save(error => {
          if (error) return next(error);
          res.json({ usuario });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", (req, res, next) => {
    req.session.destroy(error => {
      if (error) return next(error);

      const { maxAge, ...opciones } = opcionesCookie(produccion);
      res.clearCookie(NOMBRE_COOKIE, opciones);
      res.json({ mensaje: "Sesión cerrada" });
    });
  });

  // Todas las rutas siguientes requieren una cuenta activa.
  router.use(async (req, res, next) => {
    if (!req.session.email) {
      return res.status(401).json({
        error: "Debes iniciar sesión"
      });
    }

    try {
      req.usuario = await sistema.obtenerUsuarioSesion(
        req.session.email
      );
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get("/sesion", (req, res) => {
    res.json({ usuario: req.usuario });
  });

  function soloAdmin(req, res, next) {
    if (req.usuario.rol !== "administrador") {
      return res.status(403).json({
        error: "Se requieren permisos de administrador"
      });
    }

    next();
  }

  router.get("/usuarios", soloAdmin, async (req, res, next) => {
    try {
      res.json(await sistema.listarUsuarios());
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/usuarios/:email/activo",
    soloAdmin,
    async (req, res, next) => {
      try {
        const activo = await sistema.usuarioActivo(req.params.email);
        res.json({ activo });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete("/usuarios/:email", async (req, res, next) => {
    try {
      const email = sistema.normalizarEmail(req.params.email);

      if (
        req.usuario.rol !== "administrador" &&
        req.usuario.email !== email
      ) {
        return res.status(403).json({
          error: "Solo puedes eliminar tu propia cuenta"
        });
      }

      const resultado = await sistema.eliminarUsuario(email);

      if (req.usuario.email === email) {
        return req.session.destroy(error => {
          if (error) return next(error);

          const { maxAge, ...opciones } = opcionesCookie(produccion);
          res.clearCookie(NOMBRE_COOKIE, opciones);
          res.json(resultado);
        });
      }

      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { crearApi };
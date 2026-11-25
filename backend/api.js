const express = require("express");
const { NOMBRE_COOKIE, opcionesCookie } = require("./sesion");
const { calcularBloqueo } = require("./modelo");

function crearApi(
  sistema,
  { produccion = false, correo, catalogoProductos } = {}
) {
  const router = express.Router();

  // Límite de búsquedas de productos por usuario (por minuto), para
  // repartir entre todos el límite de Open Food Facts.
  const busquedasPorUsuario = new Map();
  const MAX_BUSQUEDAS_MINUTO = 10;

  function puedeBuscar(email) {
    const ahora = Date.now();
    const recientes = (busquedasPorUsuario.get(email) || [])
      .filter(instante => ahora - instante < 60000);

    if (recientes.length >= MAX_BUSQUEDAS_MINUTO) {
      busquedasPorUsuario.set(email, recientes);
      return false;
    }

    recientes.push(ahora);
    busquedasPorUsuario.set(email, recientes);

    if (busquedasPorUsuario.size > 1000) {
      busquedasPorUsuario.delete(busquedasPorUsuario.keys().next().value);
    }

    return true;
  }
    router.post("/prueba/bloqueo", (req, res, next) => {
    try {
      const resultado = calcularBloqueo(
        req.body?.fallos,
        req.body?.ahora
      );

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

    router.post("/registro", async (req, res, next) => {
    try {
      if (!correo || typeof correo.enviarConfirmacion !== "function") {
        return res.status(503).json({
          error: "El servicio de correo no está disponible"
        });
      }

      const { usuario, token } =
        await sistema.registrarUsuarioConConfirmacion(
          req.body?.email,
          req.body?.password
        );

      try {
        await correo.enviarConfirmacion(usuario.email, token);
      } catch {
        // La cuenta ya está guardada, pero permanece pendiente.
        // No registramos el token ni las credenciales del correo.
        console.error("No se ha podido enviar el correo de confirmación");

        return res.status(201).json({
          usuario,
          correoEnviado: false,
          mensaje:
            "Cuenta creada, pero no se ha podido enviar el correo. " +
            "La cuenta permanece pendiente de confirmación."
        });
      }

      res.status(201).json({
        usuario,
        correoEnviado: true,
        mensaje:
          "Cuenta creada. Revisa tu correo para confirmar la cuenta."
      });
    } catch (error) {
      next(error);
    }
  });
    router.post("/confirmar-cuenta", async (req, res, next) => {
    try {
      await sistema.confirmarCuenta(req.body?.token);

      res.json({
        mensaje: "Cuenta confirmada. Ya puedes iniciar sesión."
      });
    } catch (error) {
      next(error);
    }
  });
    router.post("/reenviar-confirmacion", async (req, res, next) => {
    try {
      if (!correo || typeof correo.enviarConfirmacion !== "function") {
        return res.status(503).json({
          error: "El servicio de correo no está disponible"
        });
      }

      const resultado =
        await sistema.prepararReenvioConfirmacion(req.body?.email);

      if (resultado) {
        try {
          await correo.enviarConfirmacion(
            resultado.email,
            resultado.token
          );
        } catch {
          console.error(
            "No se ha podido enviar el correo de confirmación"
          );
        }
      }

      res.json({
        mensaje:
          "Si la cuenta está pendiente y ha pasado al menos un minuto " +
          "desde el último intento, intentaremos enviarte un nuevo enlace. " +
          "Revisa también la carpeta de spam."
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

    router.get("/usuarios", async (req, res, next) => {
    try {
      const usuarios = await sistema.listarUsuariosAutorizado(
        req.session.email
      );

      res.json(usuarios);
    } catch (error) {
      next(error);
    }
  });

   router.get("/usuarios/:email/activo", async (req, res, next) => {
    try {
      const activo = await sistema.usuarioActivoAutorizado(
        req.session.email,
        req.params.email
      );

      res.json({ activo });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/usuarios/:email", async (req, res, next) => {
    try {
      const email = sistema.normalizarEmail(req.params.email);

            const resultado = await sistema.eliminarUsuarioAutorizado(
        req.session.email,
        email
      );

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

  // ---------------------------------------------------------------
  // Alimentos de la despensa del usuario que ha iniciado sesión.
  // ---------------------------------------------------------------

  // Lista de la compra. La ruta de comprados va antes que /:id.
  router.get("/lista-compra", async (req, res, next) => {
    try {
      res.json(await sistema.obtenerListaCompra(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.post("/lista-compra", async (req, res, next) => {
    try {
      const elemento = await sistema.agregarElementoLista(
        req.session.email,
        req.body
      );

      res.status(201).json({ elemento });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/lista-compra/comprados", async (req, res, next) => {
    try {
      res.json(await sistema.eliminarElementosComprados(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/lista-compra/:id", async (req, res, next) => {
    try {
      const elemento = await sistema.marcarElementoLista(
        req.session.email,
        req.params.id,
        req.body
      );

      res.json({ elemento });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/lista-compra/:id", async (req, res, next) => {
    try {
      res.json(
        await sistema.eliminarElementoLista(req.session.email, req.params.id)
      );
    } catch (error) {
      next(error);
    }
  });

  // Preferencias de los avisos de caducidad por correo.
  router.get("/preferencias/avisos", async (req, res, next) => {
    try {
      res.json(await sistema.obtenerPreferenciasAvisos(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.put("/preferencias/avisos", async (req, res, next) => {
    try {
      res.json(
        await sistema.actualizarPreferenciasAvisos(
          req.session.email,
          req.body
        )
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/productos/:codigo", async (req, res, next) => {
    try {
      if (!puedeBuscar(req.session.email)) {
        return res.status(429).json({
          error: "Has hecho muchas búsquedas seguidas. Espera un minuto."
        });
      }

      res.json(
        await sistema.buscarProducto(
          req.session.email,
          req.params.codigo,
          catalogoProductos
        )
      );
    } catch (error) {
      next(error);
    }
  });

  // Hogar compartido. Se limitan los intentos de unirse con un código
  // para que no se puedan probar códigos a ciegas.
  const intentosUnirse = new Map();

  function puedeIntentarUnirse(email) {
    const ahora = Date.now();
    const recientes = (intentosUnirse.get(email) || [])
      .filter(instante => ahora - instante < 10 * 60 * 1000);

    if (recientes.length >= 5) {
      intentosUnirse.set(email, recientes);
      return false;
    }

    recientes.push(ahora);
    intentosUnirse.set(email, recientes);

    if (intentosUnirse.size > 1000) {
      intentosUnirse.delete(intentosUnirse.keys().next().value);
    }

    return true;
  }

  router.get("/hogar", async (req, res, next) => {
    try {
      res.json(await sistema.obtenerHogar(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.post("/hogar/invitacion", async (req, res, next) => {
    try {
      res.status(201).json(await sistema.crearInvitacionHogar(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.post("/hogar/unirse", async (req, res, next) => {
    try {
      if (!puedeIntentarUnirse(req.session.email)) {
        return res.status(429).json({
          error: "Demasiados intentos. Espera unos minutos y revisa el código."
        });
      }

      res.json(await sistema.unirseHogar(req.session.email, req.body?.codigo));
    } catch (error) {
      next(error);
    }
  });

  router.post("/hogar/salir", async (req, res, next) => {
    try {
      res.json(await sistema.salirHogar(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/hogar/miembros/:email", async (req, res, next) => {
    try {
      res.json(
        await sistema.quitarMiembroHogar(req.session.email, req.params.email)
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/recetas", async (req, res, next) => {
    try {
      res.json(await sistema.obtenerRecetas(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.post("/recetas/:id/lista-compra", async (req, res, next) => {
    try {
      res.json(
        await sistema.agregarFaltantesALista(req.session.email, req.params.id)
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/estadisticas", async (req, res, next) => {
    try {
      res.json(
        await sistema.obtenerEstadisticas(req.session.email, req.query.meses ?? 6)
      );
    } catch (error) {
      next(error);
    }
  });

  function enviarCsv(res, nombre, contenido) {
    const fecha = new Date().toISOString().slice(0, 10);
    res
      .type("text/csv; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="${nombre}-${fecha}.csv"`)
      .set("Cache-Control", "no-store")
      .send(contenido);
  }

  router.get("/exportar/despensa.csv", async (req, res, next) => {
    try {
      enviarCsv(res, "despensa", await sistema.exportarDespensaCsv(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.get("/exportar/historial.csv", async (req, res, next) => {
    try {
      enviarCsv(res, "historial", await sistema.exportarHistorialCsv(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.get("/alimentos", async (req, res, next) => {
    try {
      res.json(await sistema.listarAlimentos(req.session.email));
    } catch (error) {
      next(error);
    }
  });

  router.post("/alimentos", async (req, res, next) => {
    try {
      const alimento = await sistema.crearAlimento(
        req.session.email,
        req.body
      );

      res.status(201).json({ alimento });
    } catch (error) {
      next(error);
    }
  });

  router.put("/alimentos/:id", async (req, res, next) => {
    try {
      const alimento = await sistema.actualizarAlimento(
        req.session.email,
        req.params.id,
        req.body
      );

      res.json({ alimento });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/alimentos/:id/cantidad", async (req, res, next) => {
    try {
      res.json(
        await sistema.ajustarCantidad(
          req.session.email,
          req.params.id,
          req.body
        )
      );
    } catch (error) {
      next(error);
    }
  });

  router.delete("/alimentos/:id", async (req, res, next) => {
    try {
      res.json(
        await sistema.eliminarAlimento(
          req.session.email,
          req.params.id,
          req.query.motivo
        )
      );
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { crearApi };
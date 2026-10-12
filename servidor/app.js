const express = require("express");
const path = require("node:path");
const { crearApi } = require("./api");
const { Sistema, ErrorNegocio } = require("./modelo");
const { CadMemoria } = require("./cadMemoria");
const { crearSesion } = require("./sesion");

function crearApp(
  sistema = new Sistema(new CadMemoria()),
  {
    secret = process.env.SESSION_SECRET,
    produccion = process.env.NODE_ENV === "production",
    store
  } = {}
) {
  const app = express();

  if (produccion) {
    app.set("trust proxy", 1);
  }

  app.use(express.json({ limit: "16kb" }));

  app.use(express.static(path.join(__dirname, "..", "cliente")));

  app.get("/api/salud", (req, res) => {
    res.json({
      estado: "ok",
      aplicacion: "Despensa Inteligente"
    });
  });

  app.use(crearSesion({ secret, produccion, store }));

  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  app.use("/api", crearApi(sistema, { produccion }));

  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Ruta no encontrada" });
  });

  app.use((error, req, res, next) => {
    if (error instanceof ErrorNegocio) {
      return res.status(error.estadoHTTP).json({
        error: error.message
      });
    }

    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "El JSON no es válido" });
    }

    if (error.type === "entity.too.large") {
      return res.status(413).json({
        error: "La petición es demasiado grande"
      });
    }

    console.error("Error interno:", error.message);

    res.status(500).json({
      error: "Se ha producido un error interno"
    });
  });

  return app;
}

module.exports = { crearApp };
const express = require("express");
const path = require("node:path");

function crearApp() {
  const app = express();

  app.use(express.json());

  // El servidor sirve únicamente los archivos públicos del cliente.
  app.use(express.static(path.join(__dirname, "..", "cliente")));

  app.get("/api/salud", (req, res) => {
    res.json({
      estado: "ok",
      aplicacion: "Despensa Inteligente"
    });
  });

  return app;
}

module.exports = { crearApp };
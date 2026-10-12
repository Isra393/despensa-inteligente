const express = require("express");

function crearApi(sistema) {
  const router = express.Router();

  router.post("/usuarios", async (req, res, next) => {
    try {
      const usuario = await sistema.agregarUsuario(req.body?.email);
      res.status(201).json(usuario);
    } catch (error) {
      next(error);
    }
  });

  router.get("/usuarios", async (req, res, next) => {
    try {
      const usuarios = await sistema.listarUsuarios();
      res.json(usuarios);
    } catch (error) {
      next(error);
    }
  });

  router.get("/usuarios/:email/activo", async (req, res, next) => {
    try {
      const activo = await sistema.usuarioActivo(req.params.email);
      res.json({ activo });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/usuarios/:email", async (req, res, next) => {
    try {
      const resultado = await sistema.eliminarUsuario(req.params.email);
      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { crearApi };
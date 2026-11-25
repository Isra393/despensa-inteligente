const express = require("express");
const { createHash, timingSafeEqual } = require("node:crypto");

// Envía los avisos de caducidad pendientes de hoy. Un fallo con un
// usuario no detiene el envío al resto. Devuelve un recuento.
async function enviarAvisosCaducidad(sistema, correo, ahora = new Date()) {
  const avisos = await sistema.prepararAvisosCaducidad(ahora);
  const resultado = { pendientes: avisos.length, enviados: 0, fallidos: 0 };

  for (const aviso of avisos) {
    try {
      await correo.enviarAvisoCaducidad(aviso.email, aviso.alimentos);
      await sistema.registrarAvisoEnviado(aviso.email, ahora);
      resultado.enviados++;
    } catch {
      // No se registra el email para no guardar datos personales.
      console.error("No se ha podido enviar un aviso de caducidad");
      resultado.fallidos++;
    }
  }

  return resultado;
}

function resumen(texto) {
  return createHash("sha256").update(String(texto)).digest();
}

// Compara en tiempo constante para no dar pistas sobre el token.
function tokenValido(cabecera, esperado) {
  if (typeof cabecera !== "string" || !cabecera.startsWith("Bearer ")) {
    return false;
  }

  return timingSafeEqual(
    resumen(cabecera.slice("Bearer ".length)),
    resumen(esperado)
  );
}

// Rutas de tareas programadas. Las invoca Cloud Scheduler (u otro
// planificador) con el token secreto TAREAS_TOKEN.
function crearTareas(sistema, { correo, tokenTareas: token } = {}) {
  const router = express.Router();

  // Los secretos guardados desde consola suelen acabar en salto de línea.
  const tokenTareas = typeof token === "string" ? token.trim() : token;

  router.post("/tareas/avisos-caducidad", async (req, res, next) => {
    try {
      if (
        typeof tokenTareas !== "string" ||
        tokenTareas.length < 32 ||
        !correo ||
        typeof correo.enviarAvisoCaducidad !== "function"
      ) {
        return res.status(503).json({
          error: "Los avisos de caducidad no están configurados"
        });
      }

      if (!tokenValido(req.get("authorization"), tokenTareas)) {
        return res.status(401).json({ error: "No autorizado" });
      }

      const resultado = await enviarAvisosCaducidad(sistema, correo);

      console.log(JSON.stringify({
        evento: "avisos_caducidad",
        ...resultado
      }));

      res.json(resultado);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { enviarAvisosCaducidad, crearTareas };

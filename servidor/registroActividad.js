const { randomUUID } = require("node:crypto");

function identificarOperacion(req) {
  const ruta = req.path;

  if (ruta === "/salud") return "salud";
  if (ruta === "/registro") return "registro";
  if (ruta === "/login") return "login";
  if (ruta === "/logout") return "logout";
  if (ruta === "/sesion") return "consulta_sesion";
  if (ruta === "/usuarios") return "listar_usuarios";

  if (/^\/usuarios\/[^/]+\/activo\/?$/.test(ruta)) {
    return "consultar_usuario_activo";
  }

  if (/^\/usuarios\/[^/]+\/?$/.test(ruta)) {
    return "operacion_usuario";
  }

  return "ruta_desconocida";
}

function registroActividad(req, res, next) {
  const inicio = process.hrtime.bigint();
  const solicitudId = randomUUID();
  const operacion = identificarOperacion(req);

  res.setHeader("X-Request-Id", solicitudId);

  res.once("finish", () => {
    const duracionMs = Number(
      process.hrtime.bigint() - inicio
    ) / 1e6;

    const estado = res.statusCode;

    const severity =
      estado >= 500 ? "ERROR" :
      estado >= 400 ? "WARNING" :
      "INFO";

    console.log(JSON.stringify({
      severity,
      fecha: new Date().toISOString(),
      solicitudId,
      evento: "peticion_api",
      metodo: req.method,
      operacion,
      estado,
      duracionMs: Math.round(duracionMs),
    }));
  });

  next();
}

module.exports = { registroActividad };
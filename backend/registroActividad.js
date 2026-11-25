const { randomUUID } = require("node:crypto");

function identificarOperacion(req) {
  const ruta = req.path;

  if (ruta === "/salud") return "salud";
  if (ruta === "/registro") return "registro";
  if (ruta === "/login") return "login";
  if (ruta === "/logout") return "logout";
  if (ruta === "/sesion") return "consulta_sesion";
  if (ruta === "/usuarios") return "listar_usuarios";

  if (ruta === "/confirmar-cuenta") {
    return "confirmar_cuenta";
  }

  if (ruta === "/reenviar-confirmacion") {
    return "reenviar_confirmacion";
  }

  if (ruta === "/auth/google") {
    return "iniciar_acceso_google";
  }

  if (ruta === "/auth/google/callback") {
    return "completar_acceso_google";
  }

  if (ruta === "/auth/google/one-tap") {
    return "acceso_google_one_tap";
  }

  if (ruta === "/alimentos") return "alimentos";

  if (ruta === "/recetas") return "recetas";

  if (ruta === "/estadisticas") return "estadisticas";

  if (/^\/exportar\/(despensa|historial)\.csv$/.test(ruta)) {
    return `exportar_${ruta.split("/")[2].replace(".csv", "")}`;
  }

  if (ruta === "/hogar") return "hogar";

  if (/^\/hogar\/(invitacion|unirse|salir)\/?$/.test(ruta)) {
    return `hogar_${ruta.split("/")[2]}`;
  }

  if (/^\/hogar\/miembros\/[^/]+\/?$/.test(ruta)) return "hogar_quitar_miembro";

  if (/^\/recetas\/[^/]+\/lista-compra\/?$/.test(ruta)) return "receta_lista_compra";

  if (/^\/productos\/[^/]+\/?$/.test(ruta)) return "buscar_producto";

  if (ruta === "/preferencias/avisos") return "preferencias_avisos";

  if (ruta === "/lista-compra") return "lista_compra";

  if (/^\/lista-compra\/[^/]+\/?$/.test(ruta)) {
    return "operacion_lista_compra";
  }

  if (ruta === "/tareas/avisos-caducidad") return "tarea_avisos_caducidad";

  if (/^\/alimentos\/[^/]+\/cantidad\/?$/.test(ruta)) {
    return "cantidad_alimento";
  }

  if (/^\/alimentos\/[^/]+\/?$/.test(ruta)) {
    return "operacion_alimento";
  }

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
      duracionMs: Math.round(duracionMs)
    }));
  });

  next();
}

module.exports = { registroActividad };
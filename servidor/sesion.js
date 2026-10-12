const session = require("express-session");

const NOMBRE_COOKIE = "despensa.sid";

function opcionesCookie(produccion) {
  return {
    httpOnly: true,
    secure: produccion,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 2
  };
}

function crearSesion({ secret, produccion = false, store } = {}) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  }

  return session({
    name: NOMBRE_COOKIE,
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: opcionesCookie(produccion),
    ...(store ? { store } : {})
  });
}

module.exports = {
  crearSesion,
  opcionesCookie,
  NOMBRE_COOKIE
};
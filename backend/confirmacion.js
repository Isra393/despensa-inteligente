const { randomBytes, createHash } = require("node:crypto");

const DURACION_CONFIRMACION_MS = 24 * 60 * 60 * 1000;

function resumirToken(token) {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return null;
  }

  return createHash("sha256").update(token).digest("hex");
}

function crearConfirmacion(ahora = Date.now()) {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: resumirToken(token),
    caducaEn: new Date(
      ahora + DURACION_CONFIRMACION_MS
    )
  };
}

module.exports = {
  crearConfirmacion,
  resumirToken,
  DURACION_CONFIRMACION_MS
};
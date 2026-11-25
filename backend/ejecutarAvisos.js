// Envía una vez los avisos de caducidad pendientes y termina.
// Uso: npm run avisos
// Sirve para pruebas locales o para un Cloud Run Job programado,
// como alternativa a la ruta POST /api/tareas/avisos-caducidad.
require("dotenv").config({
  path: require("node:path").join(__dirname, ".env"),
  quiet: true
});

const { CadMongo } = require("./cadMongo");
const { Sistema } = require("./modelo");
const { crearCorreo } = require("./correo");
const { enviarAvisosCaducidad } = require("./avisos");

async function ejecutar() {
  let cad;

  try {
    cad = await CadMongo.conectar(
      process.env.MONGODB_URI,
      process.env.MONGODB_DB
    );

    const resultado = await enviarAvisosCaducidad(
      new Sistema(cad),
      crearCorreo(process.env)
    );

    console.log(JSON.stringify({ evento: "avisos_caducidad", ...resultado }));
    process.exitCode = resultado.fallidos > 0 ? 1 : 0;
  } catch (error) {
    console.error(`No se han podido enviar los avisos: ${error.name}`);
    process.exitCode = 1;
  } finally {
    if (cad) await cad.cerrar();
  }
}

ejecutar();

require("dotenv").config();

const { MongoStore } = require("connect-mongo");
const { crearApp } = require("./servidor/app");
const { Sistema } = require("./servidor/modelo");
const { CadMongo } = require("./servidor/cadMongo");
const {
  prepararCuentaPrueba,
} = require("./servidor/cuentaPrueba");

async function arrancar() {
  let cad;

  try {
    const secret = process.env.SESSION_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error("Configuración de sesión incorrecta");
    }

    cad = await CadMongo.conectar(
      process.env.MONGODB_URI,
      process.env.MONGODB_DB
    );

    console.log("Conexión a MongoDB establecida");

    await cad.baseDatos.collection("sesiones").createIndex(
      { expires: 1 },
      { expireAfterSeconds: 0 }
    );

    const store = MongoStore.create({
      client: cad.cliente,
      dbName: process.env.MONGODB_DB,
      collectionName: "sesiones",
      autoRemove: "disabled",
      ttl: 60 * 60 * 2,
    });

    store.on("error", () => {
      console.error("Error en el almacenamiento de sesiones");
    });

    const sistema = new Sistema(cad);

    await prepararCuentaPrueba(sistema, cad, process.env);

    const app = crearApp(sistema, {
      secret,
      produccion: process.env.NODE_ENV === "production",
      store,
    });

    const puerto = process.env.PORT || 3000;

    const servidor = app.listen(puerto, "0.0.0.0", () => {
      console.log(`Servidor iniciado en el puerto ${puerto}`);
    });

    servidor.on("error", async (error) => {
  console.error(
    `No se ha podido iniciar el servidor HTTP: ${error.code}`
  );

  await cad.cerrar();
  process.exitCode = 1;
});

    let cerrando = false;

    function cerrarServidor() {
      if (cerrando) return;
      cerrando = true;

      console.log("Cerrando el servidor");

      const limite = setTimeout(() => {
        process.exit(1);
      }, 8000);

      limite.unref();

      servidor.close(async () => {
        try {
          await cad.cerrar();
          clearTimeout(limite);
          process.exitCode = 0;
        } catch {
          console.error("Error al cerrar la conexión");
          process.exitCode = 1;
        }
      });
    }

    process.once("SIGTERM", cerrarServidor);
    process.once("SIGINT", cerrarServidor);
  } catch (error) {
    console.error(
      "No se ha podido arrancar. Revisa las variables de entorno, " +
      "las credenciales y el acceso de red de Atlas."
    );

    console.error(`Tipo de error: ${error.name}`);

    if (cad) {
      await cad.cerrar();
    }

    process.exitCode = 1;
  }
}

arrancar();
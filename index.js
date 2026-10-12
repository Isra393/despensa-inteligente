require("dotenv").config();

const { crearApp } = require("./servidor/app");
const { Sistema } = require("./servidor/modelo");
const { CadMemoria } = require("./servidor/cadMemoria");
const { prepararCuentaPrueba } = require("./servidor/cuentaPrueba");

async function arrancar() {
  const cad = new CadMemoria();
  const sistema = new Sistema(cad);

  await prepararCuentaPrueba(sistema, cad, process.env);

  const app = crearApp(sistema);
  const puerto = process.env.PORT || 3000;

  app.listen(puerto, "0.0.0.0", () => {
    console.log(
      `Despensa Inteligente escuchando en el puerto ${puerto}`
    );
  });
}

arrancar().catch(() => {
  console.error("No se pudo iniciar el servidor. Revisa la configuración.");
  process.exitCode = 1;
});
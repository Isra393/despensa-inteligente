const { crearApp } = require("./servidor/app");

const app = crearApp();
const puerto = process.env.PORT || 3000;

app.listen(puerto, "0.0.0.0", () => {
  console.log(`Despensa Inteligente escuchando en el puerto ${puerto}`);
});
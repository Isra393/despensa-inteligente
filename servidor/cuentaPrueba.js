async function prepararCuentaPrueba(sistema, cad, configuracion) {
  if (configuracion.ENABLE_TEST_ACCOUNT !== "true") {
    return;
  }

  const email = configuracion.TEST_ACCOUNT_EMAIL;
  const password = configuracion.TEST_ACCOUNT_PASSWORD;

  if (!email || !password) {
    throw new Error("Faltan las credenciales de la cuenta de prueba");
  }

  const normalizado = sistema.normalizarEmail(email);
  const existente = await cad.buscarPorEmail(normalizado);

  // No modifica una cuenta existente.
  if (existente) {
    return;
  }

  await sistema.registrarUsuario(normalizado, password);

  const usuario = await cad.buscarPorEmail(normalizado);

  await cad.guardar({
    ...usuario,
    estado: "activo"
  });

  console.log("Cuenta de prueba preparada");
}

module.exports = { prepararCuentaPrueba };
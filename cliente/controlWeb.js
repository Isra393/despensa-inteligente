const rest = new ClienteRest();

const acceso = document.querySelector("#acceso");
const panel = document.querySelector("#panel");
const mensaje = document.querySelector("#mensaje");
const usuario = document.querySelector("#usuario");
const botonAdmin = document.querySelector("#btn-admin");
const panelAdmin = document.querySelector("#panel-admin");
const botonActualizar = document.querySelector("#btn-actualizar-usuarios");
const estadoUsuarios = document.querySelector("#estado-usuarios");
const tablaUsuarios = document.querySelector("#tabla-usuarios");
const filasUsuarios = document.querySelector("#filas-usuarios");

let usuarioActual = null;
let versionVista = 0;
let cargandoUsuarios = false;

function mostrarMensaje(texto, esError = false) {
  mensaje.textContent = texto;
  mensaje.className = esError ? "error" : "correcto";
}

function sesionCaducada() {
  mostrarAcceso();
  mostrarMensaje("La sesión ha caducado. Inicia sesión de nuevo.", true);
}

const listaCompra = new ListaCompra(rest, { mostrarMensaje, sesionCaducada });

const despensa = new Despensa(rest, {
  mostrarMensaje,
  sesionCaducada,
  alCambiar: () => listaCompra.cargar()
});
const avisos = new Avisos(rest, { mostrarMensaje, sesionCaducada });

const oneTap = new GoogleOneTap(rest, {
  mostrarMensaje,
  alIniciarSesion(datos) {
    mostrarUsuario(datos);
    mostrarMensaje("Sesión iniciada con Google");
  }
});

// Mensajes para los códigos que devuelve el servidor al fallar Google.
const ERRORES_GOOGLE = {
  cancelado: "Has cancelado el acceso con Google.",
  no_disponible: "El acceso con Google no está disponible en este momento.",
  cuenta_existente:
    "Ya existe una cuenta con ese correo. Inicia sesión con tu contraseña.",
  cuenta_no_permitida: "Esta cuenta no tiene permitido iniciar sesión.",
  fallo: "No se ha podido completar el acceso con Google. Vuelve a intentarlo."
};

function limpiarPanelAdmin() {
  versionVista++;
  cargandoUsuarios = false;
  panelAdmin.hidden = true;
  tablaUsuarios.hidden = true;
  filasUsuarios.replaceChildren();
  estadoUsuarios.textContent = "";
  estadoUsuarios.className = "";
  botonActualizar.disabled = false;
  panelAdmin.removeAttribute("aria-busy");
}

function mostrarUsuario(datos) {
  limpiarPanelAdmin();
  usuarioActual = datos;
  acceso.hidden = true;
  panel.hidden = false;
  usuario.textContent = datos.email;
  botonAdmin.hidden = datos.rol !== "administrador";
  oneTap.ocultar();
  despensa.mostrar();
  avisos.mostrar();
}

function mostrarAcceso() {
  limpiarPanelAdmin();
  usuarioActual = null;
  acceso.hidden = false;
  panel.hidden = true;
  botonAdmin.hidden = true;
  usuario.textContent = "";
  despensa.limpiar();
  listaCompra.limpiar();
  avisos.limpiar();
}

function crearCelda(texto) {
  const celda = document.createElement("td");
  celda.textContent = texto ?? "";
  return celda;
}

async function cargarUsuarios() {
  if (
    usuarioActual?.rol !== "administrador" ||
    cargandoUsuarios
  ) {
    return;
  }

  const versionSolicitud = versionVista;
  cargandoUsuarios = true;
  panelAdmin.hidden = false;
  panelAdmin.setAttribute("aria-busy", "true");
  botonActualizar.disabled = true;
  tablaUsuarios.hidden = true;
  filasUsuarios.replaceChildren();
  estadoUsuarios.className = "";
  estadoUsuarios.textContent = "Cargando usuarios…";

  try {
    const usuarios = await rest.listarUsuarios();

    // Ignora respuestas de una sesión o vista anterior.
    if (versionSolicitud !== versionVista) return;

    if (!Array.isArray(usuarios)) {
      throw new Error("La lista recibida no tiene el formato esperado");
    }

    const fragmento = document.createDocumentFragment();

    for (const cuenta of usuarios) {
      const fila = document.createElement("tr");
      fila.append(
        crearCelda(cuenta.email),
        crearCelda(cuenta.rol),
        crearCelda(cuenta.estado)
      );
      fragmento.append(fila);
    }

    filasUsuarios.replaceChildren(fragmento);
    tablaUsuarios.hidden = usuarios.length === 0;
    estadoUsuarios.textContent = usuarios.length === 0
      ? "No hay usuarios registrados."
      : `Total de usuarios: ${usuarios.length}`;
  } catch (error) {
    if (versionSolicitud !== versionVista) return;

    if (error.estadoHTTP === 401) {
      sesionCaducada();
      return;
    }

    if (error.estadoHTTP === 403) {
      limpiarPanelAdmin();
      botonAdmin.hidden = true;
      mostrarMensaje(error.message, true);
      return;
    }

    estadoUsuarios.textContent = error.message;
    estadoUsuarios.className = "error";
  } finally {
    if (versionSolicitud === versionVista) {
      cargandoUsuarios = false;
      botonActualizar.disabled = false;
      panelAdmin.removeAttribute("aria-busy");
    }
  }
}

async function ejecutarFormulario(formulario, accion) {
  const boton = formulario.querySelector("button");
  boton.disabled = true;
  mostrarMensaje("");

  try {
    await accion();
  } catch (error) {
    mostrarMensaje(error.message, true);
  } finally {
    boton.disabled = false;
  }
}

document.querySelector("#form-registro")
  .addEventListener("submit", event => {
    event.preventDefault();

    ejecutarFormulario(event.currentTarget, async () => {
      const email = document.querySelector("#registro-email").value;
      const campoPassword = document.querySelector("#registro-password");
      const campoRepetida = document.querySelector("#registro-password-repetida");
      const password = campoPassword.value;

      if (password.length < 8) {
        campoPassword.focus();
        throw new Error("La contraseña debe tener al menos 8 caracteres.");
      }

      if (password !== campoRepetida.value) {
        campoRepetida.focus();
        throw new Error("Las contraseñas no coinciden.");
      }

      const resultado = await rest.registrar(email, password);

      campoPassword.value = "";
      campoRepetida.value = "";
      document.querySelector("#login-email").value = email;
      mostrarMensaje(resultado.mensaje);
    });
  });

document.querySelector("#form-login")
  .addEventListener("submit", event => {
    event.preventDefault();

    ejecutarFormulario(event.currentTarget, async () => {
      const email = document.querySelector("#login-email").value;
      const password = document.querySelector("#login-password").value;
      const resultado = await rest.login(email, password);

      document.querySelector("#login-password").value = "";
      mostrarUsuario(resultado.usuario);
      mostrarMensaje("Sesión iniciada");
    });
  });

document.querySelector("#btn-salir")
  .addEventListener("click", async event => {
    const boton = event.currentTarget;
    boton.disabled = true;

    // Vacía la tabla e invalida cualquier carga pendiente.
    limpiarPanelAdmin();

    try {
      await rest.logout();
      oneTap.alCerrarSesion();
      mostrarAcceso();
      mostrarMensaje("Has cerrado sesión");
    } catch (error) {
      mostrarMensaje(error.message, true);
    } finally {
      boton.disabled = false;
    }
  });

botonAdmin.addEventListener("click", cargarUsuarios);
botonActualizar.addEventListener("click", cargarUsuarios);

async function comprobarSesion() {
  try {
    const resultado = await rest.sesion();
    mostrarUsuario(resultado.usuario);
  } catch (error) {
    mostrarAcceso();

    if (error.estadoHTTP === 401) {
      oneTap.mostrar();
    } else {
      mostrarMensaje(error.message, true);
    }
  }
}

// Muestra un mensaje si el servidor ha devuelto un error de Google.
function prepararErrorGoogle() {
  const parametros = new URLSearchParams(window.location.hash.slice(1));

  if (!parametros.has("error-google")) {
    return;
  }

  const codigo = parametros.get("error-google");

  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );

  mostrarMensaje(ERRORES_GOOGLE[codigo] || ERRORES_GOOGLE.fallo, true);
}
document.querySelector("#form-reenvio")
  .addEventListener("submit", event => {
    event.preventDefault();

    ejecutarFormulario(event.currentTarget, async () => {
      const email = document.querySelector("#reenvio-email").value;

      const resultado = await rest.reenviarConfirmacion(email);

      mostrarMensaje(resultado.mensaje);
    });
  });

function prepararConfirmacion() {
  const parametros = new URLSearchParams(
    window.location.hash.slice(1)
  );

  if (!parametros.has("confirmacion")) {
    return false;
  }

  let token = parametros.get("confirmacion");

  // Retira el token de la barra de direcciones.
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );

  mostrarAcceso();

  if (!/^[a-f0-9]{64}$/.test(token)) {
    mostrarMensaje("El enlace de confirmación no es válido.", true);
    return true;
  }

  const seccion = document.querySelector("#confirmacion");
  const boton = document.querySelector("#btn-confirmar-cuenta");

  seccion.hidden = false;
  acceso.hidden = true;

  boton.addEventListener("click", async () => {
    boton.disabled = true;
    mostrarMensaje("");

    try {
      const resultado = await rest.confirmarCuenta(token);

      token = null;
      seccion.hidden = true;
      mostrarAcceso();
      mostrarMensaje(resultado.mensaje);
    } catch (error) {
      mostrarMensaje(error.message, true);
    } finally {
      boton.disabled = false;
    }
  });

  return true;
}

prepararErrorGoogle();

if (!prepararConfirmacion()) {
  comprobarSesion();
}
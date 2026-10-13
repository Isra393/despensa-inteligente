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
  usuario.textContent = `Has iniciado sesión como ${datos.email}`;
  botonAdmin.hidden = datos.rol !== "administrador";
}

function mostrarAcceso() {
  limpiarPanelAdmin();
  usuarioActual = null;
  acceso.hidden = false;
  panel.hidden = true;
  botonAdmin.hidden = true;
  usuario.textContent = "";
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
      mostrarAcceso();
      mostrarMensaje("La sesión ha caducado. Inicia sesión de nuevo.", true);
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
      const password = document.querySelector("#registro-password").value;
      const resultado = await rest.registrar(email, password);

      document.querySelector("#registro-password").value = "";
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

    if (error.estadoHTTP !== 401) {
      mostrarMensaje(error.message, true);
    }
  }
}

comprobarSesion();
const rest = new ClienteRest();

const acceso = document.querySelector("#acceso");
const panel = document.querySelector("#panel");
const mensaje = document.querySelector("#mensaje");
const usuario = document.querySelector("#usuario");

function mostrarMensaje(texto, esError = false) {
  mensaje.textContent = texto;
  mensaje.className = esError ? "error" : "correcto";
}

function mostrarUsuario(datos) {
  acceso.hidden = true;
  panel.hidden = false;
  usuario.textContent = `Has iniciado sesión como ${datos.email}`;
}

function mostrarAcceso() {
  acceso.hidden = false;
  panel.hidden = true;
  usuario.textContent = "";
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
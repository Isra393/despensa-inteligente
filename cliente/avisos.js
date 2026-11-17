// Preferencias de los avisos de caducidad por correo.
class Avisos {
  constructor(rest, { mostrarMensaje, sesionCaducada }) {
    this.rest = rest;
    this.mostrarMensaje = mostrarMensaje;
    this.sesionCaducada = sesionCaducada;
    this.version = 0;

    this.formulario = document.querySelector("#form-avisos");
    this.activo = document.querySelector("#avisos-activo");
    this.dias = document.querySelector("#avisos-dias");
    this.boton = document.querySelector("#btn-guardar-avisos");
    this.estado = document.querySelector("#estado-avisos");

    this.formulario.addEventListener("submit", evento => {
      evento.preventDefault();
      this.guardar();
    });

    this.activo.addEventListener("change", () => this.actualizarDias());
  }

  actualizarDias() {
    this.dias.disabled = !this.activo.checked;
  }

  pintar({ activo, diasAntelacion }) {
    this.activo.checked = activo;

    // Si la antelación guardada no está en la lista, se añade.
    const valor = String(diasAntelacion);

    if (![...this.dias.options].some(opcion => opcion.value === valor)) {
      this.dias.add(new Option(`${valor} días de antelación`, valor));
    }

    this.dias.value = valor;
    this.actualizarDias();
  }

  async mostrar() {
    const version = this.version;
    this.estado.textContent = "";

    try {
      const preferencias = await this.rest.obtenerAvisos();
      if (version !== this.version) return;
      this.pintar(preferencias);
    } catch (error) {
      if (version !== this.version) return;
      this.tratarError(error);
    }
  }

  limpiar() {
    this.version++;
    this.formulario.reset();
    this.estado.textContent = "";
    this.estado.className = "";
    this.actualizarDias();
  }

  async guardar() {
    this.boton.disabled = true;
    this.estado.textContent = "";
    this.estado.className = "";

    try {
      const preferencias = await this.rest.guardarAvisos({
        activo: this.activo.checked,
        diasAntelacion: Number(this.dias.value)
      });

      this.pintar(preferencias);
      this.estado.className = "correcto";
      this.estado.textContent = preferencias.activo
        ? "Avisos activados."
        : "Avisos desactivados.";
    } catch (error) {
      this.tratarError(error);
    } finally {
      this.boton.disabled = false;
    }
  }

  tratarError(error) {
    if (error.estadoHTTP === 401) {
      this.sesionCaducada();
      return;
    }

    this.estado.className = "error";
    this.estado.textContent = error.message;
  }
}

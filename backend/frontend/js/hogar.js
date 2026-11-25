// Hogar: compartir la despensa con las personas con las que vives.
class Hogar {
  constructor(rest, { mostrarMensaje, sesionCaducada, alCambiarDespensa }) {
    this.rest = rest;
    this.mostrarMensaje = mostrarMensaje;
    this.sesionCaducada = sesionCaducada;
    this.alCambiarDespensa = alCambiarDespensa;
    this.version = 0;

    this.descripcion = document.querySelector("#descripcion-hogar");
    this.miembros = document.querySelector("#miembros-hogar");
    this.botonInvitar = document.querySelector("#btn-invitar-hogar");
    this.zonaCodigo = document.querySelector("#codigo-invitacion");
    this.textoCodigo = document.querySelector("#texto-codigo-invitacion");
    this.caducidadCodigo = document.querySelector("#caducidad-codigo-invitacion");
    this.botonCopiar = document.querySelector("#btn-copiar-codigo");
    this.formularioUnirse = document.querySelector("#form-unirse-hogar");
    this.codigoUnirse = document.querySelector("#codigo-unirse");
    this.botonSalir = document.querySelector("#btn-salir-hogar");
    this.estado = document.querySelector("#estado-hogar");

    this.botonInvitar.addEventListener("click", () => this.invitar());
    this.botonCopiar.addEventListener("click", () => this.copiar());
    this.botonSalir.addEventListener("click", () => this.salir());
    this.formularioUnirse.addEventListener("submit", evento => {
      evento.preventDefault();
      this.unirse();
    });
  }

  async cargar() {
    const version = this.version;

    try {
      const hogar = await this.rest.obtenerHogar();
      if (version !== this.version) return;
      this.pintar(hogar);
    } catch (error) {
      if (version !== this.version) return;
      this.tratarError(error);
    }
  }

  limpiar() {
    this.version++;
    this.miembros.replaceChildren();
    this.descripcion.textContent = "";
    this.zonaCodigo.hidden = true;
    this.textoCodigo.textContent = "";
    this.formularioUnirse.reset();
    this.ponerEstado("");
  }

  ponerEstado(texto, clase = "") {
    this.estado.className = clase;
    this.estado.textContent = texto;
  }

  pintar(hogar) {
    this.hogar = hogar;
    const otros = hogar.miembros.length - 1;

    this.descripcion.textContent = hogar.compartido
      ? `Compartes la despensa y la lista de la compra con ${otros} ${otros === 1 ? "persona" : "personas"}.`
      : "Solo tú usas esta despensa. Invita a quien vive contigo para compartirla.";

    this.miembros.hidden = !hogar.compartido;
    this.miembros.replaceChildren(...hogar.miembros.map(m => this.crearMiembro(m)));

    this.botonSalir.hidden = !hogar.compartido;
    this.botonInvitar.disabled = hogar.miembros.length >= hogar.maxMiembros;

    if (hogar.invitacion && this.zonaCodigo.hidden) {
      this.caducidadCodigo.textContent =
        `Tienes un código activo hasta el ${this.fecha(hogar.invitacion.caducaEn)}. Si lo has perdido, crea otro.`;
    }
  }

  fecha(valor) {
    return new Date(valor).toLocaleString("es-ES", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  crearMiembro(miembro) {
    const elemento = document.createElement("li");

    const email = document.createElement("span");
    email.className = "email-miembro";
    email.textContent = miembro.soyYo ? `${miembro.email} (tú)` : miembro.email;
    elemento.append(email);

    if (!miembro.soyYo) {
      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.className = "enlace enlace-peligro";
      quitar.textContent = "Quitar";
      quitar.setAttribute("aria-label", `Quitar a ${miembro.email} del hogar`);
      quitar.addEventListener("click", () => this.quitar(miembro.email, quitar));
      elemento.append(quitar);
    }

    return elemento;
  }

  async invitar() {
    this.botonInvitar.disabled = true;
    this.ponerEstado("");

    try {
      const { codigo, caducaEn } = await this.rest.crearInvitacionHogar();
      this.textoCodigo.textContent = codigo;
      this.caducidadCodigo.textContent =
        `Compártelo con quien quieras invitar. Sirve una sola vez y caduca el ${this.fecha(caducaEn)}.`;
      this.zonaCodigo.hidden = false;
      this.botonCopiar.textContent = "Copiar";
      this.botonCopiar.focus();
    } catch (error) {
      this.tratarError(error);
    } finally {
      this.botonInvitar.disabled = false;
    }
  }

  async copiar() {
    try {
      await navigator.clipboard.writeText(this.textoCodigo.textContent);
      this.botonCopiar.textContent = "Copiado ✓";
    } catch {
      this.ponerEstado("No se ha podido copiar. Selecciona el código y cópialo a mano.");
    }
  }

  async unirse() {
    const codigo = this.codigoUnirse.value.trim();

    if (!codigo) {
      this.ponerEstado("Escribe el código que te han pasado.", "error");
      this.codigoUnirse.focus();
      return;
    }

    const aviso = this.hogar?.compartido
      ? "Vas a dejar tu hogar actual: sus alimentos se quedarán allí. ¿Continuar?"
      : "Tus alimentos y tu lista de la compra pasarán a la despensa compartida. ¿Continuar?";

    if (!window.confirm(aviso)) return;

    const boton = this.formularioUnirse.querySelector("button");
    boton.disabled = true;

    try {
      const hogar = await this.rest.unirseHogar(codigo);
      this.formularioUnirse.reset();
      this.pintar(hogar);
      this.mostrarMensaje("Ya compartes la despensa con tu hogar");
      await this.alCambiarDespensa();
    } catch (error) {
      this.tratarError(error);
    } finally {
      boton.disabled = false;
    }
  }

  async salir() {
    if (!window.confirm(
      "Si sales del hogar empezarás con una despensa vacía. Los alimentos se quedan con los demás. ¿Salir?"
    )) {
      return;
    }

    this.botonSalir.disabled = true;

    try {
      const hogar = await this.rest.salirHogar();
      this.zonaCodigo.hidden = true;
      this.pintar(hogar);
      this.mostrarMensaje("Has salido del hogar");
      await this.alCambiarDespensa();
    } catch (error) {
      this.tratarError(error);
    } finally {
      this.botonSalir.disabled = false;
    }
  }

  async quitar(email, boton) {
    if (!window.confirm(`¿Quitar a ${email} del hogar? Empezará con una despensa vacía.`)) {
      return;
    }

    boton.disabled = true;

    try {
      this.pintar(await this.rest.quitarMiembroHogar(email));
      this.mostrarMensaje(`${email} ya no comparte tu despensa`);
    } catch (error) {
      boton.disabled = false;
      this.tratarError(error);
    }
  }

  tratarError(error) {
    if (error.estadoHTTP === 401) {
      this.sesionCaducada();
      return;
    }

    this.ponerEstado(error.message, "error");
  }
}

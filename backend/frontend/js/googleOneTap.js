// Muestra el diálogo «One Tap» de Google a los visitantes sin sesión.
// Si el servidor no tiene configurado Google, no se muestra nada.
class GoogleOneTap {
  constructor(rest, { alIniciarSesion, mostrarMensaje }) {
    this.rest = rest;
    this.alIniciarSesion = alIniciarSesion;
    this.mostrarMensaje = mostrarMensaje;
    this.cargaLibreria = null;
  }

  cargarLibreria() {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }

    if (!this.cargaLibreria) {
      this.cargaLibreria = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => {
          this.cargaLibreria = null;
          reject(new Error("No se ha podido cargar Google"));
        };
        document.head.append(script);
      });
    }

    return this.cargaLibreria;
  }

  async mostrar() {
    let configuracion;

    try {
      configuracion = await this.rest.prepararOneTap();

      if (!configuracion.disponible) return;

      await this.cargarLibreria();
    } catch {
      // Google no está configurado o no se puede contactar:
      // el resto de formas de acceso siguen disponibles.
      return;
    }

    window.google.accounts.id.initialize({
      client_id: configuracion.clientId,
      nonce: configuracion.nonce,
      callback: respuesta => this.acceder(respuesta.credential),
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      use_fedcm_for_prompt: true
    });

    window.google.accounts.id.prompt();
  }

  async acceder(credential) {
    try {
      const { usuario } = await this.rest.accederOneTap(credential);
      this.alIniciarSesion(usuario);
    } catch (error) {
      this.mostrarMensaje(error.message, true);
    }
  }

  ocultar() {
    window.google?.accounts?.id?.cancel();
  }

  // Evita que Google vuelva a seleccionar la cuenta automáticamente
  // justo después de cerrar sesión.
  alCerrarSesion() {
    window.google?.accounts?.id?.disableAutoSelect();
  }
}

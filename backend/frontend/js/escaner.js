// Escáner de códigos de barras. Usa la cámara con BarcodeDetector cuando
// el navegador lo permite y, si no, deja escribir el código a mano.
class Escaner {
  constructor(rest, { alUsarProducto, alCambiar, mostrarMensaje, sesionCaducada }) {
    this.rest = rest;
    this.alUsarProducto = alUsarProducto;
    this.alCambiar = alCambiar;
    this.mostrarMensaje = mostrarMensaje;
    this.sesionCaducada = sesionCaducada;

    this.flujo = null;
    this.temporizador = null;
    this.resultado = null;
    this.codigoBuscado = null;

    this.dialogo = document.querySelector("#dialogo-escaner");
    this.zonaCamara = document.querySelector("#zona-camara");
    this.video = document.querySelector("#video-escaner");
    this.estado = document.querySelector("#estado-escaner");
    this.formulario = document.querySelector("#form-codigo");
    this.codigo = document.querySelector("#codigo-manual");
    this.botonBuscar = document.querySelector("#btn-buscar-codigo");
    this.zonaResultado = document.querySelector("#resultado-escaner");
    this.nombre = document.querySelector("#resultado-nombre");
    this.detalle = document.querySelector("#resultado-detalle");
    this.botonUsar = document.querySelector("#btn-usar-producto");
    this.botonSumar = document.querySelector("#btn-sumar-existente");

    document.querySelector("#btn-escanear")
      .addEventListener("click", () => this.abrir());
    document.querySelector("#btn-cerrar-escaner")
      .addEventListener("click", () => this.dialogo.close());

    // Al cerrar por cualquier vía (botón, Escape) se apaga la cámara.
    this.dialogo.addEventListener("close", () => this.detenerCamara());

    this.formulario.addEventListener("submit", evento => {
      evento.preventDefault();
      this.buscar(this.codigo.value.replace(/\s+/g, ""));
    });

    this.botonUsar.addEventListener("click", () => this.usar());
    this.botonSumar.addEventListener("click", () => this.sumar());
  }

  async abrir() {
    this.zonaResultado.hidden = true;
    this.formulario.reset();
    this.estado.className = "estado-escaner";
    this.dialogo.showModal();

    if (await this.camaraDisponible()) {
      await this.iniciarCamara();
    } else {
      this.zonaCamara.hidden = true;
      this.estado.textContent =
        "Tu navegador no permite escanear con la cámara. Escribe el código que aparece bajo las barras.";
      this.codigo.focus();
    }
  }

  async camaraDisponible() {
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    try {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      return ["ean_13", "ean_8", "upc_a"].some(f => formatos.includes(f));
    } catch {
      return false;
    }
  }

  async iniciarCamara() {
    this.estado.textContent = "Abriendo la cámara…";

    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
    } catch (error) {
      this.zonaCamara.hidden = true;
      this.estado.textContent = error.name === "NotAllowedError"
        ? "No tenemos permiso para usar la cámara. Puedes escribir el código."
        : "No hemos podido abrir la cámara. Puedes escribir el código.";
      this.codigo.focus();
      return;
    }

    // Si el diálogo se cerró mientras se pedía el permiso.
    if (!this.dialogo.open) {
      this.detenerCamara();
      return;
    }

    this.video.srcObject = this.flujo;
    await this.video.play().catch(() => {});
    this.zonaCamara.hidden = false;
    this.estado.textContent = "Apunta al código de barras del producto.";

    this.detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e"]
    });

    this.detectar();
  }

  detectar() {
    this.temporizador = setTimeout(async () => {
      if (!this.flujo) return;

      try {
        const codigos = await this.detector.detect(this.video);
        const leido = codigos.map(c => c.rawValue).find(v => /^\d{8,14}$/.test(v));

        if (leido) {
          this.detenerCamara();
          this.codigo.value = leido;
          await this.buscar(leido);
          return;
        }
      } catch {
        // Fotograma no disponible todavía: se reintenta.
      }

      this.detectar();
    }, 250);
  }

  detenerCamara() {
    clearTimeout(this.temporizador);
    this.temporizador = null;

    if (this.flujo) {
      for (const pista of this.flujo.getTracks()) pista.stop();
      this.flujo = null;
    }

    this.video.srcObject = null;
    this.zonaCamara.hidden = true;
  }

  async buscar(codigo) {
    this.zonaResultado.hidden = true;
    this.estado.className = "estado-escaner";

    if (!/^(\d{8}|\d{12,14})$/.test(codigo)) {
      this.estado.className = "estado-escaner error";
      this.estado.textContent = "El código debe tener 8, 12, 13 o 14 cifras.";
      this.codigo.focus();
      return;
    }

    this.detenerCamara();
    this.codigoBuscado = codigo;
    this.botonBuscar.disabled = true;
    this.estado.textContent = "Buscando el producto…";

    try {
      this.resultado = await this.rest.buscarProducto(codigo);
      this.estado.textContent = "";
      this.pintarResultado();
    } catch (error) {
      if (error.estadoHTTP === 401) {
        this.dialogo.close();
        this.sesionCaducada();
        return;
      }

      this.estado.className = "estado-escaner error";
      this.estado.textContent = error.message;

      // Aunque no esté en el catálogo, se puede guardar con su código.
      if (error.estadoHTTP === 404) {
        this.resultado = { producto: { codigo }, enDespensa: null };
        this.nombre.textContent = "";
        this.detalle.textContent = "";
        this.botonSumar.hidden = true;
        this.botonUsar.textContent = "Añadir a mano con este código";
        this.botonUsar.className = "";
        this.botonUsar.hidden = false;
        this.zonaResultado.hidden = false;
      }
    } finally {
      this.botonBuscar.disabled = false;
    }
  }

  textoCantidad(cantidad, unidad) {
    const nombre = unidad === "unidades" && cantidad === 1 ? "unidad" : unidad;
    return `${cantidad.toLocaleString("es-ES")} ${nombre}`;
  }

  // Lo que suma «una más»: el envase si coincide la unidad; si no, el paso.
  deltaSumar() {
    const { producto, enDespensa } = this.resultado;

    if (producto?.unidad && producto.unidad === enDespensa.unidad) {
      return producto.cantidad;
    }

    return enDespensa.paso ?? 1;
  }

  pintarResultado() {
    const { producto, enDespensa } = this.resultado;

    if (producto?.nombre) {
      this.nombre.textContent = producto.marca
        ? `${producto.nombre} · ${producto.marca}`
        : producto.nombre;

      this.detalle.textContent =
        `${this.textoCantidad(producto.cantidad, producto.unidad)} · ${producto.categoria}`;
    } else {
      this.nombre.textContent = enDespensa.nombre;
      this.detalle.textContent = "No hemos podido consultar el catálogo, pero ya lo tienes en tu despensa.";
    }

    if (enDespensa) {
      this.botonSumar.hidden = false;
      this.botonSumar.textContent =
        `Sumar ${this.textoCantidad(this.deltaSumar(), enDespensa.unidad)} a «${enDespensa.nombre}»`;
      this.botonUsar.textContent = "Añadirlo como otro alimento";
      this.botonUsar.className = "secundario";
      this.botonUsar.hidden = !producto?.nombre;
      this.botonSumar.focus();
    } else {
      this.botonSumar.hidden = true;
      this.botonUsar.hidden = false;
      this.botonUsar.className = "";
      this.botonUsar.textContent = "Rellenar el formulario";
      this.botonUsar.focus();
    }

    this.zonaResultado.hidden = false;
  }

  usar() {
    const producto = this.resultado?.producto || { codigo: this.codigoBuscado };
    this.dialogo.close();
    this.alUsarProducto(producto);
  }

  async sumar() {
    const { enDespensa } = this.resultado;
    const delta = this.deltaSumar();
    this.botonSumar.disabled = true;

    try {
      await this.rest.ajustarCantidad(enDespensa.id, delta);
      this.dialogo.close();
      this.mostrarMensaje(
        `Sumado ${this.textoCantidad(delta, enDespensa.unidad)} a «${enDespensa.nombre}»`
      );
      await this.alCambiar();
    } catch (error) {
      this.estado.className = "estado-escaner error";
      this.estado.textContent = error.message;
    } finally {
      this.botonSumar.disabled = false;
    }
  }
}

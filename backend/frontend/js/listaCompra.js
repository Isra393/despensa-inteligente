// Lista de la compra: alimentos que han bajado de su mínimo (los calcula
// el servidor) y productos que el usuario añade a mano.
class ListaCompra {
  constructor(rest, { mostrarMensaje, sesionCaducada }) {
    this.rest = rest;
    this.mostrarMensaje = mostrarMensaje;
    this.sesionCaducada = sesionCaducada;
    this.version = 0;

    this.contador = document.querySelector("#contador-lista");
    this.estado = document.querySelector("#estado-lista");
    this.automaticos = document.querySelector("#lista-automaticos");
    this.manuales = document.querySelector("#lista-manuales");
    this.formulario = document.querySelector("#form-lista");
    this.nombre = document.querySelector("#lista-nombre");
    this.cantidad = document.querySelector("#lista-cantidad");
    this.botonAgregar = document.querySelector("#btn-agregar-lista");
    this.error = document.querySelector("#error-lista");
    this.botonVaciar = document.querySelector("#btn-vaciar-comprados");

    this.formulario.addEventListener("submit", evento => {
      evento.preventDefault();
      this.agregar();
    });

    this.botonVaciar.addEventListener("click", () => this.vaciarComprados());
  }

  async cargar() {
    const version = this.version;

    try {
      const lista = await this.rest.obtenerListaCompra();
      if (version !== this.version) return;
      this.pintar(lista);
    } catch (error) {
      if (version !== this.version) return;
      this.tratarError(error);
    }
  }

  limpiar() {
    this.version++;
    this.automaticos.replaceChildren();
    this.manuales.replaceChildren();
    this.formulario.reset();
    this.error.textContent = "";
    this.estado.textContent = "";
    this.contador.hidden = true;
    this.botonVaciar.hidden = true;
  }

  pintar({ automaticos, manuales }) {
    this.automaticos.replaceChildren(
      ...automaticos.map(alimento => this.crearAutomatico(alimento))
    );

    this.manuales.replaceChildren(
      ...manuales.map(elemento => this.crearManual(elemento))
    );

    const pendientes =
      automaticos.length + manuales.filter(e => !e.comprado).length;

    this.contador.hidden = pendientes === 0;
    this.contador.textContent = `${pendientes} pendiente${pendientes === 1 ? "" : "s"}`;
    this.botonVaciar.hidden = !manuales.some(e => e.comprado);

    this.estado.textContent =
      automaticos.length === 0 && manuales.length === 0
        ? "Tu lista está vacía. Añade productos o fija un mínimo en tus alimentos."
        : "";
  }

  crearAutomatico(alimento) {
    const elemento = document.createElement("li");
    elemento.className = "elemento-automatico";

    const texto = document.createElement("span");

    const nombre = document.createElement("span");
    nombre.className = "nombre-automatico";
    nombre.textContent = alimento.nombre;

    const detalle = document.createElement("span");
    detalle.className = "elemento-detalle";
    const unidad = alimento.unidad === "unidades" && alimento.cantidad === 1
      ? "unidad"
      : alimento.unidad;

    detalle.textContent =
      ` · ${alimento.cantidad === 1 ? "queda" : "quedan"} ` +
      `${alimento.cantidad.toLocaleString("es-ES")} ${unidad}` +
      ` (mínimo ${alimento.stockMinimo.toLocaleString("es-ES")})`;

    texto.append(nombre, detalle);

    const etiqueta = document.createElement("span");
    etiqueta.className = "pastilla pastilla-reponer";
    etiqueta.textContent = "Reponer";

    elemento.append(texto, etiqueta);
    return elemento;
  }

  crearManual(datos) {
    const elemento = document.createElement("li");
    if (datos.comprado) elemento.className = "elemento-comprado";

    const etiqueta = document.createElement("label");
    etiqueta.className = "casilla";

    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.checked = datos.comprado;
    casilla.addEventListener("change", () =>
      this.marcar(datos, casilla)
    );

    const texto = document.createElement("span");
    texto.textContent = datos.nombre;

    if (datos.cantidad) {
      const detalle = document.createElement("span");
      detalle.className = "elemento-detalle";
      detalle.textContent = ` · ${datos.cantidad}`;
      texto.append(detalle);
    }

    etiqueta.append(casilla, texto);

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "boton-icono";
    eliminar.setAttribute("aria-label", `Quitar ${datos.nombre} de la lista`);
    eliminar.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
      'aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    eliminar.addEventListener("click", () => this.eliminar(datos, eliminar));

    elemento.append(etiqueta, eliminar);
    return elemento;
  }

  async agregar() {
    this.error.textContent = "";
    const nombre = this.nombre.value.trim();

    if (!nombre) {
      this.error.textContent = "Escribe el producto que quieres comprar.";
      this.nombre.focus();
      return;
    }

    this.botonAgregar.disabled = true;

    try {
      await this.rest.agregarElementoLista({
        nombre,
        cantidad: this.cantidad.value.trim()
      });

      this.formulario.reset();
      this.nombre.focus();
      await this.cargar();
    } catch (error) {
      this.tratarError(error, this.error);
    } finally {
      this.botonAgregar.disabled = false;
    }
  }

  async marcar(datos, casilla) {
    casilla.disabled = true;

    try {
      await this.rest.marcarElementoLista(datos.id, casilla.checked);
      await this.cargar();
    } catch (error) {
      casilla.checked = !casilla.checked;
      casilla.disabled = false;
      this.tratarError(error, this.error);
    }
  }

  async eliminar(datos, boton) {
    boton.disabled = true;

    try {
      await this.rest.eliminarElementoLista(datos.id);
      await this.cargar();
    } catch (error) {
      boton.disabled = false;
      this.tratarError(error, this.error);
    }
  }

  async vaciarComprados() {
    this.botonVaciar.disabled = true;

    try {
      const { eliminados } = await this.rest.vaciarComprados();
      this.mostrarMensaje(
        `${eliminados} producto${eliminados === 1 ? "" : "s"} quitado${eliminados === 1 ? "" : "s"} de la lista`
      );
      await this.cargar();
    } catch (error) {
      this.tratarError(error, this.error);
    } finally {
      this.botonVaciar.disabled = false;
    }
  }

  tratarError(error, destino = this.error) {
    if (error.estadoHTTP === 401) {
      this.sesionCaducada();
      return;
    }

    destino.textContent = error.message;
  }
}

// Componente de la interfaz que gestiona los alimentos del usuario.
// Recibe el cliente REST y dos funciones de ControlWeb para mostrar
// mensajes generales y reaccionar si la sesión ha caducado.
class Despensa {
  constructor(rest, { mostrarMensaje, sesionCaducada, alCambiar = () => {} }) {
    this.rest = rest;
    this.mostrarMensaje = mostrarMensaje;
    this.sesionCaducada = sesionCaducada;
    // Avisa a otros componentes (lista de la compra) de que hay cambios.
    this.alCambiar = alCambiar;

    this.alimentos = [];
    this.editandoId = null;
    this.version = 0;

    this.seccion = document.querySelector("#despensa");
    this.resumen = document.querySelector("#resumen-despensa");
    this.estado = document.querySelector("#estado-despensa");
    this.tabla = document.querySelector("#tabla-alimentos");
    this.filas = document.querySelector("#filas-alimentos");

    this.formulario = document.querySelector("#form-alimento");
    this.tituloFormulario = document.querySelector("#titulo-form-alimento");
    this.errorFormulario = document.querySelector("#error-alimento");
    this.botonGuardar = document.querySelector("#btn-guardar-alimento");
    this.botonCancelar = document.querySelector("#btn-cancelar-edicion");

    this.campos = {
      nombre: document.querySelector("#alimento-nombre"),
      cantidad: document.querySelector("#alimento-cantidad"),
      unidad: document.querySelector("#alimento-unidad"),
      categoria: document.querySelector("#alimento-categoria"),
      fechaCaducidad: document.querySelector("#alimento-caducidad"),
      stockMinimo: document.querySelector("#alimento-minimo")
    };

    this.filtroTexto = document.querySelector("#filtro-texto");
    this.filtroEstado = document.querySelector("#filtro-estado");

    this.formulario.addEventListener("submit", evento => {
      evento.preventDefault();
      this.guardar();
    });

    this.botonCancelar.addEventListener("click", () => this.reiniciarFormulario());

    // Al corregir un campo desaparece el error anterior.
    this.formulario.addEventListener("input", () => {
      this.errorFormulario.textContent = "";
    });
    this.filtroTexto.addEventListener("input", () => this.pintar());
    this.filtroEstado.addEventListener("change", () => this.pintar());
  }

  async mostrar() {
    this.seccion.hidden = false;
    await this.cargar();
  }

  // Oculta la sección y borra los datos del usuario anterior.
  limpiar() {
    this.version++;
    this.alimentos = [];
    this.seccion.hidden = true;
    this.filas.replaceChildren();
    this.tabla.hidden = true;
    this.resumen.replaceChildren();
    this.estado.textContent = "";
    this.filtroTexto.value = "";
    this.filtroEstado.value = "todos";
    this.reiniciarFormulario();
  }

  async cargar() {
    const version = this.version;
    this.estado.className = "";
    this.estado.textContent = "Cargando alimentos…";

    try {
      const { alimentos, resumen } = await this.rest.listarAlimentos();

      if (version !== this.version) return;

      this.alimentos = alimentos;
      this.pintarResumen(resumen);
      this.pintar();
      this.alCambiar();
    } catch (error) {
      if (version !== this.version) return;
      this.tratarError(error, this.estado);
    }
  }

  crearTarjetaResumen(numero, etiqueta, color) {
    const tarjeta = document.createElement("div");
    tarjeta.className = `resumen-tarjeta resumen-${color}`;

    const cifra = document.createElement("span");
    cifra.className = "resumen-numero";
    cifra.textContent = numero;

    const texto = document.createElement("span");
    texto.className = "resumen-etiqueta";
    texto.textContent = etiqueta;

    tarjeta.append(cifra, texto);
    return tarjeta;
  }

  pintarResumen({ total, caducados, proximos }) {
    if (total === 0) {
      this.resumen.replaceChildren();
      return;
    }

    const enBuenEstado = total - caducados - proximos;

    this.resumen.replaceChildren(
      this.crearTarjetaResumen(
        caducados,
        caducados === 1 ? "caducado" : "caducados",
        "rojo"
      ),
      this.crearTarjetaResumen(proximos, "caducan pronto", "ambar"),
      this.crearTarjetaResumen(enBuenEstado, "sin prisa", "verde"),
      this.crearTarjetaResumen(
        total,
        total === 1 ? "alimento en total" : "alimentos en total",
        "neutro"
      )
    );
  }

  filtrados() {
    const texto = this.filtroTexto.value.trim().toLocaleLowerCase("es");
    const estado = this.filtroEstado.value;

    return this.alimentos.filter(alimento => {
      if (texto && !alimento.nombre.toLocaleLowerCase("es").includes(texto)) {
        return false;
      }

      if (estado === "caducado") {
        return alimento.estadoCaducidad === "caducado";
      }

      if (estado === "atencion") {
        return ["caducado", "proximo"].includes(alimento.estadoCaducidad);
      }

      return true;
    });
  }

  pintar() {
    const visibles = this.filtrados();
    const fragmento = document.createDocumentFragment();

    for (const alimento of visibles) {
      fragmento.append(this.crearFila(alimento));
    }

    this.filas.replaceChildren(fragmento);
    this.tabla.hidden = visibles.length === 0;
    this.estado.className = "";

    if (this.alimentos.length === 0) {
      this.estado.textContent = "Añade tu primer alimento con el formulario.";
    } else if (visibles.length === 0) {
      this.estado.textContent = "Ningún alimento coincide con el filtro.";
    } else {
      this.estado.textContent = "";
    }
  }

  crearCelda(texto, etiqueta) {
    const celda = document.createElement("td");
    celda.textContent = texto;
    // La etiqueta se muestra en pantallas estrechas, donde cada fila
    // se presenta como una tarjeta.
    if (etiqueta) celda.dataset.etiqueta = etiqueta;
    return celda;
  }

  // Texto breve para la pastilla de estado.
  estadoCorto(alimento) {
    const { estadoCaducidad, diasRestantes } = alimento;

    if (estadoCaducidad === "sin_fecha") return "Sin fecha";

    if (estadoCaducidad === "caducado") {
      const dias = Math.abs(diasRestantes);
      if (dias === 1) return "Caducó ayer";
      return `Caducó hace ${dias} días`;
    }

    if (diasRestantes === 0) return "Caduca hoy";
    if (diasRestantes === 1) return "Mañana";

    return `En ${diasRestantes} días`;
  }

  crearCeldaCaducidad(alimento) {
    const celda = document.createElement("td");
    celda.className = "celda-caducidad";
    celda.dataset.etiqueta = "Caducidad";

    const pastilla = document.createElement("span");
    pastilla.className = "pastilla";
    pastilla.textContent = this.estadoCorto(alimento);
    celda.append(pastilla);

    if (alimento.fechaCaducidad) {
      const fecha = document.createElement("span");
      fecha.className = "fecha-caducidad";
      fecha.textContent = new Date(`${alimento.fechaCaducidad}T00:00:00`)
        .toLocaleDateString("es-ES");
      celda.append(fecha);
    }

    return celda;
  }

  crearFila(alimento) {
    const fila = document.createElement("tr");
    fila.className = `caducidad-${alimento.estadoCaducidad}`;

    const caducidad = this.crearCeldaCaducidad(alimento);

    const celdaAcciones = document.createElement("td");
    const acciones = document.createElement("div");
    acciones.className = "acciones-fila";
    celdaAcciones.append(acciones);

    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "secundario";
    editar.textContent = "Editar";
    editar.setAttribute("aria-label", `Editar ${alimento.nombre}`);
    editar.addEventListener("click", () => this.editar(alimento));

    const eliminar = document.createElement("button");
    eliminar.type = "button";
    eliminar.className = "peligro";
    eliminar.textContent = "Eliminar";
    eliminar.setAttribute("aria-label", `Eliminar ${alimento.nombre}`);
    eliminar.addEventListener("click", () => this.eliminar(alimento, eliminar));

    acciones.append(editar, eliminar);

    const nombre = document.createElement("td");
    nombre.className = "celda-nombre";

    const punto = document.createElement("span");
    punto.className = "punto";
    punto.setAttribute("aria-hidden", "true");

    nombre.append(punto, alimento.nombre);

    const cantidad = this.crearCelda(
      `${alimento.cantidad} ${alimento.unidad}`,
      "Cantidad"
    );

    if (alimento.bajoMinimo) {
      const reponer = document.createElement("span");
      reponer.className = "pastilla pastilla-reponer";
      reponer.textContent = "Reponer";
      cantidad.append(" ", reponer);
    }

    fila.append(
      nombre,
      cantidad,
      this.crearCelda(alimento.categoria, "Categoría"),
      caducidad,
      celdaAcciones
    );

    return fila;
  }

  // Validación en el cliente para dar respuesta inmediata.
  // El servidor vuelve a validar siempre los datos.
  leerFormulario() {
    const nombre = this.campos.nombre.value.trim();
    const cantidadTexto = this.campos.cantidad.value.trim();
    const cantidad = Number(cantidadTexto);
    const unidad = this.campos.unidad.value;

    if (!nombre) {
      return { error: "Escribe el nombre del alimento.", campo: this.campos.nombre };
    }

    if (
      cantidadTexto === "" ||
      !Number.isFinite(cantidad) ||
      cantidad < 0 ||
      cantidad > 100000
    ) {
      return {
        error: "La cantidad debe ser un número entre 0 y 100000.",
        campo: this.campos.cantidad
      };
    }

    if (unidad === "unidades" && !Number.isInteger(cantidad)) {
      return {
        error: "Si cuentas por unidades, la cantidad debe ser un número entero.",
        campo: this.campos.cantidad
      };
    }

    const minimoTexto = this.campos.stockMinimo.value.trim();
    const stockMinimo = minimoTexto === "" ? null : Number(minimoTexto);

    if (
      stockMinimo !== null &&
      (!Number.isFinite(stockMinimo) || stockMinimo < 0 || stockMinimo > 100000)
    ) {
      return {
        error: "El mínimo debe ser un número entre 0 y 100000.",
        campo: this.campos.stockMinimo
      };
    }

    if (
      stockMinimo !== null &&
      unidad === "unidades" &&
      !Number.isInteger(stockMinimo)
    ) {
      return {
        error: "Si cuentas por unidades, el mínimo debe ser un número entero.",
        campo: this.campos.stockMinimo
      };
    }

    if (!this.campos.fechaCaducidad.checkValidity()) {
      return {
        error: "La fecha de caducidad no es válida.",
        campo: this.campos.fechaCaducidad
      };
    }

    return {
      datos: {
        nombre,
        cantidad,
        unidad,
        categoria: this.campos.categoria.value,
        fechaCaducidad: this.campos.fechaCaducidad.value || null,
        stockMinimo
      }
    };
  }

  async guardar() {
    this.errorFormulario.textContent = "";
    const { datos, error, campo } = this.leerFormulario();

    if (error) {
      this.errorFormulario.textContent = error;
      campo.focus();
      return;
    }

    this.botonGuardar.disabled = true;

    try {
      if (this.editandoId) {
        await this.rest.actualizarAlimento(this.editandoId, datos);
        this.mostrarMensaje(`«${datos.nombre}» actualizado`);
      } else {
        await this.rest.crearAlimento(datos);
        this.mostrarMensaje(`«${datos.nombre}» añadido a tu despensa`);
      }

      this.reiniciarFormulario();
      await this.cargar();
    } catch (error) {
      this.tratarError(error, this.errorFormulario);
    } finally {
      this.botonGuardar.disabled = false;
    }
  }

  editar(alimento) {
    this.editandoId = alimento.id;
    this.campos.nombre.value = alimento.nombre;
    this.campos.cantidad.value = alimento.cantidad;
    this.campos.unidad.value = alimento.unidad;
    this.campos.categoria.value = alimento.categoria;
    this.campos.fechaCaducidad.value = alimento.fechaCaducidad || "";
    this.campos.stockMinimo.value =
      alimento.stockMinimo === null ? "" : alimento.stockMinimo;

    this.tituloFormulario.textContent = `Editar «${alimento.nombre}»`;
    this.botonGuardar.textContent = "Guardar cambios";
    this.botonCancelar.hidden = false;
    this.errorFormulario.textContent = "";
    this.campos.nombre.focus();
  }

  reiniciarFormulario() {
    this.editandoId = null;
    this.formulario.reset();
    this.tituloFormulario.textContent = "Añadir alimento";
    this.botonGuardar.textContent = "Añadir";
    this.botonCancelar.hidden = true;
    this.errorFormulario.textContent = "";
  }

  async eliminar(alimento, boton) {
    if (!window.confirm(`¿Eliminar «${alimento.nombre}» de tu despensa?`)) {
      return;
    }

    boton.disabled = true;

    try {
      await this.rest.eliminarAlimento(alimento.id);

      if (this.editandoId === alimento.id) {
        this.reiniciarFormulario();
      }

      this.mostrarMensaje(`«${alimento.nombre}» eliminado`);
      await this.cargar();
    } catch (error) {
      boton.disabled = false;
      this.tratarError(error, this.estado);
    }
  }

  tratarError(error, destino) {
    if (error.estadoHTTP === 401) {
      this.sesionCaducada();
      return;
    }

    destino.textContent = error.message;
    destino.className = "error";
  }
}

// Sugerencias de recetas con lo que hay en la despensa.
class Recetas {
  constructor(rest, { mostrarMensaje, sesionCaducada, alCambiarLista }) {
    this.rest = rest;
    this.mostrarMensaje = mostrarMensaje;
    this.sesionCaducada = sesionCaducada;
    this.alCambiarLista = alCambiarLista;
    this.version = 0;

    this.resumen = document.querySelector("#resumen-recetas");
    this.estado = document.querySelector("#estado-recetas");
    this.lista = document.querySelector("#lista-recetas");
  }

  async cargar() {
    const version = this.version;

    try {
      const { recetas, caducanPronto } = await this.rest.obtenerRecetas();
      if (version !== this.version) return;
      this.pintar(recetas, caducanPronto);
    } catch (error) {
      if (version !== this.version) return;

      if (error.estadoHTTP === 401) {
        this.sesionCaducada();
        return;
      }

      this.estado.className = "error";
      this.estado.textContent = error.message;
    }
  }

  limpiar() {
    this.version++;
    this.lista.replaceChildren();
    this.resumen.textContent = "";
    this.estado.textContent = "";
  }

  pintar(recetas, caducanPronto) {
    this.estado.className = "";

    this.resumen.textContent = caducanPronto > 0
      ? `Primero las que aprovechan ${caducanPronto === 1 ? "el alimento que caduca" : `los ${caducanPronto} alimentos que caducan`} pronto.`
      : "Según lo que tienes en casa.";

    this.estado.textContent = recetas.length === 0
      ? "Añade más alimentos para recibir ideas de recetas."
      : "";

    // Se conserva qué recetas tenían los pasos abiertos.
    const abiertas = new Set(
      [...this.lista.querySelectorAll("details[open]")].map(d => d.dataset.receta)
    );

    this.lista.replaceChildren(...recetas.map(r => this.crearTarjeta(r, abiertas.has(r.id))));
  }

  textoDias(dias) {
    if (dias <= 0) return "hoy";
    if (dias === 1) return "mañana";
    return `en ${dias} días`;
  }

  crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  crearTarjeta(receta, abierta) {
    const tarjeta = this.crear("article", "tarjeta-receta");
    tarjeta.setAttribute("aria-labelledby", `receta-${receta.id}`);

    const titulo = this.crear("h3", null, receta.nombre);
    titulo.id = `receta-${receta.id}`;

    const meta = this.crear(
      "p",
      "meta-receta",
      `${receta.minutos} min · ${receta.raciones} ${receta.raciones === 1 ? "ración" : "raciones"}`
    );

    tarjeta.append(titulo, meta);

    if (receta.aprovecha.length > 0) {
      const aprovecha = this.crear("p", "aprovecha");
      aprovecha.append(this.crear("span", "pastilla pastilla-aprovecha", "Aprovecha"));
      aprovecha.append(
        " " + receta.aprovecha
          .map(a => `${a.nombre} (caduca ${this.textoDias(a.diasRestantes)})`)
          .join(", ")
      );
      tarjeta.append(aprovecha);
    }

    const ingredientes = this.crear("ul", "ingredientes-receta");
    ingredientes.setAttribute("aria-label", "Ingredientes");

    for (const ingrediente of receta.ingredientes) {
      const elemento = this.crear("li", `ingrediente-${ingrediente.estado}`);
      const estado = {
        tienes: "Lo tienes",
        caduca_pronto: "Lo tienes y caduca pronto",
        falta: ingrediente.opcional ? "No lo tienes (opcional)" : "Te falta"
      }[ingrediente.estado];

      elemento.append(
        this.crear("span", "icono-ingrediente", ingrediente.estado === "falta" ? "+" : "✓"),
        this.crear("span", "solo-lector", `${estado}: `),
        ingrediente.nombre
      );

      if (ingrediente.opcional) {
        elemento.append(this.crear("span", "opcional", " (opcional)"));
      }

      elemento.querySelector(".icono-ingrediente").setAttribute("aria-hidden", "true");
      ingredientes.append(elemento);
    }

    const detalles = this.crear("details", "pasos-receta");
    detalles.dataset.receta = receta.id;
    detalles.open = abierta;

    const pasos = this.crear("ol");
    pasos.append(...receta.pasos.map(paso => this.crear("li", null, paso)));

    detalles.append(
      this.crear("summary", null, "Cómo se hace"),
      pasos,
      this.crear("p", "ayuda", `Además: ${receta.basicos.join(", ")}.`)
    );

    tarjeta.append(ingredientes, detalles);

    if (receta.faltan.length > 0) {
      const boton = this.crear(
        "button",
        "secundario boton-pequeno",
        `Añadir lo que falta a la lista (${receta.faltan.length})`
      );
      boton.type = "button";
      boton.addEventListener("click", () => this.agregarFaltantes(receta, boton));
      tarjeta.append(boton);
    }

    return tarjeta;
  }

  async agregarFaltantes(receta, boton) {
    boton.disabled = true;

    try {
      const { agregados, yaEstaban } = await this.rest.agregarFaltantesReceta(receta.id);

      if (agregados.length > 0) {
        this.mostrarMensaje(`Añadido a la lista: ${agregados.join(", ")}`);
      } else if (yaEstaban.length > 0) {
        this.mostrarMensaje("Lo que falta ya estaba en tu lista de la compra");
      }

      boton.textContent = "En tu lista de la compra ✓";
      await this.alCambiarLista();
      return;
    } catch (error) {
      if (error.estadoHTTP === 401) {
        this.sesionCaducada();
        return;
      }

      this.mostrarMensaje(error.message, true);
    }

    boton.disabled = false;
  }
}

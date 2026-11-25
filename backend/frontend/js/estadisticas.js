// Estadísticas de aprovechamiento: cifras, gráfico mensual (terminados
// frente a tirados), lo que más se tira y descargas en CSV.
class Estadisticas {
  constructor(rest, { sesionCaducada }) {
    this.rest = rest;
    this.sesionCaducada = sesionCaducada;
    this.version = 0;

    this.cifras = document.querySelector("#cifras-estadisticas");
    this.estado = document.querySelector("#estado-estadisticas");
    this.contenido = document.querySelector("#contenido-estadisticas");
    this.grafico = document.querySelector("#grafico-meses");
    this.tooltip = document.querySelector("#tooltip-grafico");
    this.tabla = document.querySelector("#tabla-estadisticas tbody");
    this.ranking = document.querySelector("#mas-tirados");
    this.bloqueRanking = document.querySelector("#bloque-mas-tirados");
  }

  async cargar() {
    const version = this.version;

    try {
      const datos = await this.rest.obtenerEstadisticas(6);
      if (version !== this.version) return;
      this.pintar(datos);
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
    this.cifras.replaceChildren();
    this.grafico.replaceChildren();
    this.tabla.replaceChildren();
    this.ranking.replaceChildren();
    this.estado.textContent = "";
    this.tooltip.hidden = true;
  }

  // "Noviembre de 2026" o "Nov" (solo la primera letra en mayúscula).
  nombreMes(clave, largo = false) {
    const [anio, mes] = clave.split("-").map(Number);
    const texto = new Date(anio, mes - 1, 1).toLocaleDateString("es-ES", largo
      ? { month: "long", year: "numeric" }
      : { month: "short" }
    ).replace(".", "");

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  crear(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  crearCifra(valor, etiqueta, detalle) {
    const tarjeta = this.crear("div", "cifra");
    tarjeta.append(
      this.crear("span", "cifra-valor", valor),
      this.crear("span", "cifra-etiqueta", etiqueta)
    );
    if (detalle) tarjeta.append(this.crear("span", "cifra-detalle", detalle));
    return tarjeta;
  }

  pintar({ mensual, totales, masTirados }) {
    this.estado.className = "";
    const hayDatos = totales.terminados + totales.tirados + totales.consumos > 0;

    this.contenido.hidden = !hayDatos;
    this.estado.textContent = hayDatos
      ? ""
      : "Todavía no hay datos. Cuando gastes, termines o tires un alimento, lo verás aquí.";

    this.cifras.replaceChildren(
      this.crearCifra(
        totales.aprovechamiento === null ? "—" : `${totales.aprovechamiento} %`,
        "aprovechado",
        "de lo que ha salido de tu despensa"
      ),
      this.crearCifra(String(totales.terminados), totales.terminados === 1 ? "terminado" : "terminados"),
      this.crearCifra(
        String(totales.tirados),
        totales.tirados === 1 ? "tirado" : "tirados",
        totales.tirados > 0 ? `${totales.tiradosCaducados} ya ${totales.tiradosCaducados === 1 ? "estaba caducado" : "estaban caducados"}` : null
      ),
      this.crearCifra(String(totales.consumos), totales.consumos === 1 ? "vez que gastaste algo" : "veces que gastaste algo")
    );

    if (!hayDatos) return;

    this.pintarGrafico(mensual);
    this.pintarTabla(mensual);

    this.bloqueRanking.hidden = masTirados.length === 0;
    this.ranking.replaceChildren(...masTirados.map(({ nombre, veces }) => {
      const elemento = this.crear("li");
      elemento.append(
        this.crear("span", null, nombre),
        this.crear("span", "veces", `${veces} ${veces === 1 ? "vez" : "veces"}`)
      );
      return elemento;
    }));
  }

  // Barras agrupadas por mes. Cada mes es un objetivo de puntero y de
  // teclado que muestra sus dos valores en el tooltip.
  pintarGrafico(mensual) {
    const maximo = Math.max(1, ...mensual.flatMap(m => [m.terminados, m.tirados]));
    this.grafico.style.setProperty("--maximo", maximo);
    document.querySelector("#eje-maximo").textContent = maximo;

    this.grafico.replaceChildren(...mensual.map(mes => {
      const columna = this.crear("div", "columna-mes");
      columna.tabIndex = 0;
      columna.setAttribute(
        "aria-label",
        `${this.nombreMes(mes.mes, true)}: ${mes.terminados} terminados, ${mes.tirados} tirados`
      );

      const barras = this.crear("div", "barras-mes");
      barras.setAttribute("aria-hidden", "true");

      for (const [serie, valor] of [["terminados", mes.terminados], ["tirados", mes.tirados]]) {
        const barra = this.crear("div", `barra barra-${serie}`);
        barra.style.height = `${(valor / maximo) * 100}%`;
        if (valor === 0) barra.classList.add("barra-cero");
        barras.append(barra);
      }

      const etiqueta = this.crear("span", "etiqueta-mes", this.nombreMes(mes.mes));
      etiqueta.setAttribute("aria-hidden", "true");

      columna.append(barras, etiqueta);

      const mostrar = () => this.mostrarTooltip(columna, mes);
      columna.addEventListener("pointerenter", mostrar);
      columna.addEventListener("focus", mostrar);
      columna.addEventListener("pointerleave", () => this.ocultarTooltip());
      columna.addEventListener("blur", () => this.ocultarTooltip());

      return columna;
    }));
  }

  mostrarTooltip(columna, mes) {
    const fila = (serie, valor, texto) => {
      const elemento = this.crear("div", "fila-tooltip");
      elemento.append(
        this.crear("span", `clave-tooltip clave-${serie}`),
        this.crear("strong", null, String(valor)),
        this.crear("span", null, texto)
      );
      return elemento;
    };

    this.tooltip.replaceChildren(
      this.crear("div", "titulo-tooltip", this.nombreMes(mes.mes, true)),
      fila("terminados", mes.terminados, "terminados"),
      fila("tirados", mes.tirados, "tirados")
    );

    const caja = columna.getBoundingClientRect();
    const contenedor = this.grafico.getBoundingClientRect();

    // Al lado de la columna para no tapar sus barras: a la derecha si
    // cabe y, si no, a la izquierda.
    this.tooltip.hidden = false;
    const ancho = this.tooltip.offsetWidth;
    const derecha = caja.right - contenedor.left + 8;
    const izquierda = derecha + ancho <= contenedor.width
      ? derecha
      : Math.max(0, caja.left - contenedor.left - ancho - 8);

    this.tooltip.style.left = `${izquierda}px`;
    columna.classList.add("columna-activa");
    this.columnaActiva = columna;
  }

  ocultarTooltip() {
    this.tooltip.hidden = true;
    this.columnaActiva?.classList.remove("columna-activa");
  }

  pintarTabla(mensual) {
    this.tabla.replaceChildren(...mensual.map(mes => {
      const fila = this.crear("tr");
      const cabecera = this.crear("th", null, this.nombreMes(mes.mes, true));
      cabecera.scope = "row";
      fila.append(
        cabecera,
        this.crear("td", null, String(mes.terminados)),
        this.crear("td", null, String(mes.tirados)),
        this.crear("td", null, String(mes.consumos))
      );
      return fila;
    }));
  }
}

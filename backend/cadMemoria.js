class CadMemoria {
  constructor() {
    this.usuarios = new Map();
    this.alimentos = new Map();
    this.listaCompra = new Map();
    this.movimientos = [];
  }

  async guardarMovimiento(movimiento) {
    this.movimientos.push({ ...movimiento });
  }

  async listarMovimientos(usuarioId) {
    return this.movimientos
      .filter(movimiento => movimiento.usuarioId === usuarioId)
      .map(movimiento => ({ ...movimiento }));
  }

  // Lista de la compra: misma clave que los alimentos.
  async listarElementosLista(usuarioId) {
    return [...this.listaCompra.values()]
      .filter(elemento => elemento.usuarioId === usuarioId)
      .map(elemento => ({ ...elemento }));
  }

  async contarElementosLista(usuarioId) {
    return (await this.listarElementosLista(usuarioId)).length;
  }

  async buscarElementoLista(usuarioId, id) {
    const elemento = this.listaCompra.get(this.claveAlimento(usuarioId, id));
    return elemento ? { ...elemento } : null;
  }

  async guardarElementoLista(elemento) {
    this.listaCompra.set(
      this.claveAlimento(elemento.usuarioId, elemento.id),
      { ...elemento }
    );

    return { ...elemento };
  }

  async eliminarElementoLista(usuarioId, id) {
    return this.listaCompra.delete(this.claveAlimento(usuarioId, id));
  }

  // Pasa todos los alimentos y la lista de una despensa a otra.
  async moverDespensa(origen, destino) {
    let alimentos = 0;

    for (const coleccion of [this.alimentos, this.listaCompra]) {
      for (const [clave, elemento] of [...coleccion]) {
        if (elemento.usuarioId !== origen) continue;

        coleccion.delete(clave);
        const movido = { ...elemento, usuarioId: destino };
        coleccion.set(this.claveAlimento(destino, movido.id), movido);

        if (coleccion === this.alimentos) alimentos++;
      }
    }

    for (const movimiento of this.movimientos) {
      if (movimiento.usuarioId === origen) movimiento.usuarioId = destino;
    }

    return alimentos;
  }

  async eliminarElementosComprados(usuarioId) {
    let eliminados = 0;

    for (const [clave, elemento] of this.listaCompra) {
      if (elemento.usuarioId === usuarioId && elemento.comprado) {
        this.listaCompra.delete(clave);
        eliminados++;
      }
    }

    return eliminados;
  }

  // Alimentos: la clave combina propietario e identificador.
  claveAlimento(usuarioId, id) {
    return `${usuarioId}:${id}`;
  }

  async listarAlimentos(usuarioId) {
    return [...this.alimentos.values()]
      .filter(alimento => alimento.usuarioId === usuarioId)
      .map(alimento => ({ ...alimento }));
  }

  async contarAlimentos(usuarioId) {
    return (await this.listarAlimentos(usuarioId)).length;
  }

  async buscarAlimento(usuarioId, id) {
    const alimento = this.alimentos.get(this.claveAlimento(usuarioId, id));
    return alimento ? { ...alimento } : null;
  }

  async guardarAlimento(alimento) {
    this.alimentos.set(
      this.claveAlimento(alimento.usuarioId, alimento.id),
      { ...alimento }
    );

    return { ...alimento };
  }

  async eliminarAlimento(usuarioId, id) {
    return this.alimentos.delete(this.claveAlimento(usuarioId, id));
  }

  async buscarPorEmail(email) {
    const usuario = this.usuarios.get(email);
    return usuario ? { ...usuario } : null;
  }
    async buscarPorGoogleSub(googleSub) {
    for (const usuario of this.usuarios.values()) {
      if (usuario.googleSub === googleSub) {
        return { ...usuario };
      }
    }

    return null;
  }

  async guardar(usuario) {
    this.usuarios.set(usuario.email, { ...usuario });
    return { ...usuario };
  }

  async listar() {
    return [...this.usuarios.values()].map(usuario => ({ ...usuario }));
  }
    async confirmarCuenta(tokenHash, ahora) {
    for (const [email, usuario] of this.usuarios) {
      if (
        usuario.estado === "pendiente" &&
        usuario.confirmacionTokenHash === tokenHash &&
        usuario.confirmacionCaducaEn instanceof Date &&
        usuario.confirmacionCaducaEn.getTime() > ahora.getTime()
      ) {
        const actualizado = {
          ...usuario,
          estado: "activo"
        };

        delete actualizado.confirmacionTokenHash;
        delete actualizado.confirmacionCaducaEn;

        this.usuarios.set(email, actualizado);

        return { ...actualizado };
      }
    }

    return null;
  }
    async renovarConfirmacion(
    email,
    tokenHash,
    caducaEn,
    ahora
  ) {
    const usuario = this.usuarios.get(email);

    if (!usuario || usuario.estado !== "pendiente") {
      return false;
    }

    const ultimoIntento = usuario.confirmacionEnviadaEn;

    if (
      ultimoIntento instanceof Date &&
      ahora.getTime() - ultimoIntento.getTime() < 60000
    ) {
      return false;
    }

    this.usuarios.set(email, {
      ...usuario,
      confirmacionTokenHash: tokenHash,
      confirmacionCaducaEn: caducaEn,
      confirmacionEnviadaEn: ahora
    });

    return true;
  }
}

module.exports = { CadMemoria };
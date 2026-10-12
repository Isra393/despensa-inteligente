class CadMemoria {
  constructor() {
    this.usuarios = new Map();
  }

  async buscarPorEmail(email) {
    const usuario = this.usuarios.get(email);
    return usuario ? { ...usuario } : null;
  }

  async guardar(usuario) {
    this.usuarios.set(usuario.email, { ...usuario });
    return { ...usuario };
  }

  async listar() {
    return [...this.usuarios.values()].map(usuario => ({ ...usuario }));
  }
}

module.exports = { CadMemoria };
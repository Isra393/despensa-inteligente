const { randomUUID } = require("node:crypto");

class ErrorNegocio extends Error {
  constructor(mensaje, estadoHTTP) {
    super(mensaje);
    this.estadoHTTP = estadoHTTP;
  }
}

class Sistema {
  constructor(cad) {
    this.cad = cad;
  }

  normalizarEmail(email) {
    if (typeof email !== "string") {
      throw new ErrorNegocio("El email es obligatorio", 400);
    }

    const normalizado = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
      throw new ErrorNegocio("El email no es válido", 400);
    }

    return normalizado;
  }

  async agregarUsuario(email) {
    const emailNormalizado = this.normalizarEmail(email);
    const existente = await this.cad.buscarPorEmail(emailNormalizado);

    if (existente) {
      throw new ErrorNegocio("El email ya está registrado", 409);
    }

    const usuario = {
      id: randomUUID(),
      email: emailNormalizado,
      rol: "usuario",
      estado: "pendiente"
    };

    return this.cad.guardar(usuario);
  }

  async listarUsuarios() {
    return this.cad.listar();
  }

  async usuarioActivo(email) {
    const normalizado = this.normalizarEmail(email);
    const usuario = await this.cad.buscarPorEmail(normalizado);

    return usuario !== null && usuario.estado === "activo";
  }

  async eliminarUsuario(email) {
    const normalizado = this.normalizarEmail(email);
    const usuario = await this.cad.buscarPorEmail(normalizado);

    if (!usuario || usuario.estado === "eliminado") {
      throw new ErrorNegocio("El usuario no existe", 404);
    }

    usuario.estado = "eliminado";
    await this.cad.guardar(usuario);

    return { mensaje: "Usuario eliminado" };
  }
}

module.exports = { Sistema, ErrorNegocio };
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");

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
    usuarioPublico(usuario) {
    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      estado: usuario.estado
    };
  }

  validarPassword(password) {
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new ErrorNegocio(
        "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes",
        400
      );
    }
  }

  async registrarUsuario(email, password) {
    const normalizado = this.normalizarEmail(email);
    this.validarPassword(password);

    const existente = await this.cad.buscarPorEmail(normalizado);

    if (existente) {
      throw new ErrorNegocio("El email ya está registrado", 409);
    }

    const usuario = {
      id: randomUUID(),
      email: normalizado,
      passwordHash: await bcrypt.hash(password, 12),
      rol: "usuario",
      estado: "pendiente"
    };

    await this.cad.guardar(usuario);

    return this.usuarioPublico(usuario);
  }

  async loginUsuario(email, password) {
    const normalizado = this.normalizarEmail(email);

    if (
      typeof password !== "string" ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new ErrorNegocio("Email o contraseña incorrectos", 401);
    }

    const usuario = await this.cad.buscarPorEmail(normalizado);

    if (
      !usuario ||
      usuario.estado === "eliminado" ||
      !usuario.passwordHash
    ) {
      throw new ErrorNegocio("Email o contraseña incorrectos", 401);
    }

    const correcta = await bcrypt.compare(
      password,
      usuario.passwordHash
    );

    if (!correcta) {
      throw new ErrorNegocio("Email o contraseña incorrectos", 401);
    }

    if (usuario.estado !== "activo") {
      throw new ErrorNegocio("Debes confirmar tu cuenta para iniciar sesión", 403);
    }

    return this.usuarioPublico(usuario);
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
    const usuarios = await this.cad.listar();

    return usuarios.map(usuario => this.usuarioPublico(usuario));
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
    async obtenerUsuarioSesion(email) {
    const normalizado = this.normalizarEmail(email);
    const usuario = await this.cad.buscarPorEmail(normalizado);

    if (!usuario || usuario.estado !== "activo") {
      throw new ErrorNegocio("La sesión no es válida", 401);
    }

    return this.usuarioPublico(usuario);
  }
}

module.exports = { Sistema, ErrorNegocio };
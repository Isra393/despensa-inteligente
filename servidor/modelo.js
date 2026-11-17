const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const {
  crearConfirmacion,
  resumirToken
} = require("./confirmacion");
const {
  MAX_ALIMENTOS_POR_USUARIO,
  fechaLocal,
  estadoCaducidad,
  validarDatosAlimento,
  compararAlimentos
} = require("./alimentos");

class ErrorNegocio extends Error {
  constructor(mensaje, estadoHTTP) {
    super(mensaje);
    this.estadoHTTP = estadoHTTP;
  }
}

const DIAS_AVISO_POR_DEFECTO = 3;

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
    async registrarUsuarioConConfirmacion(email, password) {
    const publico = await this.registrarUsuario(email, password);
    const usuario = await this.cad.buscarPorEmail(publico.email);

    const confirmacion = crearConfirmacion();

    usuario.confirmacionTokenHash = confirmacion.tokenHash;
    usuario.confirmacionCaducaEn = confirmacion.caducaEn;
    usuario.confirmacionEnviadaEn = new Date();

    await this.cad.guardar(usuario);

    // Resultado interno para el futuro envío del correo.
    // La API no debe devolver el token al navegador.
    return {
      usuario: publico,
      token: confirmacion.token
    };
  }

  async confirmarCuenta(token) {
    const tokenHash = resumirToken(token);

    if (!tokenHash) {
      throw new ErrorNegocio(
        "El enlace de confirmación no es válido o ha caducado",
        400
      );
    }

    const usuario = await this.cad.confirmarCuenta(
      tokenHash,
      new Date()
    );

    if (!usuario) {
      throw new ErrorNegocio(
        "El enlace de confirmación no es válido o ha caducado",
        400
      );
    }

    return this.usuarioPublico(usuario);
  }
    // Recibe una identidad previamente verificada por el servidor.
  async loginGoogle(identidad) {
    if (
      !identidad ||
      typeof identidad.sub !== "string" ||
      identidad.sub.trim() === "" ||
      identidad.email_verified !== true
    ) {
      throw new ErrorNegocio(
        "No se ha podido verificar la cuenta de Google",
        401
      );
    }

    const email = this.normalizarEmail(identidad.email);
    const googleSub = identidad.sub;

    const vinculado = await this.cad.buscarPorGoogleSub(
      googleSub
    );

    if (vinculado) {
      if (vinculado.estado !== "activo") {
        throw new ErrorNegocio(
          "Esta cuenta no tiene permitido iniciar sesión",
          403
        );
      }

      // Conserva el email y el rol almacenados en la aplicación.
      return this.usuarioPublico(vinculado);
    }

    const existente = await this.cad.buscarPorEmail(email);

    if (existente) {
      throw new ErrorNegocio(
        "Ya existe una cuenta con este correo. " +
        "Utiliza su método de acceso original.",
        409
      );
    }

    const usuario = {
      id: randomUUID(),
      email,
      googleSub,
      rol: "usuario",
      estado: "activo"
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
    async exigirAdministrador(emailSolicitante) {
    const usuario = await this.obtenerUsuarioSesion(
      emailSolicitante
    );

    if (usuario.rol !== "administrador") {
      throw new ErrorNegocio(
        "Se requieren permisos de administrador",
        403
      );
    }

    return usuario;
  }

  async listarUsuariosAutorizado(emailSolicitante) {
    await this.exigirAdministrador(emailSolicitante);
    return this.listarUsuarios();
  }

  async usuarioActivoAutorizado(
    emailSolicitante,
    emailConsultado
  ) {
    await this.exigirAdministrador(emailSolicitante);
    return this.usuarioActivo(emailConsultado);
  }

  async eliminarUsuarioAutorizado(
    emailSolicitante,
    emailObjetivo
  ) {
    const solicitante = await this.obtenerUsuarioSesion(
      emailSolicitante
    );

    const objetivo = this.normalizarEmail(emailObjetivo);

    if (
      solicitante.rol !== "administrador" &&
      solicitante.email !== objetivo
    ) {
      throw new ErrorNegocio(
        "Solo puedes eliminar tu propia cuenta",
        403
      );
    }

    return this.eliminarUsuario(objetivo);
  }
    async prepararReenvioConfirmacion(email) {
    const normalizado = this.normalizarEmail(email);
    const ahora = new Date();
    const confirmacion = crearConfirmacion(ahora.getTime());

    const renovada = await this.cad.renovarConfirmacion(
      normalizado,
      confirmacion.tokenHash,
      confirmacion.caducaEn,
      ahora
    );

    if (!renovada) {
      return null;
    }

    // Resultado interno para el componente de correo.
    return {
      email: normalizado,
      token: confirmacion.token
    };
  }

  // ---------------------------------------------------------------
  // Gestión de alimentos (Sprint 2)
  // Cada alimento pertenece a un usuario y solo él puede consultarlo
  // o modificarlo. El propietario se obtiene siempre de la sesión.
  // ---------------------------------------------------------------

  alimentoPublico(alimento, ahora = new Date()) {
    const { estado, diasRestantes } = estadoCaducidad(
      alimento.fechaCaducidad,
      ahora
    );

    return {
      id: alimento.id,
      nombre: alimento.nombre,
      cantidad: alimento.cantidad,
      unidad: alimento.unidad,
      categoria: alimento.categoria,
      fechaCaducidad: alimento.fechaCaducidad,
      estadoCaducidad: estado,
      diasRestantes,
      creadoEn: alimento.creadoEn,
      actualizadoEn: alimento.actualizadoEn
    };
  }

  validarAlimento(datos) {
    const resultado = validarDatosAlimento(datos);

    if (resultado.error) {
      throw new ErrorNegocio(resultado.error, 400);
    }

    return resultado.datos;
  }

  validarIdAlimento(id) {
    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(id)
    ) {
      throw new ErrorNegocio("El alimento no existe", 404);
    }

    return id.toLowerCase();
  }

  async listarAlimentos(emailSolicitante, ahora = new Date()) {
    const usuario = await this.obtenerUsuarioSesion(emailSolicitante);
    const alimentos = await this.cad.listarAlimentos(usuario.id);

    const publicos = alimentos
      .sort(compararAlimentos)
      .map(alimento => this.alimentoPublico(alimento, ahora));

    const resumen = {
      total: publicos.length,
      caducados: publicos.filter(a => a.estadoCaducidad === "caducado")
        .length,
      proximos: publicos.filter(a => a.estadoCaducidad === "proximo")
        .length
    };

    return { alimentos: publicos, resumen };
  }

  async crearAlimento(emailSolicitante, datos, ahora = new Date()) {
    const usuario = await this.obtenerUsuarioSesion(emailSolicitante);
    const limpio = this.validarAlimento(datos);

    const total = await this.cad.contarAlimentos(usuario.id);

    if (total >= MAX_ALIMENTOS_POR_USUARIO) {
      throw new ErrorNegocio(
        `No puedes guardar más de ${MAX_ALIMENTOS_POR_USUARIO} alimentos`,
        409
      );
    }

    const alimento = {
      id: randomUUID(),
      usuarioId: usuario.id,
      ...limpio,
      creadoEn: ahora,
      actualizadoEn: ahora
    };

    await this.cad.guardarAlimento(alimento);

    return this.alimentoPublico(alimento, ahora);
  }

  async actualizarAlimento(
    emailSolicitante,
    idAlimento,
    datos,
    ahora = new Date()
  ) {
    const usuario = await this.obtenerUsuarioSesion(emailSolicitante);
    const id = this.validarIdAlimento(idAlimento);
    const limpio = this.validarAlimento(datos);

    const existente = await this.cad.buscarAlimento(usuario.id, id);

    if (!existente) {
      throw new ErrorNegocio("El alimento no existe", 404);
    }

    const actualizado = {
      ...existente,
      ...limpio,
      id: existente.id,
      usuarioId: existente.usuarioId,
      creadoEn: existente.creadoEn,
      actualizadoEn: ahora
    };

    await this.cad.guardarAlimento(actualizado);

    return this.alimentoPublico(actualizado, ahora);
  }

  async eliminarAlimento(emailSolicitante, idAlimento) {
    const usuario = await this.obtenerUsuarioSesion(emailSolicitante);
    const id = this.validarIdAlimento(idAlimento);

    const eliminado = await this.cad.eliminarAlimento(usuario.id, id);

    if (!eliminado) {
      throw new ErrorNegocio("El alimento no existe", 404);
    }

    return { mensaje: "Alimento eliminado" };
  }

  // ---------------------------------------------------------------
  // Avisos de caducidad por correo (Sprint 3)
  // ---------------------------------------------------------------

  preferenciasAvisos(usuario) {
    const avisos = usuario.avisosCaducidad || {};

    return {
      activo: avisos.activo === true,
      diasAntelacion: Number.isInteger(avisos.diasAntelacion)
        ? avisos.diasAntelacion
        : DIAS_AVISO_POR_DEFECTO
    };
  }

  async obtenerUsuarioActivo(email) {
    const normalizado = this.normalizarEmail(email);
    const usuario = await this.cad.buscarPorEmail(normalizado);

    if (!usuario || usuario.estado !== "activo") {
      throw new ErrorNegocio("La sesión no es válida", 401);
    }

    return usuario;
  }

  async obtenerPreferenciasAvisos(emailSolicitante) {
    const usuario = await this.obtenerUsuarioActivo(emailSolicitante);
    return this.preferenciasAvisos(usuario);
  }

  async actualizarPreferenciasAvisos(emailSolicitante, datos) {
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) {
      throw new ErrorNegocio("Las preferencias no son válidas", 400);
    }

    const { activo, diasAntelacion } = datos;

    if (typeof activo !== "boolean") {
      throw new ErrorNegocio("Indica si quieres recibir avisos", 400);
    }

    if (
      !Number.isInteger(diasAntelacion) ||
      diasAntelacion < 1 ||
      diasAntelacion > 7
    ) {
      throw new ErrorNegocio(
        "La antelación debe estar entre 1 y 7 días",
        400
      );
    }

    const usuario = await this.obtenerUsuarioActivo(emailSolicitante);

    usuario.avisosCaducidad = { activo, diasAntelacion };
    await this.cad.guardar(usuario);

    return this.preferenciasAvisos(usuario);
  }

  // Devuelve los avisos pendientes de enviar hoy. Solo incluye usuarios
  // activos que los han pedido, que tienen algún alimento caducado o a
  // punto de caducar y que no han recibido ya el aviso de hoy.
  async prepararAvisosCaducidad(ahora = new Date()) {
    const hoy = fechaLocal(ahora);
    const usuarios = await this.cad.listar();
    const avisos = [];

    for (const usuario of usuarios) {
      const preferencias = this.preferenciasAvisos(usuario);

      if (
        usuario.estado !== "activo" ||
        !preferencias.activo ||
        usuario.avisoCaducidadEnviadoEl === hoy
      ) {
        continue;
      }

      const alimentos = (await this.cad.listarAlimentos(usuario.id))
        .sort(compararAlimentos)
        .map(alimento => this.alimentoPublico(alimento, ahora))
        .filter(alimento =>
          alimento.diasRestantes !== null &&
          alimento.diasRestantes <= preferencias.diasAntelacion
        );

      if (alimentos.length > 0) {
        avisos.push({ email: usuario.email, alimentos });
      }
    }

    return avisos;
  }

  async registrarAvisoEnviado(email, ahora = new Date()) {
    const usuario = await this.cad.buscarPorEmail(email);

    if (!usuario) return;

    usuario.avisoCaducidadEnviadoEl = fechaLocal(ahora);
    await this.cad.guardar(usuario);
  }
}
function calcularBloqueo(fallos, ahora) {
  function convertirFecha(valor) {
    if (typeof valor !== "string" || valor.trim() === "") {
      throw new ErrorNegocio("Fecha no válida", 400);
    }

    const instante = Date.parse(valor);

    if (!Number.isFinite(instante)) {
      throw new ErrorNegocio("Fecha no válida", 400);
    }

    return instante;
  }

  if (!Array.isArray(fallos) || typeof ahora !== "string") {
    throw new ErrorNegocio("Debes enviar fallos y ahora válidos", 400);
  }

  const instanteActual = convertirFecha(ahora);

  // Valida todas las fechas y ordena sin modificar el array original.
  const recientes = fallos
    .map(convertirFecha)
    .sort((a, b) => b - a)
    .slice(0, 5);

  const sinBloqueo = { bloqueado: false, hasta: null };

  if (recientes.length < 5) return sinBloqueo;

  const quinceMinutos = 15 * 60 * 1000;
  const ultimoFallo = recientes[0];
  const primeroDeLosCinco = recientes[4];

  if (ultimoFallo - primeroDeLosCinco > quinceMinutos) {
    return sinBloqueo;
  }

  const finBloqueo = ultimoFallo + quinceMinutos;

  if (instanteActual >= finBloqueo) return sinBloqueo;

  return {
    bloqueado: true,
    hasta: new Date(finBloqueo).toISOString()
  };
}

module.exports = { Sistema, ErrorNegocio, calcularBloqueo };
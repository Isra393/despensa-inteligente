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
  compararAlimentos,
  bajoMinimo,
  CANTIDAD_MAXIMA,
  PASOS_UNIDAD,
  redondear,
  validarAjuste,
  UBICACIONES,
  UBICACION_POR_DEFECTO
} = require("./alimentos");
const {
  MAX_ELEMENTOS_LISTA,
  validarElementoLista
} = require("./listaCompra");

class ErrorNegocio extends Error {
  constructor(mensaje, estadoHTTP) {
    super(mensaje);
    this.estadoHTTP = estadoHTTP;
  }
}

const { codigoValido } = require("./productos");
const {
  MOTIVOS_ELIMINACION,
  calcularEstadisticas,
  csvDespensa,
  csvHistorial
} = require("./estadisticas");
const { sugerirRecetas, evaluarReceta, buscarReceta, disponibles, palabras } = require("./recetas");
const { createHash, randomInt } = require("node:crypto");

const DIAS_AVISO_POR_DEFECTO = 3;

// Hogar compartido
const MAX_MIEMBROS_HOGAR = 6;
const DURACION_INVITACION = 48 * 60 * 60 * 1000;
const ALFABETO_INVITACION = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizarCodigoInvitacion(codigo) {
  return typeof codigo === "string"
    ? codigo.toUpperCase().replace(/[\s-]+/g, "")
    : "";
}

function hashInvitacion(codigo) {
  return createHash("sha256").update(codigo).digest("hex");
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
  // Despensa que usa un usuario: la de su hogar o, si no comparte, la suya.
  despensaIdDe(usuario) {
    return usuario.hogarId ?? usuario.id;
  }

  async usuarioConDespensa(email) {
    const normalizado = this.normalizarEmail(email);
    const usuario = await this.cad.buscarPorEmail(normalizado);

    if (!usuario || usuario.estado !== "activo") {
      throw new ErrorNegocio("La sesión no es válida", 401);
    }

    return {
      ...this.usuarioPublico(usuario),
      despensaId: this.despensaIdDe(usuario)
    };
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
      paso: PASOS_UNIDAD[alimento.unidad] ?? 1,
      categoria: alimento.categoria,
      ubicacion: alimento.ubicacion ?? UBICACION_POR_DEFECTO,
      fechaCaducidad: alimento.fechaCaducidad,
      stockMinimo: alimento.stockMinimo ?? null,
      codigoBarras: alimento.codigoBarras ?? null,
      bajoMinimo: bajoMinimo(alimento),
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
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const alimentos = await this.cad.listarAlimentos(usuario.despensaId);

    const publicos = alimentos
      .sort(compararAlimentos)
      .map(alimento => this.alimentoPublico(alimento, ahora));

    const resumen = {
      total: publicos.length,
      caducados: publicos.filter(a => a.estadoCaducidad === "caducado")
        .length,
      proximos: publicos.filter(a => a.estadoCaducidad === "proximo")
        .length,
      porUbicacion: Object.fromEntries(
        UBICACIONES.map(ubicacion => [
          ubicacion,
          publicos.filter(a => a.ubicacion === ubicacion).length
        ])
      )
    };

    return { alimentos: publicos, resumen };
  }

  async crearAlimento(emailSolicitante, datos, ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const limpio = this.validarAlimento(datos);

    const total = await this.cad.contarAlimentos(usuario.despensaId);

    if (total >= MAX_ALIMENTOS_POR_USUARIO) {
      throw new ErrorNegocio(
        `No puedes guardar más de ${MAX_ALIMENTOS_POR_USUARIO} alimentos`,
        409
      );
    }

    const alimento = {
      id: randomUUID(),
      usuarioId: usuario.despensaId,
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
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const id = this.validarIdAlimento(idAlimento);
    const limpio = this.validarAlimento(datos);

    const existente = await this.cad.buscarAlimento(usuario.despensaId, id);

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

  // Suma o resta cantidad sin pasar por el formulario de edición.
  // Nunca baja de 0 y devuelve también cuánto se ha restado de verdad.
  async ajustarCantidad(emailSolicitante, idAlimento, datos, ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const id = this.validarIdAlimento(idAlimento);
    const delta = datos?.delta;

    const existente = await this.cad.buscarAlimento(usuario.despensaId, id);

    if (!existente) {
      throw new ErrorNegocio("El alimento no existe", 404);
    }

    const error = validarAjuste(delta, existente.unidad);

    if (error) {
      throw new ErrorNegocio(error, 400);
    }

    if (delta < 0 && existente.cantidad <= 0) {
      throw new ErrorNegocio(`No queda ${existente.nombre}`, 409);
    }

    const cantidad = redondear(
      Math.min(CANTIDAD_MAXIMA, Math.max(0, existente.cantidad + delta))
    );

    const actualizado = { ...existente, cantidad, actualizadoEn: ahora };
    await this.cad.guardarAlimento(actualizado);

    const consumido = delta < 0 ? redondear(existente.cantidad - cantidad) : 0;

    if (consumido > 0) {
      await this.registrarMovimiento(usuario.despensaId, existente, "consumo", consumido, ahora);
    }

    return {
      alimento: this.alimentoPublico(actualizado, ahora),
      consumido
    };
  }

  // Busca un producto por código de barras en el catálogo externo e
  // indica si ya hay un alimento con ese código en la despensa.
  async buscarProducto(emailSolicitante, codigo, catalogo) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);

    if (!codigoValido(codigo)) {
      throw new ErrorNegocio("El código de barras no es válido", 400);
    }

    const existente = (await this.cad.listarAlimentos(usuario.despensaId))
      .find(alimento => alimento.codigoBarras === codigo);

    const enDespensa = existente
      ? {
          id: existente.id,
          nombre: existente.nombre,
          cantidad: existente.cantidad,
          unidad: existente.unidad,
          paso: PASOS_UNIDAD[existente.unidad] ?? 1
        }
      : null;

    if (!catalogo) {
      throw new ErrorNegocio("La búsqueda de productos no está disponible", 503);
    }

    let producto;

    try {
      producto = await catalogo.buscar(codigo);
    } catch (error) {
      // Si el catálogo falla pero el producto ya está en la despensa,
      // se puede seguir trabajando con él.
      if (enDespensa) {
        return { producto: null, enDespensa };
      }

      throw new ErrorNegocio(
        error.codigoError === "limite"
          ? "Hay muchas búsquedas de productos ahora mismo. Inténtalo en un minuto."
          : "No se ha podido consultar el producto. Inténtalo más tarde.",
        503
      );
    }

    if (!producto && !enDespensa) {
      throw new ErrorNegocio(
        "No hemos encontrado ese producto. Puedes añadirlo a mano.",
        404
      );
    }

    return { producto, enDespensa };
  }

  // ---------------------------------------------------------------
  // Recetas (Sprint 4)
  // ---------------------------------------------------------------

  async alimentosPublicos(usuario, ahora) {
    return (await this.cad.listarAlimentos(usuario.despensaId))
      .map(alimento => this.alimentoPublico(alimento, ahora));
  }

  async obtenerRecetas(emailSolicitante, ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const alimentos = await this.alimentosPublicos(usuario, ahora);

    return {
      recetas: sugerirRecetas(alimentos),
      caducanPronto: alimentos.filter(a =>
        a.estadoCaducidad === "proximo" && a.cantidad > 0
      ).length
    };
  }

  // Añade a la lista de la compra los ingredientes que faltan para una
  // receta, sin repetir los que ya están pendientes en la lista.
  async agregarFaltantesALista(emailSolicitante, idReceta, ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const receta = typeof idReceta === "string" ? buscarReceta(idReceta) : null;

    if (!receta) {
      throw new ErrorNegocio("La receta no existe", 404);
    }

    const alimentos = await this.alimentosPublicos(usuario, ahora);
    const { faltan } = evaluarReceta(receta, disponibles(alimentos));

    const clave = texto => palabras(texto).join(" ");
    const pendientes = new Set(
      (await this.cad.listarElementosLista(usuario.despensaId))
        .filter(elemento => !elemento.comprado)
        .map(elemento => clave(elemento.nombre))
    );

    const agregados = [];
    const yaEstaban = [];

    for (const nombre of faltan) {
      if (pendientes.has(clave(nombre))) {
        yaEstaban.push(nombre);
        continue;
      }

      await this.agregarElementoLista(
        emailSolicitante,
        { nombre, cantidad: `Para: ${receta.nombre}`.slice(0, 40) },
        ahora
      );

      agregados.push(nombre);
    }

    return { agregados, yaEstaban };
  }

  // El motivo alimenta las estadísticas: «terminado», «tirado» o
  // «error» (se añadió por equivocación y no cuenta).
  async eliminarAlimento(emailSolicitante, idAlimento, motivo = "error", ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const id = this.validarIdAlimento(idAlimento);
    const motivoFinal = motivo ?? "error";

    if (!MOTIVOS_ELIMINACION.includes(motivoFinal)) {
      throw new ErrorNegocio("El motivo debe ser terminado, tirado o error", 400);
    }

    const existente = await this.cad.buscarAlimento(usuario.despensaId, id);
    const eliminado = existente &&
      await this.cad.eliminarAlimento(usuario.despensaId, id);

    if (!eliminado) {
      throw new ErrorNegocio("El alimento no existe", 404);
    }

    if (motivoFinal !== "error") {
      await this.registrarMovimiento(
        usuario.despensaId, existente, motivoFinal, existente.cantidad, ahora
      );
    }

    return { mensaje: "Alimento eliminado" };
  }

  // ---------------------------------------------------------------
  // Estadísticas y exportación (Sprint 4)
  // ---------------------------------------------------------------

  async registrarMovimiento(despensaId, alimento, tipo, cantidad, ahora) {
    await this.cad.guardarMovimiento({
      id: randomUUID(),
      usuarioId: despensaId,
      alimentoId: alimento.id,
      nombre: alimento.nombre,
      categoria: alimento.categoria,
      unidad: alimento.unidad,
      tipo,
      cantidad,
      caducado: estadoCaducidad(alimento.fechaCaducidad, ahora).estado === "caducado",
      fecha: ahora
    });
  }

  async obtenerEstadisticas(emailSolicitante, meses = 6, ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const numero = Number(meses);

    if (!Number.isInteger(numero) || numero < 1 || numero > 12) {
      throw new ErrorNegocio("El periodo debe estar entre 1 y 12 meses", 400);
    }

    const movimientos = await this.cad.listarMovimientos(usuario.despensaId);

    return calcularEstadisticas(movimientos, { ahora, meses: numero });
  }

  async exportarDespensaCsv(emailSolicitante, ahora = new Date()) {
    const { alimentos } = await this.listarAlimentos(emailSolicitante, ahora);
    return csvDespensa(alimentos);
  }

  async exportarHistorialCsv(emailSolicitante) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    return csvHistorial(await this.cad.listarMovimientos(usuario.despensaId));
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

      const alimentos = (await this.cad.listarAlimentos(this.despensaIdDe(usuario)))
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

  // ---------------------------------------------------------------
  // Lista de la compra (Sprint 3)
  // Combina los alimentos que han bajado de su mínimo (automáticos)
  // con los elementos que el usuario añade a mano.
  // ---------------------------------------------------------------

  elementoListaPublico(elemento) {
    return {
      id: elemento.id,
      nombre: elemento.nombre,
      cantidad: elemento.cantidad,
      comprado: elemento.comprado,
      creadoEn: elemento.creadoEn
    };
  }

  async obtenerListaCompra(emailSolicitante) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);

    const automaticos = (await this.cad.listarAlimentos(usuario.despensaId))
      .filter(bajoMinimo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map(alimento => ({
        alimentoId: alimento.id,
        nombre: alimento.nombre,
        cantidad: alimento.cantidad,
        unidad: alimento.unidad,
        stockMinimo: alimento.stockMinimo
      }));

    // Primero lo pendiente y, dentro de cada grupo, por orden de alta.
    const manuales = (await this.cad.listarElementosLista(usuario.despensaId))
      .sort((a, b) =>
        Number(a.comprado) - Number(b.comprado) ||
        new Date(a.creadoEn) - new Date(b.creadoEn)
      )
      .map(elemento => this.elementoListaPublico(elemento));

    return { automaticos, manuales };
  }

  async agregarElementoLista(emailSolicitante, datos, ahora = new Date()) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const resultado = validarElementoLista(datos);

    if (resultado.error) {
      throw new ErrorNegocio(resultado.error, 400);
    }

    // Evita añadir productos que ya están pendientes de compra.
    const nombreNormalizado = resultado.datos.nombre
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("es");

    const elementosExistentes =
      await this.cad.listarElementosLista(usuario.despensaId);

    const duplicado = elementosExistentes.some(elemento => {
      const nombreExistente = elemento.nombre
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("es");

      return !elemento.comprado &&
        nombreExistente === nombreNormalizado;
    });

    if (duplicado) {
      throw new ErrorNegocio(
        "Este producto ya está pendiente en la lista de la compra",
        409
      );
    }

    const total = await this.cad.contarElementosLista(usuario.despensaId);

    if (total >= MAX_ELEMENTOS_LISTA) {
      throw new ErrorNegocio(
        `La lista no puede tener más de ${MAX_ELEMENTOS_LISTA} elementos`,
        409
      );
    }

    const elemento = {
      id: randomUUID(),
      usuarioId: usuario.despensaId,
      ...resultado.datos,
      comprado: false,
      creadoEn: ahora
    };

    await this.cad.guardarElementoLista(elemento);

    return this.elementoListaPublico(elemento);
  }

  async marcarElementoLista(emailSolicitante, idElemento, datos) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const id = this.validarIdAlimento(idElemento);

    if (!datos || typeof datos.comprado !== "boolean") {
      throw new ErrorNegocio("Indica si el elemento está comprado", 400);
    }

    const elemento = await this.cad.buscarElementoLista(usuario.despensaId, id);

    if (!elemento) {
      throw new ErrorNegocio("El elemento no existe", 404);
    }

    const actualizado = { ...elemento, comprado: datos.comprado };
    await this.cad.guardarElementoLista(actualizado);

    return this.elementoListaPublico(actualizado);
  }

  async eliminarElementoLista(emailSolicitante, idElemento) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const id = this.validarIdAlimento(idElemento);

    const eliminado = await this.cad.eliminarElementoLista(usuario.despensaId, id);

    if (!eliminado) {
      throw new ErrorNegocio("El elemento no existe", 404);
    }

    return { mensaje: "Elemento eliminado" };
  }

  async eliminarElementosComprados(emailSolicitante) {
    const usuario = await this.usuarioConDespensa(emailSolicitante);
    const eliminados = await this.cad.eliminarElementosComprados(usuario.despensaId);

    return { eliminados };
  }

  // ---------------------------------------------------------------
  // Hogar: despensa compartida (Sprint 4)
  // Todos los miembros comparten alimentos y lista de la compra y
  // tienen los mismos permisos. Las preferencias de avisos son de cada uno.
  // ---------------------------------------------------------------

  async miembrosDespensa(despensaId) {
    return (await this.cad.listar())
      .filter(usuario =>
        usuario.estado === "activo" &&
        this.despensaIdDe(usuario) === despensaId
      );
  }

  async obtenerHogar(emailSolicitante, ahora = new Date()) {
    const yo = await this.obtenerUsuarioActivo(emailSolicitante);
    const miembros = await this.miembrosDespensa(this.despensaIdDe(yo));
    const invitacion = yo.invitacionHogar;

    return {
      compartido: miembros.length > 1,
      maxMiembros: MAX_MIEMBROS_HOGAR,
      miembros: miembros
        .map(miembro => ({ email: miembro.email, soyYo: miembro.id === yo.id }))
        .sort((a, b) => Number(b.soyYo) - Number(a.soyYo) || a.email.localeCompare(b.email)),
      invitacion: invitacion && invitacion.caducaEn > ahora.getTime()
        ? { caducaEn: new Date(invitacion.caducaEn) }
        : null
    };
  }

  // Crea un código de invitación de un solo uso. Solo se guarda su huella.
  async crearInvitacionHogar(emailSolicitante, ahora = new Date()) {
    const yo = await this.obtenerUsuarioActivo(emailSolicitante);
    const miembros = await this.miembrosDespensa(this.despensaIdDe(yo));

    if (miembros.length >= MAX_MIEMBROS_HOGAR) {
      throw new ErrorNegocio(
        `Un hogar puede tener como máximo ${MAX_MIEMBROS_HOGAR} miembros`,
        409
      );
    }

    const codigo = Array.from(
      { length: 8 },
      () => ALFABETO_INVITACION[randomInt(ALFABETO_INVITACION.length)]
    ).join("");

    const caducaEn = ahora.getTime() + DURACION_INVITACION;

    yo.invitacionHogar = { codigoHash: hashInvitacion(codigo), caducaEn };
    await this.cad.guardar(yo);

    return {
      codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}`,
      caducaEn: new Date(caducaEn)
    };
  }

  async unirseHogar(emailSolicitante, codigo, ahora = new Date()) {
    const yo = await this.obtenerUsuarioActivo(emailSolicitante);
    const normalizado = normalizarCodigoInvitacion(codigo);
    const invalido = new ErrorNegocio(
      "El código no es válido o ha caducado",
      400
    );

    if (!/^[A-Z2-9]{8}$/.test(normalizado)) throw invalido;

    const hash = hashInvitacion(normalizado);
    const anfitrion = (await this.cad.listar()).find(usuario =>
      usuario.estado === "activo" &&
      usuario.invitacionHogar?.codigoHash === hash &&
      usuario.invitacionHogar.caducaEn > ahora.getTime()
    );

    if (!anfitrion) throw invalido;

    const destino = this.despensaIdDe(anfitrion);
    const origen = this.despensaIdDe(yo);

    if (destino === origen) {
      throw new ErrorNegocio("Ya compartís la misma despensa", 409);
    }

    const miembrosDestino = await this.miembrosDespensa(destino);

    if (miembrosDestino.length >= MAX_MIEMBROS_HOGAR) {
      throw new ErrorNegocio("Ese hogar ya está completo", 409);
    }

    // El código solo sirve una vez.
    delete anfitrion.invitacionHogar;
    await this.cad.guardar(anfitrion);

    // Si nadie más usaba mi despensa, sus datos pasan al hogar.
    // Si la compartía con otros, se queda con ellos.
    const miembrosOrigen = await this.miembrosDespensa(origen);
    let alimentosMovidos = 0;

    if (miembrosOrigen.length <= 1) {
      alimentosMovidos = await this.cad.moverDespensa(origen, destino);
    }

    yo.hogarId = destino;
    delete yo.invitacionHogar;
    await this.cad.guardar(yo);

    return { ...(await this.obtenerHogar(emailSolicitante, ahora)), alimentosMovidos };
  }

  // Deja a un usuario con una despensa nueva y vacía.
  async separarDeHogar(usuario) {
    usuario.hogarId = randomUUID();
    delete usuario.invitacionHogar;
    await this.cad.guardar(usuario);
  }

  async salirHogar(emailSolicitante, ahora = new Date()) {
    const yo = await this.obtenerUsuarioActivo(emailSolicitante);
    const miembros = await this.miembrosDespensa(this.despensaIdDe(yo));

    if (miembros.length <= 1) {
      throw new ErrorNegocio("No compartes tu despensa con nadie", 409);
    }

    await this.separarDeHogar(yo);

    return this.obtenerHogar(emailSolicitante, ahora);
  }

  async quitarMiembroHogar(emailSolicitante, emailMiembro, ahora = new Date()) {
    const yo = await this.obtenerUsuarioActivo(emailSolicitante);
    const normalizado = this.normalizarEmail(emailMiembro);

    if (normalizado === yo.email) {
      throw new ErrorNegocio("Para irte del hogar, usa «Salir del hogar»", 400);
    }

    const miembro = await this.cad.buscarPorEmail(normalizado);

    if (
      !miembro ||
      miembro.estado !== "activo" ||
      this.despensaIdDe(miembro) !== this.despensaIdDe(yo)
    ) {
      throw new ErrorNegocio("Esa persona no está en tu hogar", 404);
    }

    await this.separarDeHogar(miembro);

    return this.obtenerHogar(emailSolicitante, ahora);
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
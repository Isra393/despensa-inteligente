class ClienteRest {
  async solicitar(ruta, metodo = "GET", datos) {
    let respuesta;

    try {
      respuesta = await fetch(`/api${ruta}`, {
        method: metodo,
        credentials: "same-origin",
        headers: datos ? { "Content-Type": "application/json" } : {},
        ...(datos ? { body: JSON.stringify(datos) } : {})
      });
    } catch {
      throw new Error("No se puede conectar con el servidor");
    }

    const resultado = await respuesta.json();

    if (!respuesta.ok) {
      const error = new Error(
        resultado.error || "No se ha podido completar la operación"
      );
      error.estadoHTTP = respuesta.status;
      throw error;
    }

    return resultado;
  }

  registrar(email, password) {
    return this.solicitar("/registro", "POST", { email, password });
  }

  login(email, password) {
    return this.solicitar("/login", "POST", { email, password });
  }

  sesion() {
    return this.solicitar("/sesion");
  }

  logout() {
    return this.solicitar("/logout", "POST");
  }
    listarUsuarios() {
    return this.solicitar("/usuarios");
  }
    confirmarCuenta(token) {
    return this.solicitar("/confirmar-cuenta", "POST", { token });
  }
    reenviarConfirmacion(email) {
    return this.solicitar(
      "/reenviar-confirmacion",
      "POST",
      { email }
    );
  }

  // Preferencias de los avisos de caducidad
  obtenerAvisos() {
    return this.solicitar("/preferencias/avisos");
  }

  guardarAvisos(preferencias) {
    return this.solicitar("/preferencias/avisos", "PUT", preferencias);
  }

  // Alimentos de la despensa
  listarAlimentos() {
    return this.solicitar("/alimentos");
  }

  crearAlimento(alimento) {
    return this.solicitar("/alimentos", "POST", alimento);
  }

  actualizarAlimento(id, alimento) {
    return this.solicitar(
      `/alimentos/${encodeURIComponent(id)}`,
      "PUT",
      alimento
    );
  }

  eliminarAlimento(id) {
    return this.solicitar(
      `/alimentos/${encodeURIComponent(id)}`,
      "DELETE"
    );
  }

  // Google One Tap
  prepararOneTap() {
    return this.solicitar("/auth/google/one-tap");
  }

  accederOneTap(credential) {
    return this.solicitar(
      "/auth/google/one-tap",
      "POST",
      { credential }
    );
  }
}
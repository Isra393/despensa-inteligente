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
}
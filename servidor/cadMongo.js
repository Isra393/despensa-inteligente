const { MongoClient } = require("mongodb");
const { ErrorNegocio } = require("./modelo");

class CadMongo {
  constructor(cliente, baseDatos) {
    this.cliente = cliente;
    this.baseDatos = baseDatos;
    this.usuarios = baseDatos.collection("usuarios");
  }

  static async conectar(uri, nombreBaseDatos) {
    if (!uri || !nombreBaseDatos) {
      throw new Error("Faltan MONGODB_URI o MONGODB_DB");
    }

    const cliente = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    try {
      await cliente.connect();

      const baseDatos = cliente.db(nombreBaseDatos);
      await baseDatos.command({ ping: 1 });

      const cad = new CadMongo(cliente, baseDatos);

      await cad.usuarios.createIndex(
        { email: 1 },
        { unique: true }
      );

      return cad;
    } catch (error) {
      await cliente.close();
      throw error;
    }
  }

  async buscarPorEmail(email) {
    return this.usuarios.findOne(
      { email },
      { projection: { _id: 0 } }
    );
  }

  async guardar(usuario) {
    const { _id, ...datos } = usuario;

    try {
      await this.usuarios.replaceOne(
        { email: datos.email, id: datos.id },
        datos,
        { upsert: true }
      );

      return { ...datos };
    } catch (error) {
      if (error.code === 11000) {
        throw new ErrorNegocio(
          "El email ya está registrado",
          409
        );
      }

      throw error;
    }
  }

  async listar() {
    return this.usuarios
      .find({}, { projection: { _id: 0 } })
      .toArray();
  }

  async cerrar() {
    await this.cliente.close();
  }
}

module.exports = { CadMongo };
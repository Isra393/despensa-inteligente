const { MongoClient } = require("mongodb");
const { ErrorNegocio } = require("./modelo");

class CadMongo {
  constructor(cliente, baseDatos) {
    this.cliente = cliente;
    this.baseDatos = baseDatos;
    this.usuarios = baseDatos.collection("usuarios");
    this.alimentos = baseDatos.collection("alimentos");
    this.listaCompra = baseDatos.collection("listaCompra");
  }

  // Crea un índice si no existe. Si ya hay uno equivalente creado
  // con otro nombre u opciones (por ejemplo, desde Atlas), lo conserva.
  static async asegurarIndice(coleccion, claves, opciones) {
    try {
      await coleccion.createIndex(claves, opciones);
    } catch (error) {
      // 85: IndexOptionsConflict, 86: IndexKeySpecsConflict
      if (error.code === 85 || error.code === 86) {
        return;
      }

      throw error;
    }
  }

  async crearIndices() {
    await CadMongo.asegurarIndice(
      this.usuarios,
      { email: 1 },
      { unique: true }
    );

    await CadMongo.asegurarIndice(
      this.usuarios,
      { googleSub: 1 },
      {
        unique: true,
        partialFilterExpression: {
          googleSub: { $type: "string" }
        }
      }
    );

    await CadMongo.asegurarIndice(
      this.alimentos,
      { usuarioId: 1, id: 1 },
      { unique: true }
    );

    await CadMongo.asegurarIndice(
      this.listaCompra,
      { usuarioId: 1, id: 1 },
      { unique: true }
    );
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

      await cad.crearIndices();

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
    async buscarPorGoogleSub(googleSub) {
    return this.usuarios.findOne(
      { googleSub },
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
    async confirmarCuenta(tokenHash, ahora) {
    return this.usuarios.findOneAndUpdate(
      {
        estado: "pendiente",
        confirmacionTokenHash: tokenHash,
        confirmacionCaducaEn: { $gt: ahora }
      },
      {
        $set: { estado: "activo" },
        $unset: {
          confirmacionTokenHash: "",
          confirmacionCaducaEn: ""
        }
      },
      {
        returnDocument: "after",
        includeResultMetadata: false,
        projection: { _id: 0 }
      }
    );
  }

  async cerrar() {
    await this.cliente.close();
  }
    async renovarConfirmacion(
    email,
    tokenHash,
    caducaEn,
    ahora
  ) {
    const limite = new Date(ahora.getTime() - 60000);

    const resultado = await this.usuarios.updateOne(
      {
        email,
        estado: "pendiente",
        $or: [
          { confirmacionEnviadaEn: { $exists: false } },
          { confirmacionEnviadaEn: { $lte: limite } }
        ]
      },
      {
        $set: {
          confirmacionTokenHash: tokenHash,
          confirmacionCaducaEn: caducaEn,
          confirmacionEnviadaEn: ahora
        }
      }
    );

    return resultado.modifiedCount === 1;
  }

  // ---------------------------------------------------------------
  // Alimentos. Todas las consultas filtran por el propietario.
  // ---------------------------------------------------------------

  async listarAlimentos(usuarioId) {
    return this.alimentos
      .find({ usuarioId }, { projection: { _id: 0 } })
      .toArray();
  }

  async contarAlimentos(usuarioId) {
    return this.alimentos.countDocuments({ usuarioId });
  }

  async buscarAlimento(usuarioId, id) {
    return this.alimentos.findOne(
      { usuarioId, id },
      { projection: { _id: 0 } }
    );
  }

  async guardarAlimento(alimento) {
    const { _id, ...datos } = alimento;

    await this.alimentos.replaceOne(
      { usuarioId: datos.usuarioId, id: datos.id },
      datos,
      { upsert: true }
    );

    return { ...datos };
  }

  async eliminarAlimento(usuarioId, id) {
    const resultado = await this.alimentos.deleteOne({ usuarioId, id });
    return resultado.deletedCount === 1;
  }

  // ---------------------------------------------------------------
  // Lista de la compra. Todas las consultas filtran por el propietario.
  // ---------------------------------------------------------------

  async listarElementosLista(usuarioId) {
    return this.listaCompra
      .find({ usuarioId }, { projection: { _id: 0 } })
      .toArray();
  }

  async contarElementosLista(usuarioId) {
    return this.listaCompra.countDocuments({ usuarioId });
  }

  async buscarElementoLista(usuarioId, id) {
    return this.listaCompra.findOne(
      { usuarioId, id },
      { projection: { _id: 0 } }
    );
  }

  async guardarElementoLista(elemento) {
    const { _id, ...datos } = elemento;

    await this.listaCompra.replaceOne(
      { usuarioId: datos.usuarioId, id: datos.id },
      datos,
      { upsert: true }
    );

    return { ...datos };
  }

  async eliminarElementoLista(usuarioId, id) {
    const resultado = await this.listaCompra.deleteOne({ usuarioId, id });
    return resultado.deletedCount === 1;
  }

  async eliminarElementosComprados(usuarioId) {
    const resultado = await this.listaCompra.deleteMany({
      usuarioId,
      comprado: true
    });

    return resultado.deletedCount;
  }
}

module.exports = { CadMongo };

const test = require("node:test");
const assert = require("node:assert/strict");
const { crearCorreo, escaparHtml } = require("./correo");

const ENV = {
  SMTP_USER: "remitente@example.com",
  SMTP_PASSWORD: "clave-de-aplicacion",
  APP_URL: "http://localhost:3000"
};

const TOKEN = "a".repeat(64);

function transporteSimulado() {
  const enviados = [];

  return {
    enviados,
    async sendMail(mensaje) {
      enviados.push(mensaje);
    }
  };
}

test("Correo: envía versión de texto y versión HTML con el enlace", async () => {
  const transporte = transporteSimulado();
  const correo = crearCorreo(ENV, { transporte });

  await correo.enviarConfirmacion("ana@example.com", TOKEN);

  const [mensaje] = transporte.enviados;
  const enlace = `http://localhost:3000/#confirmacion=${TOKEN}`;

  assert.equal(mensaje.to, "ana@example.com");
  assert.match(mensaje.subject, /Confirma tu cuenta/);
  assert.ok(mensaje.text.includes(enlace));
  assert.ok(mensaje.html.includes(`href="${enlace}"`));
  assert.match(mensaje.html, /Confirmar mi cuenta/);
  assert.match(mensaje.html, /24 horas/);
});

test("Correo: no envía tokens con formato incorrecto", async () => {
  const transporte = transporteSimulado();
  const correo = crearCorreo(ENV, { transporte });

  await assert.rejects(
    correo.enviarConfirmacion("ana@example.com", "<script>")
  );

  assert.equal(transporte.enviados.length, 0);
});

test("Correo: escapa los caracteres especiales de HTML", () => {
  assert.equal(
    escaparHtml(`<a href="x">'&'</a>`),
    "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;"
  );
});

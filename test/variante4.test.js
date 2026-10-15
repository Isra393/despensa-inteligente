const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularBloqueo } = require("../servidor/modelo");

const fallos = [
  "2026-03-02T10:04:00Z",
  "2026-03-02T10:01:00Z",
  "2026-03-02T10:03:00Z",
  "2026-03-02T10:00:00Z",
  "2026-03-02T10:02:00Z"
];

test("variante4: bloquea con cinco fallos desordenados", () => {
  assert.deepEqual(
    calcularBloqueo(fallos, "2026-03-02T10:10:00Z"),
    {
      bloqueado: true,
      hasta: "2026-03-02T10:19:00.000Z"
    }
  );
});

test("variante4: rechaza una fecha no válida", () => {
  assert.throws(
    () => calcularBloqueo(
      [...fallos, "fecha-incorrecta"],
      "2026-03-02T10:10:00Z"
    ),
    { estadoHTTP: 400 }
  );
});

test("variante4: no bloquea con menos de cinco fallos", () => {
  assert.deepEqual(
    calcularBloqueo(fallos.slice(0, 4), "2026-03-02T10:10:00Z"),
    { bloqueado: false, hasta: null }
  );
});

test("variante4: el bloqueo expira exactamente a los quince minutos", () => {
  assert.deepEqual(
    calcularBloqueo(fallos, "2026-03-02T10:19:00Z"),
    { bloqueado: false, hasta: null }
  );
});

test("variante4: admite una ventana de exactamente quince minutos", () => {
  const fechas = [
    "2026-03-02T10:00:00Z",
    "2026-03-02T10:05:00Z",
    "2026-03-02T10:10:00Z",
    "2026-03-02T10:14:00Z",
    "2026-03-02T10:15:00Z"
  ];

  assert.deepEqual(
    calcularBloqueo(fechas, "2026-03-02T10:20:00Z"),
    {
      bloqueado: true,
      hasta: "2026-03-02T10:30:00.000Z"
    }
  );
});

test("variante4: utiliza solo los cinco fallos más recientes", () => {
  assert.deepEqual(
    calcularBloqueo(
      ["2026-03-01T08:00:00Z", ...fallos],
      "2026-03-02T10:10:00Z"
    ),
    {
      bloqueado: true,
      hasta: "2026-03-02T10:19:00.000Z"
    }
  );
});

test("variante4: no bloquea si los cinco fallos superan quince minutos", () => {
  assert.deepEqual(
    calcularBloqueo(
      [
        "2026-03-02T09:00:00Z",
        ...fallos.filter(fecha => fecha !== "2026-03-02T10:00:00Z")
      ],
      "2026-03-02T10:10:00Z"
    ),
    { bloqueado: false, hasta: null }
  );
});

test("variante4: rechaza datos ausentes o de tipo incorrecto", () => {
  assert.throws(
    () => calcularBloqueo(undefined, undefined),
    { estadoHTTP: 400 }
  );

  assert.throws(
    () => calcularBloqueo("incorrecto", "2026-03-02T10:10:00Z"),
    { estadoHTTP: 400 }
  );
});
// Recetario propio de cocina casera. Cada ingrediente tiene una o varias
// «claves»: palabras que se buscan en el nombre de los alimentos de la
// despensa (sin tildes y sin distinguir singular y plural).
// Los básicos (aceite, sal, agua...) se dan por supuestos en cualquier cocina.

const BASICOS = ["aceite", "sal", "agua", "pimienta"];

function ing(nombre, claves, opcional = false) {
  return { nombre, claves: claves ?? [nombre], opcional };
}

const RECETAS = [
  {
    id: "tortilla-patatas",
    nombre: "Tortilla de patatas",
    minutos: 40,
    raciones: 4,
    ingredientes: [ing("huevos", ["huevo"]), ing("patatas", ["patata"]), ing("cebolla", ["cebolla"], true)],
    pasos: [
      "Pela y corta las patatas (y la cebolla) en láminas finas.",
      "Póchalas a fuego medio con abundante aceite hasta que estén tiernas y escúrrelas.",
      "Bate los huevos con sal y mézclalos con las patatas.",
      "Cuaja la tortilla en una sartén por ambos lados."
    ]
  },
  {
    id: "tortilla-espinacas",
    nombre: "Tortilla de espinacas",
    minutos: 15,
    raciones: 2,
    ingredientes: [ing("huevos", ["huevo"]), ing("espinacas", ["espinaca"]), ing("queso", ["queso"], true)],
    pasos: [
      "Saltea las espinacas un par de minutos con un poco de aceite.",
      "Bate los huevos con sal y añade las espinacas (y el queso si tienes).",
      "Cuaja la tortilla a fuego medio y dale la vuelta."
    ]
  },
  {
    id: "revuelto-champinones",
    nombre: "Revuelto de champiñones",
    minutos: 15,
    raciones: 2,
    ingredientes: [ing("huevos", ["huevo"]), ing("champiñones", ["champinon", "seta"]), ing("ajo", ["ajo"], true)],
    pasos: [
      "Lamina los champiñones y pica el ajo.",
      "Saltéalos en la sartén hasta que suelten el agua.",
      "Añade los huevos batidos con sal y remueve hasta que cuajen jugosos."
    ]
  },
  {
    id: "crema-calabacin",
    nombre: "Crema de calabacín",
    minutos: 30,
    raciones: 4,
    ingredientes: [ing("calabacín", ["calabacin"]), ing("patata", ["patata"]), ing("cebolla", ["cebolla"]), ing("queso", ["queso"], true)],
    pasos: [
      "Pocha la cebolla troceada en una olla con aceite.",
      "Añade el calabacín y la patata en dados y cubre con agua.",
      "Cuece 20 minutos, sala y tritura (con el queso si quieres más cremosa)."
    ]
  },
  {
    id: "gazpacho",
    nombre: "Gazpacho",
    minutos: 15,
    raciones: 4,
    ingredientes: [ing("tomates", ["tomate"]), ing("pepino", ["pepino"]), ing("pimiento", ["pimiento"]), ing("ajo", ["ajo"], true), ing("pan", ["pan"], true)],
    pasos: [
      "Trocea los tomates, el pepino, el pimiento y el ajo.",
      "Tritúralo todo con aceite, sal, un chorrito de vinagre y el pan si tienes.",
      "Cuélalo si lo quieres fino y sírvelo bien frío."
    ]
  },
  {
    id: "ensalada-mixta",
    nombre: "Ensalada mixta",
    minutos: 10,
    raciones: 2,
    ingredientes: [ing("lechuga", ["lechuga", "canonigo", "rucula"]), ing("tomate", ["tomate"]), ing("cebolla", ["cebolla"], true), ing("atún", ["atun"], true), ing("huevo", ["huevo"], true)],
    pasos: [
      "Lava y corta la lechuga y el tomate.",
      "Añade la cebolla, el atún o el huevo cocido que tengas.",
      "Aliña con aceite, sal y vinagre justo antes de servir."
    ]
  },
  {
    id: "pasta-tomate",
    nombre: "Pasta con tomate",
    minutos: 20,
    raciones: 2,
    ingredientes: [ing("pasta", ["pasta", "macarron", "espagueti", "tallarin", "fideo"]), ing("tomate", ["tomate"]), ing("cebolla", ["cebolla"], true), ing("queso", ["queso"], true)],
    pasos: [
      "Cuece la pasta en agua con sal el tiempo que indique el paquete.",
      "Mientras, sofríe la cebolla y añade el tomate hasta que espese.",
      "Mezcla la pasta con la salsa y, si tienes, queso por encima."
    ]
  },
  {
    id: "macarrones-atun",
    nombre: "Macarrones con atún",
    minutos: 20,
    raciones: 2,
    ingredientes: [ing("pasta", ["pasta", "macarron", "espagueti"]), ing("atún", ["atun"]), ing("tomate", ["tomate"])],
    pasos: [
      "Cuece la pasta en agua con sal.",
      "Calienta el tomate en una sartén y añade el atún escurrido.",
      "Mezcla con la pasta escurrida y sirve."
    ]
  },
  {
    id: "arroz-verduras",
    nombre: "Arroz con verduras",
    minutos: 35,
    raciones: 4,
    ingredientes: [ing("arroz", ["arroz"]), ing("pimiento", ["pimiento"]), ing("calabacín", ["calabacin"]), ing("zanahoria", ["zanahoria"]), ing("cebolla", ["cebolla"], true)],
    pasos: [
      "Sofríe la cebolla, el pimiento, la zanahoria y el calabacín en dados.",
      "Añade el arroz, rehoga un minuto y cubre con el doble de agua caliente.",
      "Sala y cuece 18 minutos a fuego medio. Deja reposar 5 minutos."
    ]
  },
  {
    id: "lentejas",
    nombre: "Lentejas estofadas",
    minutos: 50,
    raciones: 4,
    ingredientes: [ing("lentejas", ["lenteja"]), ing("zanahoria", ["zanahoria"]), ing("patata", ["patata"]), ing("cebolla", ["cebolla"]), ing("chorizo", ["chorizo"], true)],
    pasos: [
      "Pon las lentejas en una olla con la verdura troceada y cubre con agua fría.",
      "Añade el chorizo si tienes, un chorro de aceite y sal.",
      "Cuece a fuego lento unos 40 minutos, hasta que estén tiernas."
    ]
  },
  {
    id: "garbanzos-espinacas",
    nombre: "Garbanzos con espinacas",
    minutos: 20,
    raciones: 3,
    ingredientes: [ing("garbanzos", ["garbanzo"]), ing("espinacas", ["espinaca"]), ing("ajo", ["ajo"], true)],
    pasos: [
      "Dora el ajo laminado en una cazuela con aceite.",
      "Añade las espinacas hasta que reduzcan.",
      "Incorpora los garbanzos cocidos con un poco de su caldo y deja 10 minutos."
    ]
  },
  {
    id: "pollo-horno-patatas",
    nombre: "Pollo al horno con patatas",
    minutos: 60,
    raciones: 4,
    ingredientes: [ing("pollo", ["pollo"]), ing("patatas", ["patata"]), ing("cebolla", ["cebolla"]), ing("limón", ["limon"], true)],
    pasos: [
      "Precalienta el horno a 200 °C.",
      "Pon en una bandeja las patatas y la cebolla en rodajas y el pollo encima.",
      "Riega con aceite (y limón), sala y hornea unos 50 minutos dándole la vuelta a mitad."
    ]
  },
  {
    id: "pollo-limon",
    nombre: "Pechuga de pollo al limón",
    minutos: 15,
    raciones: 2,
    ingredientes: [ing("pollo", ["pollo"]), ing("limón", ["limon"]), ing("ajo", ["ajo"], true)],
    pasos: [
      "Corta el pollo en filetes y sálalos.",
      "Hazlos a la plancha con un poco de aceite y el ajo picado.",
      "Al final, añade el zumo del limón y deja reducir un minuto."
    ]
  },
  {
    id: "pescado-horno",
    nombre: "Pescado al horno con patatas",
    minutos: 40,
    raciones: 2,
    ingredientes: [ing("pescado blanco", ["merluza", "bacalao", "dorada", "lubina", "pescado"]), ing("patatas", ["patata"]), ing("cebolla", ["cebolla"], true), ing("limón", ["limon"], true)],
    pasos: [
      "Hornea las patatas y la cebolla en rodajas a 200 °C durante 25 minutos.",
      "Coloca el pescado encima, sala y riega con aceite (y limón).",
      "Hornea 10 o 12 minutos más."
    ]
  },
  {
    id: "salmon-verduras",
    nombre: "Salmón con verduras",
    minutos: 20,
    raciones: 2,
    ingredientes: [ing("salmón", ["salmon"]), ing("calabacín", ["calabacin"]), ing("zanahoria", ["zanahoria"], true)],
    pasos: [
      "Corta las verduras en bastones y saltéalas al dente.",
      "Haz el salmón a la plancha, empezando por la piel.",
      "Sirve el salmón sobre las verduras."
    ]
  },
  {
    id: "albondigas-tomate",
    nombre: "Albóndigas en salsa de tomate",
    minutos: 45,
    raciones: 4,
    ingredientes: [ing("carne picada", ["carne picada", "picada"]), ing("tomate", ["tomate"]), ing("cebolla", ["cebolla"]), ing("huevo", ["huevo"], true), ing("pan", ["pan"], true)],
    pasos: [
      "Mezcla la carne con sal, el huevo y el pan mojado en leche o agua.",
      "Forma bolas y dóralas en una sartén con aceite.",
      "Haz una salsa con la cebolla y el tomate y cuece las albóndigas en ella 20 minutos."
    ]
  },
  {
    id: "pisto",
    nombre: "Pisto",
    minutos: 45,
    raciones: 4,
    ingredientes: [ing("calabacín", ["calabacin"]), ing("pimiento", ["pimiento"]), ing("tomate", ["tomate"]), ing("cebolla", ["cebolla"]), ing("berenjena", ["berenjena"], true), ing("huevo", ["huevo"], true)],
    pasos: [
      "Pica todas las verduras en dados pequeños.",
      "Pocha primero la cebolla y el pimiento, luego el calabacín y la berenjena.",
      "Añade el tomate y cocina a fuego lento 20 minutos. Puedes servirlo con un huevo frito."
    ]
  },
  {
    id: "crema-calabaza",
    nombre: "Crema de calabaza",
    minutos: 35,
    raciones: 4,
    ingredientes: [ing("calabaza", ["calabaza"]), ing("zanahoria", ["zanahoria"]), ing("cebolla", ["cebolla"]), ing("patata", ["patata"], true)],
    pasos: [
      "Pocha la cebolla en una olla con aceite.",
      "Añade la calabaza, la zanahoria (y la patata) en trozos y cubre con agua.",
      "Cuece 25 minutos, sala y tritura."
    ]
  },
  {
    id: "tostadas-francesas",
    nombre: "Tostadas francesas",
    minutos: 15,
    raciones: 2,
    ingredientes: [ing("pan", ["pan"]), ing("leche", ["leche"]), ing("huevos", ["huevo"]), ing("azúcar", ["azucar"], true)],
    pasos: [
      "Moja las rebanadas de pan en leche y después en huevo batido.",
      "Dóralas en una sartén con un poco de aceite o mantequilla.",
      "Espolvorea azúcar (o canela) por encima."
    ]
  },
  {
    id: "arroz-con-leche",
    nombre: "Arroz con leche",
    minutos: 50,
    raciones: 4,
    ingredientes: [ing("arroz", ["arroz"]), ing("leche", ["leche"]), ing("azúcar", ["azucar"]), ing("limón", ["limon"], true)],
    pasos: [
      "Cuece el arroz en la leche con la piel de limón a fuego muy suave.",
      "Remueve a menudo durante 40 minutos para que no se pegue.",
      "Añade el azúcar al final y deja enfriar."
    ]
  },
  {
    id: "batido-platano",
    nombre: "Batido de plátano",
    minutos: 5,
    raciones: 2,
    ingredientes: [ing("plátanos", ["platano"]), ing("leche", ["leche"]), ing("yogur", ["yogur"], true)],
    pasos: [
      "Pela y trocea los plátanos, cuanto más maduros mejor.",
      "Tritúralos con la leche (y el yogur).",
      "Sírvelo frío."
    ]
  },
  {
    id: "macedonia-yogur",
    nombre: "Macedonia con yogur",
    minutos: 10,
    raciones: 2,
    ingredientes: [ing("manzana", ["manzana"]), ing("plátano", ["platano"]), ing("yogur", ["yogur"]), ing("fresas", ["fresa"], true), ing("naranja", ["naranja"], true)],
    pasos: [
      "Trocea toda la fruta que tengas.",
      "Mézclala en un bol con el zumo de la naranja si tienes.",
      "Sírvela con el yogur por encima."
    ]
  },
  {
    id: "sandwich-mixto",
    nombre: "Sándwich mixto",
    minutos: 10,
    raciones: 2,
    ingredientes: [ing("pan de molde", ["pan"]), ing("jamón", ["jamon"]), ing("queso", ["queso"])],
    pasos: [
      "Monta los sándwiches con jamón y queso.",
      "Dóralos en una sartén o sandwichera por ambos lados hasta que se funda el queso."
    ]
  },
  {
    id: "quesadillas",
    nombre: "Quesadillas",
    minutos: 15,
    raciones: 2,
    ingredientes: [ing("tortillas de trigo", ["tortilla trigo", "wrap"]), ing("queso", ["queso"]), ing("pollo", ["pollo"], true), ing("pimiento", ["pimiento"], true)],
    pasos: [
      "Reparte el queso (y el pollo o el pimiento salteados) sobre media tortilla.",
      "Dóblala y tuéstala en una sartén por ambos lados.",
      "Córtala en triángulos."
    ]
  },
  {
    id: "bizcocho-yogur",
    nombre: "Bizcocho de yogur",
    minutos: 50,
    raciones: 8,
    ingredientes: [ing("yogur", ["yogur"]), ing("huevos", ["huevo"]), ing("harina", ["harina"]), ing("azúcar", ["azucar"]), ing("levadura", ["levadura"], true)],
    pasos: [
      "Usa el vaso del yogur como medida: 1 de yogur, 3 de harina, 2 de azúcar y 1 de aceite.",
      "Bate los huevos con el azúcar, añade el yogur y el aceite y después la harina con la levadura.",
      "Hornea a 180 °C unos 35 minutos, hasta que un palillo salga limpio."
    ]
  },
  {
    id: "crema-verduras",
    nombre: "Crema de verduras",
    minutos: 35,
    raciones: 4,
    ingredientes: [ing("zanahoria", ["zanahoria"]), ing("puerro", ["puerro"]), ing("patata", ["patata"]), ing("calabacín", ["calabacin"], true)],
    pasos: [
      "Rehoga el puerro troceado en una olla con aceite.",
      "Añade el resto de verduras en trozos y cubre con agua.",
      "Cuece 25 minutos, sala y tritura."
    ]
  },
  {
    id: "brocoli-salteado",
    nombre: "Brócoli salteado con ajo",
    minutos: 15,
    raciones: 2,
    ingredientes: [ing("brócoli", ["brocoli"]), ing("ajo", ["ajo"]), ing("zanahoria", ["zanahoria"], true)],
    pasos: [
      "Separa el brócoli en ramilletes y escáldalo 3 minutos en agua con sal.",
      "Saltéalo con el ajo laminado (y la zanahoria) en una sartén con aceite."
    ]
  },
  {
    id: "patatas-pobre",
    nombre: "Patatas a lo pobre",
    minutos: 35,
    raciones: 3,
    ingredientes: [ing("patatas", ["patata"]), ing("pimiento", ["pimiento"]), ing("cebolla", ["cebolla"]), ing("huevos", ["huevo"], true)],
    pasos: [
      "Corta las patatas en rodajas finas y la cebolla y el pimiento en tiras.",
      "Póchalo todo a fuego suave con aceite y sal unos 25 minutos.",
      "Sirve con un huevo frito si tienes."
    ]
  }
];

module.exports = { RECETAS, BASICOS };

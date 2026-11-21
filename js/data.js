// Datos del pueblo: trazado, lugares e historias.
// Sistema de coordenadas del juego (alineado con la retícula de calles): x = «oriente» (+), z = «sur» (+).
// Origen (0,0): centro de la manzana del Parque central + Escuela "16 de Septiembre".
// Las medidas se tomaron de las capturas satelitales de Google Maps (escala aprox.
// calculada con el largo de los autos estacionados: ~6.7 px por metro en la captura cercana).
// Todo lo que no se ve claramente en las referencias está marcado como `provisional: true`.

export const META = {
  titulo: 'Las Chicharras, antes y ahora',
  lugar: 'Las Chicharras, municipio de Bella Vista, Chiapas, México',
  coordenadas: [15.6712112581895, -92.21202065155748],
  version: 'Prototipo 0.1 · Tramo: Iglesia y Agencia Municipal → Parque central → Escuela 16 de Septiembre',
  // Datos públicos verificados (ver docs/datos-documentados.md para fuentes y nivel de confianza)
  datos: [
    'Localidad rural, clave INEGI 070110019.',
    'Habitantes: 1,360 según el Censo 2020 (1,324 en 2010).',
    'Altitud aproximada: 649 m sobre el nivel del mar (por confirmar con INEGI).',
    'Es la segunda localidad más poblada del municipio de Bella Vista.',
  ],
};

// Escala y orientación, confirmadas con las calles de OpenStreetMap (archivo CADMapper):
//  - 1 unidad del juego = 0.95 m reales (las cuadras miden ~95 m de eje a eje).
//  - La retícula del pueblo está girada ~20.6° respecto al norte real: el «arriba» del juego apunta a
//    rumbo 20.6° (nor-noreste). Las capturas de Google Maps que se usaron estaban giradas para alinear las calles.
export const ESCALA = 0.95;
export const DECLINACION = 20.6;

// Andador / calle angosta entre el parque y la escuela (se ve en la captura cercana).
export const CALLE_ANGOSTA = { x: 0, ancho: 6, desde: -46, hasta: 46, provisional: true };

// Punto de vista de la fotografía histórica (Street View). Deducido así:
// la calle de concreto se aleja a la derecha (calle central, hacia el sur), el parque
// queda a la izquierda y el domo detrás de los ficus => cámara en la esquina noroeste
// del parque, mirando al sureste.
export const FOTO_ANTES = {
  src: 'assets/antes-parque-streetview.webp',
  credito: 'Imagen: Google Street View. Fecha por confirmar (la marca de agua sugiere mediados de la década de 2010).',
  etiqueta: 'Antes · c. 2015–2016 (por confirmar)',
  camara: { x: -47.5, z: -52.5, yaw: -2.44, pitch: 0.04 },
  radio: 22,
};

export const INICIO = { x: -50, z: 26, yaw: 0.25 };

// ------------------------------------------------------------------------------------
// LUGARES CON HISTORIA ("Conocer este lugar")
// tipo de contenido:
//   documentado: hechos verificables, con su fuente
//   recuerdos:   testimonios personales (solo con autorización; autor = null si es anónimo)
// ------------------------------------------------------------------------------------
export const LUGARES = [
  {
    id: 'iglesia',
    nombre: 'Iglesia católica', corto: 'Iglesia',
    pos: [-52, 9.4],
    radio: 8,
    foto: { src: 'assets/iglesia-fachada.webp', credito: 'Foto aportada por la comunidad (2026). El cielo parece retocado digitalmente; para el modelo solo se usó el edificio.' },
    provisional: false,
    notaReconstruccion:
      'La fachada, la espadaña, los colores y la reja salen de la foto de la comunidad. Las medidas se calcularon con el ancho de la nave visto desde el satélite (unos 10 m). ' +
      'Siguen siendo aproximados el color de los muros laterales y la profundidad del atrio.',
    documentado: [
      { texto: 'Está marcada en Google Maps como «Iglesia católica», del lado poniente de la calle central, frente al Parque central.', fuente: 'Google Maps (captura enviada por la comunidad, 2026)' },
      { texto: 'Su fachada es amarilla, con molduras azules y cuatro pilastras blancas con anillos azules. Arriba tiene una espadaña con tres arcos para las campanas y una cruz blanca; al centro, un óculo redondo sobre la puerta en arco.', fuente: 'Foto aportada por la comunidad (2026)' },
      { texto: 'Al frente tiene un atrio cerrado por una barda baja blanca con barandal y un portón azul con un diseño de rayos de sol.', fuente: 'Foto aportada por la comunidad (2026)' },
      { texto: 'Desde arriba se ve una nave alargada con techo de lámina gris, orientada de poniente a oriente.', fuente: 'Imagen satelital de Google Maps' },
    ],
    recuerdos: [],
    pendiente: '¿A qué santo está dedicada y cuándo es su fiesta? ¿Siempre ha sido amarilla? ¿Hay fotos de cómo era antes?',
  },
  {
    id: 'agencia',
    nombre: 'Agencia Municipal', corto: 'Agencia',
    pos: [-51, 27.5],
    radio: 9,
    foto: null,
    provisional: true,
    notaReconstruccion:
      'Confirmado por la comunidad: es la construcción blanca junto a la iglesia, que se alcanza a ver en la foto de la iglesia. ' +
      'La altura de dos niveles, las ventanas y el letrero son provisionales hasta tener una foto de su frente.',
    documentado: [
      { texto: 'Está marcada en Google Maps como «AGENCIA MUNICIPAL», en la misma manzana que la iglesia, justo al sur de ella, frente al parque.', fuente: 'Google Maps (captura enviada por la comunidad, 2026)' },
      { texto: 'Es la construcción blanca que aparece a la izquierda en la foto de la iglesia.', fuente: 'Confirmado por la comunidad (2026)' },
      { texto: 'Desde el aire sus techos se ven rojos, color típico del impermeabilizante en techos planos de concreto.', fuente: 'Imagen satelital de Google Maps' },
    ],
    recuerdos: [],
    pendiente: '¿Desde cuándo está la Agencia en este edificio? ¿Qué había antes?',
  },
  {
    id: 'explanada',
    nombre: 'La esquina de los ficus', corto: 'Foto antigua',
    subtitulo: 'Esquina noroeste del Parque central',
    pos: [-44, -46],
    radio: 11,
    foto: 'FOTO_ANTES',
    antesAhora: true,
    provisional: false,
    notaReconstruccion:
      'Los árboles, la explanada de tierra y el domo detrás se reconstruyeron a partir de esta foto y de la vista satelital. ' +
      'La fecha exacta de la foto está por confirmar.',
    documentado: [
      { texto: 'En la foto se ven ficus grandes con el tronco pintado de blanco (encalado), una explanada de tierra donde se estacionan camionetas y, detrás, el arco del domo con gente reunida debajo.', fuente: 'Google Street View' },
      { texto: 'Hacia la derecha, la calle central de concreto se aleja hacia el sur; al fondo se ven los cerros que rodean al pueblo.', fuente: 'Google Street View' },
      { texto: 'Toca «Antes / Ahora» aquí para comparar la foto con la reconstrucción actual desde el mismo ángulo.', fuente: null },
    ],
    recuerdos: [],
  },
  {
    id: 'domo',
    nombre: 'El domo del Parque central', corto: 'Domo',
    pos: [-17, -18],
    radio: 15,
    foto: null,
    provisional: false,
    notaReconstruccion:
      'Medidas aproximadas tomadas de la imagen satelital (unos 22 × 31 m). La altura del arco y las columnas son estimadas.',
    documentado: [
      { texto: 'El parque tiene una gran techumbre de arco («domo») sobre la cancha, en su mitad norte. Mide aproximadamente 22 m de ancho por 31 m de largo.', fuente: 'Medición sobre imagen satelital de Google Maps' },
      { texto: 'En la foto de Street View se ve gente reunida bajo el domo, señal de que es un lugar de encuentro del pueblo.', fuente: 'Google Street View' },
    ],
    recuerdos: [],
    pendiente: '¿En qué año se construyó el domo? ¿Qué había antes en ese lugar?',
  },
  {
    id: 'kiosco',
    nombre: 'La plaza del parque', corto: 'Plaza',
    pos: [-25, 24],
    radio: 10,
    foto: null,
    provisional: true,
    notaReconstruccion:
      'En la imagen satelital se ve una construcción pequeña con techo en medio de la plaza. La reconstruimos como un kiosco, pero está por confirmar.',
    documentado: [
      { texto: 'La mitad sur del parque es una plaza con piso color ladrillo, andadores en diagonal y muchos árboles.', fuente: 'Imagen satelital de Google Maps' },
    ],
    recuerdos: [],
    pendiente: '¿Esa construcción es un kiosco? ¿De qué color es? ¿Hay bancas o jardineras especiales?',
  },
  {
    id: 'adobe',
    nombre: 'La casa de adobe de la esquina', corto: 'Casa de adobe',
    subtitulo: 'Calle central, frente a la esquina suroeste del parque',
    pos: [-42, 52],
    radio: 8,
    foto: null,
    provisional: false,
    notaReconstruccion:
      'Señalada por la comunidad y reconstruida con una foto de Street View (fecha por confirmar). ' +
      'La profundidad de la casa y su parte trasera son provisionales.',
    documentado: [
      { texto: 'Casa de muros de adobe aparente, con techo de lámina de una sola caída, oxidada, con tres láminas claras.', fuente: 'Google Street View · señalada por la comunidad (2026)' },
      { texto: 'Al frente tiene una puerta de madera y dos ventanas pequeñas de postigo. Junto a la puerta, un letrero azul dice «Prohibido tirar basura en este lugar. Gracias».', fuente: 'Google Street View' },
      { texto: 'En esa foto, la calle de enfrente (al sur del parque) todavía era de terracería. Hoy es de concreto: toca «Antes / Ahora» aquí para comparar.', fuente: 'Google Street View · confirmado por la comunidad (2026)' },
      { texto: 'En la misma foto, la calle central hacia el sur se ve de terracería, con cunetas a los lados.', fuente: 'Google Street View' },
      { texto: 'Desde el cruce, mirando al poniente, la calle también era de terracería. En la esquina de enfrente hay una casa blanca con techo de lámina oxidada a cuatro aguas, y del otro lado una casa de block sin enjarre con un tejabán de madera.', fuente: 'Google Street View (c. 2015) · señalada por la comunidad (2026)' },
    ],
    recuerdos: [],
    antesAhora: true,
    pendiente: '¿De quién era esta casa y desde cuándo está? ¿Sigue en pie? ¿En qué año pavimentaron la calle?',
  },
  {
    id: 'escuela',
    nombre: 'Escuela Primaria «16 de Septiembre»', corto: 'Escuela',
    pos: [5, -12],
    radio: 10,
    foto: null,
    provisional: true,
    notaReconstruccion:
      'Edificios, techos y su propio domo según la imagen satelital. La barda, la entrada y los letreros son provisionales.',
    documentado: [
      { texto: 'Marcada en Google Maps como Escuela Primaria «16 de Septiembre», justo al oriente del Parque central.', fuente: 'Google Maps (captura enviada por la comunidad, 2026)' },
      { texto: 'Su nombre recuerda el 16 de septiembre de 1810, fecha en que se conmemora el inicio de la Independencia de México.', fuente: 'Hecho histórico general' },
      { texto: 'Clave de centro de trabajo (SEP): 07DPR3212N.', fuente: 'Listado oficial SEP, gob.mx (Chiapas.pdf)' },
      { texto: 'Un directorio escolar indica turno matutino y que funciona desde 1966. Este año está por confirmar con la escuela.', fuente: 'escuelasmex.com (cita a INIFED) · confianza media-baja' },
      { texto: 'Tiene un patio techado con arco, más angosto que el del parque, rodeado de salones con techos blancos y rojos.', fuente: 'Imagen satelital de Google Maps' },
    ],
    recuerdos: [],
    pendiente: '¿Dónde está la entrada principal? ¿De qué color está pintada la barda?',
  },
];

// Ruta sugerida (solo para el minimapa).
export const RUTA = [
  [-50, 26], [-50, 10], [-50, -46], [-44, -46], [-36, -30], [-22, 0], [-25, 22], [-12, 20], [-3, -12], [5, -12],
];

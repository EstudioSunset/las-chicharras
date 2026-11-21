// Datos del pueblo: trazado, lugares e historias.
// Sistema de coordenadas en METROS: x = este (+) / oeste (-), z = sur (+) / norte (-).
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

// Retícula de calles: ejes cada 100 m (medido en la captura amplia: ~118 px por cuadra).
export const GRID = {
  paso: 100,          // distancia entre ejes de calle
  anchoCalle: 8,      // ancho de arroyo vehicular (aprox.)
  manzanas: 2,        // manzanas a cada lado del centro (5 × 5 en total)
};

// Calles de concreto (las demás se dibujan como terracería). Provisional: se dedujo del
// color gris claro en la imagen satelital.
export const CALLES_CONCRETO = [
  // { eje: 'x' => calle norte-sur en x = valor, desde..hasta en z }
  { ns: true, en: -50, desde: -250, hasta: 250, nombre: 'Calle central' },
  { ns: true, en: 50, desde: -150, hasta: 150 },
  { ns: true, en: -150, desde: -50, hasta: 50 },
  { ns: false, en: -50, desde: -150, hasta: 150 },
  { ns: false, en: 50, desde: -150, hasta: 150 },
];

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
    pos: [-60, 9.5],
    radio: 9,
    foto: null,
    provisional: true,
    notaReconstruccion:
      'La ubicación, el tamaño de la nave y el atrio salen de la imagen satelital. ' +
      'La fachada, la torre y los colores son provisionales: todavía no tenemos una foto del frente.',
    documentado: [
      { texto: 'Está marcada en Google Maps como «Iglesia católica», del lado poniente de la calle central, frente al Parque central.', fuente: 'Google Maps (captura enviada por la comunidad, 2026)' },
      { texto: 'Desde arriba se ve una nave alargada con techo de lámina gris, orientada de poniente a oriente, con un pequeño atrio con pasto hacia la calle central.', fuente: 'Imagen satelital de Google Maps' },
    ],
    recuerdos: [],
  },
  {
    id: 'agencia',
    nombre: 'Agencia Municipal', corto: 'Agencia',
    pos: [-56, 28],
    radio: 9,
    foto: null,
    provisional: true,
    notaReconstruccion:
      'Ubicación y techos rojizos según la imagen satelital. El portal, el letrero y los colores de la fachada son provisionales.',
    documentado: [
      { texto: 'Está marcada en Google Maps como «AGENCIA MUNICIPAL», en la misma manzana que la iglesia, hacia el sur, frente al parque.', fuente: 'Google Maps (captura enviada por la comunidad, 2026)' },
      { texto: 'Se distingue desde el aire por sus techos color rojo-terracota, distintos de la lámina blanca de la mayoría de las casas.', fuente: 'Imagen satelital de Google Maps' },
    ],
    recuerdos: [],
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

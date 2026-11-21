# Las Chicharras, antes y ahora

Recorrido 3D para celular del pueblo de **Las Chicharras, municipio de Bella Vista, Chiapas**. El visitante abre un enlace, camina por las calles, reconoce los lugares y conoce las historias de quienes vivieron ahí. Funciona en el navegador y no hay que instalar ninguna aplicación.

> **Prototipo 0.1.** La reconstrucción se basa en capturas satelitales de Google Maps y en una imagen de Street View. Todo lo que no se ve con claridad en esas referencias está marcado como **provisional** dentro del juego.

## Primer tramo: calle central → Parque central → Escuela «16 de Septiembre»

Elegí este tramo porque es el **mejor documentado** con las referencias que tenemos:

- Es el único punto con **foto a nivel de calle** (Street View, esquina noroeste del parque). Esa foto permite reconstruir los ficus encalados, la explanada de tierra, el domo y la calle de concreto, y sirve como la **primera comparación «Antes / Ahora»**.
- Concentra **cuatro lugares marcados en Google Maps** a menos de 100 m: la Iglesia católica, la Agencia Municipal, el Parque central y la Escuela Primaria «16 de Septiembre».
- Tiene **formas fáciles de reconocer desde la calle**: los dos domos de arco, la plaza con piso de ladrillo y los árboles grandes.

Recorrido: se empieza en la calle central, frente a la iglesia. De ahí se sigue a la esquina de los ficus (foto antigua), se cruza el parque bajo el domo y por la plaza, y se llega al portón de la escuela.

## Cómo usarlo

| | Celular | Computadora |
|---|---|---|
| Caminar | Mantén y desliza en la mitad izquierda. Llévalo al borde para ir más rápido. | W A S D o flechas (Shift para correr) |
| Mirar | Arrastra en la mitad derecha | Arrastra con el ratón · ← → |
| Conocer este lugar | Botón que aparece al acercarte | E |
| Antes / Ahora | Botón inferior derecho | T |
| Mapa | Toca el círculo de arriba | M |

Prueba local:

```
python -m http.server 8000
```

Después abre `http://localhost:8000`. El sitio es estático, así que se puede publicar tal cual en GitHub Pages.

## Estructura

```
index.html          interfaz (portada, HUD, panel de historias, comparador)
styles.css
js/data.js          ← AQUÍ se editan lugares, historias, fuentes y la foto antigua
js/world.js         construcción 3D del pueblo (calles, casas, parque, domos, escuela)
js/controls.js      palanca táctil, arrastre para mirar, teclado
js/audio.js         chicharras y pasos sintetizados (sin archivos de audio)
js/textures.js      texturas generadas en el navegador (carga inicial ligera)
assets/             foto histórica
docs/               datos documentados, guía para reunir fotos y formato de autorización
```

### Agregar una historia

Cada lugar en `js/data.js` (`LUGARES`) separa los **hechos documentados** (con fuente) de los **recuerdos personales**:

```js
recuerdos: [
  { texto: 'Aquí jugábamos básquet todas las tardes…', autor: 'Nombre Apellido', autorizado: true, fecha: '1985' },
]
```

Si `autorizado` es `false` o no hay `autor`, el recuerdo aparece como «Un vecino de Las Chicharras». Antes de publicar cualquier nombre se usa el formato de `docs/autorizacion-testimonio.md`.

## Rendimiento

- La escena completa se dibuja con unas **20 llamadas de dibujo** y unos 250 mil triángulos: las casas se combinan en una sola malla y los árboles usan instancias.
- No se descargan modelos ni texturas, porque todo se genera en el navegador. Solo se descarga three.js desde un CDN, unos 170 KB comprimido.
- La resolución baja sola si el teléfono no alcanza unos 30 cuadros por segundo.

## Qué es provisional y qué referencias faltan

Las prioridades están ordenadas de la más importante a la menos importante. La guía completa para pedirlas está en `docs/guia-recoleccion.md`.

1. **Fachada de la Iglesia** (frente, torre y colores). Hoy es una aproximación.
2. **Fachada de la Agencia Municipal**: si tiene portal, su letrero y sus colores.
3. **Entrada de la escuela**: dónde está el portón y de qué color es la barda.
4. **La construcción del centro de la plaza**: si es un kiosco y cómo es.
5. **Cuatro esquinas del parque**: una foto desde cada esquina, mirando al centro.
6. **Desnivel del terreno**: el modelo es plano por ahora. Hace falta saber si la calle central sube o baja y hacia dónde.
7. **Fotos antiguas con año o década** de cualquier punto del tramo, y una foto nueva tomada desde el mismo lugar para comparar.
8. **Recuerdos autorizados** para cada punto, aunque sean audios cortos de WhatsApp.
9. **Nombres de las otras calles**. Por ahora solo conocemos la «calle central».
10. **Cerros**: una vuelta de 360° desde el parque para ubicar bien la sierra, que hoy es aproximada.

## Próximas etapas

- **Medios de transporte**: burro, bicicleta y mototaxi, con su propia velocidad, maniobrabilidad y sonido. El mototaxi podrá detenerse y dejar al visitante junto a un lugar. Ya aparecen en el menú como «próximamente».
- **Ampliar el mapa** hacia el Barrio Los Manuales, El Pozo y Los Mangales cuando haya fotos de calle.
- Más comparaciones «Antes / Ahora», cada una respaldada por una foto o un testimonio.

## Créditos y fuentes

- Trazado y techos: capturas de Google Maps aportadas por la comunidad (2026).
- Foto histórica: Google Street View. Su fecha está por confirmar. Se usa con atribución y se reemplazará por fotos propias de la comunidad.
- Datos de población y de la escuela: ver `docs/datos-documentados.md` (INEGI, SEP).
- Motor 3D: [three.js](https://threejs.org) (MIT).

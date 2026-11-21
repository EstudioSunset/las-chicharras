"""Convierte el DXF de CADMapper (calles de OpenStreetMap) al sistema de coordenadas del juego.

Uso:  python -I herramientas/dxf_a_calles.py referencias/cadmapper-las-chicharras-chiapas-mx.dxf js/calles.js

Sistema del juego: la retícula de calles está girada ~20.6° respecto al norte real.
  - eje "este" del juego  = rumbo 110.6°   - eje "norte" del juego = rumbo 20.6°
  - origen del juego: el cruce calle central × calle principal (esquina NO del parque) está en (-50, -50)
  - escala: 1 unidad del juego = 0.95 m reales (el mundo se dibuja escalado por 0.95)
"""
import math, sys, json

src, dst = sys.argv[1], sys.argv[2]
THETA = math.radians(20.6)
O = (503.4669, 391.2440)      # cruce calle central × calle principal en el DXF
K = 0.95

lineas = [l.rstrip('\r\n') for l in open(src, encoding='latin-1')]
pares = [(lineas[i].strip(), lineas[i + 1]) for i in range(0, len(lineas) - 1, 2)]
calles, actual = [], None
en_entidades = False
for i, (cod, val) in enumerate(pares):
    if cod == '2' and val.strip() == 'ENTITIES': en_entidades = True
    if not en_entidades: continue
    if cod == '0':
        if actual and len(actual['pts']) >= 2: calles.append(actual)
        actual = {'capa': None, 'pts': []} if val.strip() == 'LWPOLYLINE' else None
        if val.strip() == 'ENDSEC': break
    elif actual is not None:
        if cod == '8': actual['capa'] = val.strip()
        elif cod == '10': actual['_x'] = float(val)
        elif cod == '20': actual['pts'].append((actual.pop('_x'), float(val)))

def a_juego(x, y):
    dx, dy = x - O[0], y - O[1]
    u = dx * math.cos(THETA) - dy * math.sin(THETA)
    v = dx * math.sin(THETA) + dy * math.cos(THETA)
    return [round((-47.5 + u) / K, 2), round((-47.5 - v) / K, 2)]

salida = [{'tipo': 'principal' if c['capa'] == 'major_roads' else 'secundaria', 'pts': [a_juego(*p) for p in c['pts']]} for c in calles]
with open(dst, 'w', encoding='utf-8') as f:
    f.write('// Generado por herramientas/dxf_a_calles.py a partir de CADMapper.\n')
    f.write('// Datos de calles © colaboradores de OpenStreetMap (ODbL). Coordenadas del juego (ver data.js).\n')
    f.write('export const CALLES = ' + json.dumps(salida, separators=(',', ':')) + ';\n')
print(len(salida), 'calles;', sum(len(c['pts']) for c in salida), 'puntos')
xs = [p[0] for c in salida for p in c['pts']]; zs = [p[1] for c in salida for p in c['pts']]
print('x', min(xs), max(xs), 'z', min(zs), max(zs))
for c in salida:
    print(c['tipo'][:4], c['pts'][:3], '...' if len(c['pts']) > 3 else '')

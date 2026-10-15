#!/usr/bin/env python3
"""Actualiza SOLO el costo de productos existentes comparándolo con el precio superior visible en DAZ.
Uso: pip install requests beautifulsoup4; python actualizar_precios_transferencia.py
Entrada: daz_productos.json | Salida: daz_productos_transferencia.json
"""
import json
from pathlib import Path
from datetime import datetime, timezone
from extraer_daz import cross_prices_against_website

src = Path('daz_productos.json')
dst = Path('daz_productos_transferencia.json')
if not src.exists():
    raise SystemExit('No encuentro daz_productos.json en esta carpeta. Copialo aquí primero.')
data = json.loads(src.read_text(encoding='utf-8'))
products = data if isinstance(data, list) else data.get('productos')
if not isinstance(products, list) or not products:
    raise SystemExit('Se esperaba una lista de productos o un objeto con la clave productos.')

for p in products:
    # No asumir que los precios anteriores de la API (muchas veces efectivo web)
    # corresponden a transferencia. Exigir observación directa en el HTML.
    p['precio_transferencia_daz'] = None
    p['precio_lista'] = None

cross_prices_against_website(products)
confirmados = sum(bool(p.get('precio_transferencia_daz')) for p in products)
sin_confirmar = len(products)-confirmados
if not confirmados:
    raise SystemExit('No se confirmó ningún precio superior. No se escribió ningún archivo.')
if isinstance(data, dict):
    data['extraido_utc'] = datetime.now(timezone.utc).isoformat()
    data['metodo_precios'] = 'Precio superior visible DAZ (no Efectivo Precio web)'
    data['precios_confirmados'] = confirmados
    data['precios_sin_confirmar'] = sin_confirmar

dst.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'LISTO: {dst} | {confirmados} confirmados, {sin_confirmar} sin confirmar.')
print('Entrá en /admin > Productos y precios > Importar JSON y seleccioná ese archivo.')
print('Los productos sin precio superior confirmado se omiten en la importación.')

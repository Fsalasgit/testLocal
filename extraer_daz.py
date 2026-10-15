#!/usr/bin/env python3
"""Exporta catálogo público de DAZ a JSON. Ejecutar: pip install requests beautifulsoup4; python extraer_daz.py"""
import json, re, time, sys
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, urlsplit
from urllib.robotparser import RobotFileParser
import requests
from bs4 import BeautifulSoup

BASE='https://dazimportadora.com.ar'
UA='CatalogResearchBot/1.0 (public-catalog-export; respectful rate limit)'
S=requests.Session(); S.headers.update({'User-Agent':UA,'Accept':'text/html,application/json'})
WAIT=1.5

def key_url(url):
    if not url:return ''
    u=urlsplit(urljoin(BASE,str(url)))
    return u.path.rstrip('/').lower()

def transfer_amounts(text):
    vals=[money(x) for x in re.findall(r'\$\s*[\d.,]+',str(text))]
    vals=[v for v in vals if v is not None and v>0]
    # Solo dos precios visibles permiten distinguir el superior del efectivo web.
    # Nunca aplicar 7% fijo a los costos provenientes de una API.
    if len(vals)<2:return (None,vals[0] if vals else None)
    return vals[0],vals[1]


def fetch(url):
    for n in range(3):
        try:
            r=S.get(url,timeout=25)
            if r.status_code in (403,429):
                raise RuntimeError(f'El sitio bloqueó el acceso ({r.status_code}) a {url}. Detener, no evadir.')
            r.raise_for_status(); time.sleep(WAIT); return r
        except requests.RequestException:
            if n==2: raise
            time.sleep(3*(n+1))

def money(s):
    if s is None: return None
    s=re.sub(r'[^\d,.]','',str(s)).strip()
    if not s:return None
    if ',' in s and '.' in s: s=s.replace('.','').replace(',','.')
    elif ',' in s: s=s.replace(',','.')
    elif s.count('.')==1 and len(s.split('.')[-1])==3: s=s.replace('.','')
    try:return float(s)
    except ValueError:return None

def txt(node): return node.get_text(' ',strip=True) if node else ''

def product_from_store(p):
    prices=p.get('prices') or {}
    minor=10**int(prices.get('currency_minor_unit',2) or 0)
    def pr(v):
        try:return int(v)/minor if v not in (None,'') else None
        except (ValueError,TypeError):return None
    imgs=[i.get('src') for i in p.get('images',[]) if i.get('src')]
    return {'sku':p.get('sku') or str(p.get('id')),'id_origen':p.get('id'),'nombre':p.get('name'),
     'marca':None,'categorias':[c.get('name') for c in p.get('categories',[]) if c.get('name')],
     # Los valores de la API pueden NO reflejar el precio superior que muestra el sitio.
     # La base de transferencia queda explícitamente sin verificar hasta cruzar HTML.
     'precio_lista':None,'precio_transferencia_daz':None,
     'precio_efectivo':pr(prices.get('price')),'precio_efectivo_web':pr(prices.get('price')),
     'moneda':prices.get('currency_code') or 'ARS','stock_estado':('Disponible' if p.get('is_in_stock') else 'Agotado') if p.get('is_in_stock') is not None else None,
     'descripcion':BeautifulSoup(p.get('description') or p.get('short_description') or '', 'html.parser').get_text(' ',strip=True),
     'imagenes':imgs,'url_origen':p.get('permalink'),'activo':True}

def listing_cards(soup):
    selectors=['li.product','div.product-grid-item','div.product-wrapper','article.product','div.product.type-product']
    for sel in selectors:
        cards=soup.select(sel)
        cards=[c for c in cards if c.select_one('a[href*="/producto/"]')]
        if len(cards)>=3:return cards
    return []

def parse_card(card):
    a=card.select_one('a[href*="/producto/"]')
    title=card.select_one('.woocommerce-loop-product__title, .product-title, h3, h2')
    name=txt(title) or (a.get('title') if a else None) or txt(a)
    url=urljoin(BASE,a['href']) if a else None
    raw=txt(card)
    sku=(re.search(r'SKU\s*:\s*([\w-]+)',raw,re.I) or [None,None])[1]
    cats=[txt(c) for c in card.select('.posted_in a, .product-categories a, .wd-product-cats a')]
    cats=list(dict.fromkeys(x for x in cats if x))
    brand=txt(card.select_one('.wd-product-brands a, .product-brand a')) or None
    # Extraer los DOS precios visibles: el superior para transferencia, el inferior efectivo web.
    # Usar el elemento de precio primero para evitar montos de otro texto en la tarjeta.
    price_node=card.select_one('.price, .wd-product-price, .product-price')
    cost, cash=transfer_amounts(txt(price_node) if price_node else raw)
    if cost is None and price_node is not None:
        cost, cash=transfer_amounts(raw)
    stock=re.search(r'(Stock\s+(?:Alto|Medio|Bajo)|Quedan\s*:\s*\d+|Sin stock)',raw,re.I)
    im=card.select_one('img[data-src],img[src]')
    image=(im.get('data-src') or im.get('src')) if im else None
    return {'sku':sku,'id_origen':None,'nombre':name,'marca':brand,'categorias':cats,
    'precio_lista':cost,'precio_transferencia_daz':cost,
    'precio_efectivo':cash,'precio_efectivo_web':cash,
    'moneda':'ARS','stock_estado':stock.group(1) if stock else None,'descripcion':'',
    'imagenes':[urljoin(BASE,image)] if image and not image.startswith('data:') else [],
    'url_origen':url,'activo':True}

def enrich(item):
    if not item['url_origen']:return item
    sp=BeautifulSoup(fetch(item['url_origen']).text,'html.parser')
    sku=sp.select_one('.sku')
    if sku:item['sku']=txt(sku)
    cats=[txt(a) for a in sp.select('.product_meta .posted_in a')]
    if cats:item['categorias']=list(dict.fromkeys(cats))
    descr=sp.select_one('.woocommerce-product-details__short-description')
    full=sp.select_one('#tab-description')
    item['descripcion']=txt(full) or txt(descr) or item['descripcion']
    images=[]
    for a in sp.select('.woocommerce-product-gallery__image a[href], .product-images a[href], .wd-carousel-item a[href]'):
        href=a.get('href','')
        if re.search(r'\.(?:jpg|jpeg|png|webp)(?:\?|$)',href,re.I):images.append(urljoin(BASE,href))
    if not images:
        for im in sp.select('.woocommerce-product-gallery img, .product-images img'):
            u=im.get('data-large_image') or im.get('data-src') or im.get('src')
            if u and not u.startswith('data:'):images.append(urljoin(BASE,u))
    if images:item['imagenes']=list(dict.fromkeys(images))
    if not item.get('precio_transferencia_daz'):
        node=sp.select_one('.summary .price, .single-product-content .price, p.price, .product-price')
        if node:
            superior, efectivo=transfer_amounts(txt(node))
            if superior is not None:
                item['precio_lista']=superior
                item['precio_transferencia_daz']=superior
                item['precio_efectivo']=efectivo
                item['precio_efectivo_web']=efectivo
    return item

def api_export():
    out=[]
    for page in range(1,101):
        u=f'{BASE}/wp-json/wc/store/v1/products?per_page=100&page={page}'
        r=S.get(u,timeout=20)
        if r.status_code in (401,403,404):return None
        if r.status_code!=200 or 'json' not in r.headers.get('Content-Type',''):return None
        try: data=r.json()
        except ValueError:return None
        if not isinstance(data,list):return None
        if not data:break
        out.extend(product_from_store(p) for p in data)
        print(f'API: {len(out)} productos',flush=True);time.sleep(WAIT)
        if len(data)<100:break
    return out or None

def cross_prices_against_website(products):
    # Cruce por permalink + SKU entre Woo Store API y catálogo visible.
    by_url={key_url(p.get('url_origen')):p for p in products if key_url(p.get('url_origen'))}
    by_sku={str(p.get('sku')):p for p in products if p.get('sku')}
    resolved=set();page=0;seen_signatures=set()
    for page in range(1,101):
        url=f'{BASE}/productos/' if page==1 else f'{BASE}/productos/page/{page}/'
        soup=BeautifulSoup(fetch(url).text,'html.parser')
        cards=listing_cards(soup)
        if not cards:
            if page==1:raise RuntimeError('No se pudieron leer precios visibles de DAZ: no continuar con costos de la API.')
            break
        signature=tuple(key_url(a.get('href')) for card in cards for a in card.select('a[href*="/producto/"]')[:1])
        if signature in seen_signatures:
            print('Se detectó una página de catálogo repetida; deteniendo paginación.',flush=True)
            break
        seen_signatures.add(signature)
        for card in cards:
            visible=parse_card(card)
            original=by_url.get(key_url(visible.get('url_origen'))) or by_sku.get(str(visible.get('sku')))
            if not original:continue
            cost=visible.get('precio_transferencia_daz')
            if cost:
                original['precio_lista']=cost
                original['precio_transferencia_daz']=cost
                original['precio_efectivo']=visible.get('precio_efectivo')
                original['precio_efectivo_web']=visible.get('precio_efectivo_web')
                resolved.add(original['sku'])
        print(f'Página visible {page}: precios confirmados {len(resolved)}/{len(products)}',flush=True)
        if len(cards)<9:break
    # Algunos artículos no figuran en el listado: intentar su ficha individual.
    unresolved=[p for p in products if not p.get('precio_transferencia_daz')]
    if unresolved:
        print(f'{len(unresolved)} sin precio superior confirmado; consultando fichas individuales...',flush=True)
    for i,p in enumerate(unresolved,1):
        try:enrich(p)
        except Exception as e:print(f'Ficha sin precio verificado {p.get("sku")}: {e}',file=sys.stderr)
        if i%25==0:print(f'Fichas de precio: {i}/{len(unresolved)}',flush=True)
    return products

def html_export():
    out={}
    for page in range(1,101):
        u=f'{BASE}/productos/' if page==1 else f'{BASE}/productos/page/{page}/'
        soup=BeautifulSoup(fetch(u).text,'html.parser')
        cards=listing_cards(soup)
        if not cards:
            if page==1:raise RuntimeError('No se identificaron tarjetas HTML: revisar selectores o permisos del sitio.')
            break
        added=0
        for card in cards:
            p=parse_card(card); key=p['sku'] or p['url_origen']
            if not key:continue
            if key not in out:out[key]=p;added+=1
        print(f'Página {page}: {len(cards)} tarjetas, {len(out)} productos únicos',flush=True)
        if not added:break
        if len(cards)<9:break
    # Detalles individuales (más lento, pero obtiene descripciones y fotos en alta resolución).
    for n,p in enumerate(out.values(),1):
        try:enrich(p)
        except Exception as e:print(f'Ficha {n}: {e}',file=sys.stderr)
        if n%25==0: print(f'Fichas enriquecidas: {n}/{len(out)}',flush=True)
    return list(out.values())

def main():
    rp=RobotFileParser();rp.set_url(f'{BASE}/robots.txt')
    try: rp.read()
    except Exception: pass
    # Verificar reglas publicadas; si robots.txt no es accesible, no asumir autorización automática.
    if rp.mtime() and not rp.can_fetch(UA,f'{BASE}/productos/'):
        raise RuntimeError('robots.txt no permite recopilar esta ruta.')
    products=api_export()
    metodo='WooCommerce Store API'
    if products is None:
        print('API pública no disponible; recurriendo a HTML público.')
        products=html_export();metodo='HTML público'
    else:
        print('API pública disponible, verificando los DOS precios mostrados al cliente...')
        products=cross_prices_against_website(products)
        metodo='WooCommerce Store API + precios visibles HTML'
    without=sum(not p.get('precio_transferencia_daz') for p in products)
    if without:
        print(f'AVISO: {without} productos sin precio superior verificado: se excluirán de la tienda al importar.',file=sys.stderr)
    products=sorted(products,key=lambda p:(p.get('nombre') or '').casefold())
    categories=sorted(set(c for p in products for c in p['categorias']))
    result={'fuente':f'{BASE}/productos/','extraido_utc':datetime.now(timezone.utc).isoformat(),
            'metodo':metodo,'total':len(products),'categorias':categories,'productos':products}
    with open('daz_productos.json','w',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print(f'Guardado: daz_productos.json ({len(products)} productos; {len(categories)} categorías)')

if __name__=='__main__':main()

export const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export const money = value => ARS.format(Number(value || 0));
export const when = value => new Date(value).toLocaleString('es-AR', {dateStyle: 'medium', timeStyle: 'short'});
export const searchLink = p => p?.url_origen || `https://dazimportadora.com.ar/?s=${encodeURIComponent(p?.sku || p?.nombre || '')}&post_type=product`;
export const statusName = { pendiente:'Pendiente', en_preparacion:'En preparación', comprado:'Comprado en DAZ', entregado:'Entregado', cancelado:'Cancelado' };

export async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(`/api${url}`, { credentials: 'same-origin', headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...options.headers }, ...options });
  } catch { throw new Error('No se pudo conectar con el servidor. Verificá que esté iniciado.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}
export const patch = (url, data) => api(url, { method:'PATCH', body:JSON.stringify(data) });
export const post = (url, data) => api(url, { method:'POST', body:JSON.stringify(data) });

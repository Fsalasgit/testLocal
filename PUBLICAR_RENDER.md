# Publicar la tienda DAZ en Render (React + Vite + Node)

## Antes de publicar

1. Probá localmente con `npm install` y `npm run dev`. Visitá `http://localhost:5173` y `http://localhost:5173/admin`.
2. Importá tu `daz_productos.json` desde **Admin → Productos y precios → Importar JSON** (el archivo generado no se lee automáticamente desde la carpeta; la API lo guarda en `data/store.json`).
3. Probá un pedido con teléfono válido y marcá la casilla de consentimiento. Verificá que aparezca en **Admin → Pedidos**.
4. **Si ya cargaste productos o pedidos en tu PC, respaldá tu `data/store.json`**. En el primer despliegue, el servidor de Render creará uno nuevo en su disco persistente. Importá allí el JSON de productos nuevamente. Si ya usás Render, preservá el disco y `DATA_PATH` durante las actualizaciones: productos y pedidos NO deben reiniciarse. Para migrar también los pedidos existentes hay que copiar la base `store.json` al volumen del servidor antes de iniciar, evitando sobrescribir pedidos nuevos.
5. Confirmá con DAZ que podés republicar sus fotografías, fichas y precios.

## Paso a paso con Render

1. Creá un repositorio **privado** en GitHub. Subí el contenido de la carpeta `tienda-daz-rentabilidad` (no subas `.env`, `node_modules`, `data/store.json` ni datos de clientes). Con un repo privado también deberías evitar incluir credenciales en los archivos.
2. En [Render](https://dashboard.render.com/) elegí **New → Web Service**, conectá ese repositorio, **Language: Node**.
3. Configurá estos campos:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Health Check Path** (si lo ofrece): `/api/health`
   - **Instance/plan:** uno que permita **Persistent Disk** (Render no ofrece discos persistentes en el plan Free).
4. En **Environment Variables** agregá (valores como ejemplo, reemplazar):

   ```env
   NODE_ENV=production
   ADMIN_USER=admin
   ADMIN_PASSWORD=UNA_CONTRASENA_LARGA_Y_DISTINTA_DE_AMIN1
   SESSION_SECRET=UNA_CADENA_ALEATORIA_DE_AL_MENOS_32_CARACTERES
   DATA_PATH=/var/data/store.json
   IMAGE_CACHE_DIR=/var/data/images
   ```

   `SESSION_SECRET` debe ser secreta e impredecible. No configures `PORT` si Render ya lo inyecta.
5. Agregá un **Disk** con mount path **`/var/data`** y tamaño de acuerdo al catálogo; solo lo guardado bajo esa ruta sobrevive despliegues. Con las variables anteriores, allí se guardan los pedidos, configuraciones y fotos cacheadas.
6. Elegí **Deploy Web Service**. Render construye Vite y ejecuta la API Express; ambos se sirven con una sola URL HTTPS, por ejemplo `https://mi-tienda.onrender.com`.
7. Abrí `https://mi-tienda.onrender.com/api/health`. Debe responder `{"ok":true}`. Entrá a `/admin`, cargá el JSON real y configurá la TNA global (por defecto 0%). Hacé un pedido de prueba y confirmá que se vea en el panel.
8. En futuras actualizaciones usá GitHub + redeploy. **No reemplaces `DATA_PATH` ni borres el disco**. Exportá copias de seguridad periódicas del archivo de pedidos.

## Actualizar una instalación existente

Reemplazá los archivos del código fuente en el repositorio GitHub y hacé push para desplegar. **No sobreescribas ni borres el volumen persistente** (`/var/data/store.json`). En `/admin` configurá la TNA global y el redondeo a un importe elegido. Si venís de la versión anterior, el redondeo inicial es de $1.000 y el descuento por transferencia cambia de 5% a 10%. Los pedidos anteriores no se recalculan. Verificá los precios y hacé un pedido de prueba antes de aceptar operaciones reales.

## Fotografías

Al mostrarlas, el navegador consulta `/api/images/SKU`. El servidor intenta descargar el archivo **público** original y lo almacena en `IMAGE_CACHE_DIR`; si DAZ no responde, intenta redirigir a la imagen de origen. Al reimportar un producto con otra URL, el hash cambia y se consulta la foto nueva. La primera carga puede tardar. Si DAZ bloquea ambos accesos, necesitás fotos facilitadas/autorizadas por el proveedor u otro almacenamiento propio.

## Advertencias para operar en producción

- **No publiques como Static Site:** los pedidos necesitan el proceso Node activo.
- **El plan gratis con filesystem efímero no es adecuado:** perderías pedidos y tasas en un reinicio/actualización.
- El archivo JSON funciona con una única instancia de servidor. Si el negocio crece o hay mucho tráfico, reemplazalo por PostgreSQL u otra base de datos central.
- Comunicá una política de privacidad para el uso de teléfonos y una política comercial (stock/precio final/entrega).
- No uses las credenciales de prueba `admin / amin1` en producción.

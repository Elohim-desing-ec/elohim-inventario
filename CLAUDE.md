# ELOHIM · Inventario y ganancias — guía del proyecto

Panel interno de **ELOHIM** (marca ecuatoriana de ropa cristiana) para llevar inventario, ventas, gastos y ganancia neta mes a mes y año a año, con usuarios y contraseña. Lee esto antes de cambiar algo.

- **Página en vivo:** https://elohim-desing-ec.github.io/elohim-inventario/
- **Repositorio:** https://github.com/Elohim-desing-ec/elohim-inventario (público; la carpeta local es `~/Desktop/INVENTARIO/web`, rama `main`)
- **Base de datos:** Supabase, proyecto `elohim-inventario`, id `kucrypxgjptsdjxsmvce`, organización **Elohim-webs** (`hjnskgcglmqidoxrfkns`), región us-east-1, plan gratis
- **Dueño:** Eduardo Lara, administrador de la app. Habla español; todo lo que ve el usuario va en español, con dinero en dólares `$0.00` y porcentajes con 1 decimal.

## Cómo está hecho

Página estática (HTML + CSS + JavaScript sin frameworks ni compilación) publicada con GitHub Pages, más Supabase para inicio de sesión y datos compartidos.

- **El HTML tiene la estructura fija** de cada sección (formularios, tarjetas, contenedores vacíos con `id`). El JS solo llena tablas, números y listas.
- **Todo el JS cuelga del objeto global `E`**, en scripts clásicos (no módulos, para que también abra con doble clic). El orden de los `<script>` en `index.html` importa.
- Cada sección tiene `E.views.<sección> = { init(), render() }`. `E.render()` (en `app.js`) recalcula con `E.derive()` y dibuja solo la sección visible.
- Los botones usan `data-act="nombre"` y un solo manejador en `app.js` llama a `E.acts.nombre(boton, evento)`. Cada sección registra sus acciones.
- La navegación va por hash: `#resumen`, `#inventario`, `#ventas`, `#gastos`, `#datos`, `#usuarios` (este último solo para administradores).

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Todas las secciones, el inicio de sesión, las ventanas (`dialog`) y el orden de carga. Cada CSS/JS lleva `?v=AAAAMMDD-N` |
| `css/variables.css` | Colores y letras de la marca (tema claro, y oscuro con `prefers-color-scheme` y `[data-theme]`) |
| `css/base.css` | Reset, tipografía, `.container`, `.eyebrow`, `[hidden]` |
| `css/layout.css` | Header tipo píldora de vidrio, menú de usuario (círculo con iniciales), barra inferior del celular, pantalla de inicio de sesión |
| `css/components.css` | Botones, campos, tarjetas, pills de estado, tablas ordenables (en el celular cada fila es una tarjeta), ventanas, toast y el bloque final de **celular: formularios en una columna** |
| `css/secciones.css` | Banda azul del Resumen, KPIs, comparaciones, gráfico, recibo de venta, filas de prendas, chips de clientes, barras de gastos |
| `css/vidrio.css` | **Efecto vidrio** copiado de la tienda (tokens `--vidrio-*`). Se carga al final y sobreescribe |
| `js/config.js` | Listas fijas: meses, canales, estados, categorías de gasto, tipos de prenda iniciales, tallas, `STOCK_BAJO = 3`, `ANIO_INICIO = 2027` |
| `js/nube-config.js` | URL y clave **anon** (pública a propósito) de Supabase y el dominio de los usuarios. Con `url: ""` la app guarda solo en el navegador (útil para probar) |
| `js/utilidades.js` | Formato (`E.money`, `E.pct`, `E.fdate`…), `E.fillSelect`, errores de formulario, `E.toast`, `E.ask` (confirmación propia; no usar `confirm()`), `E.saveFile`, `E.table` (tabla ordenable genérica) |
| `js/guardado.js` | Guardado automático. `E.S` = datos en memoria; `E.put(col, id, data)` y `E.del(col, id)` guardan. Elige el modo: **supabase** → **archivo** (Python) → **local** (localStorage). Escucha cambios en vivo y relee todo cada 2 minutos |
| `js/calculos.js` | Fórmulas: `E.derive()` arma `E.D` (ventas con totales, prendas con stock, gastos); `E.agg(año, mes)` (mes `-1` = año completo); `E.aggDay`; `E.years()` |
| `js/acceso.js` | Inicio de sesión. La primera vez pide crear al administrador. Usuario sin `@` → correo interno `usuario@elohim-inventario.app`. `E.llamarUsuarios(accion, datos)` llama a la función del servidor |
| `js/resumen.js` | Tarjetas, stock de hoy, comparación con el mes anterior y con el mismo mes del año pasado, gráfico SVG, tabla mes a mes, **Cerrar mes / Cerrar año** (guarda ventas, ganancia **y foto del inventario**), historial de cierres |
| `js/inventario.js` | Agregar o editar prendas (código único), **Agregar precio** con calculadora (precio = costo ÷ (1 − margen)), reponer stock, tipos de prenda, filtros y resumen por tipo |
| `js/ventas.js` | Venta con **varias prendas** (filas en `#vLineas`), "Otra prenda (no está en inventario)", recibo en vivo, Hoy, **Clientes** (chips amarillos), tabla, editar o eliminar la venta completa o una prenda |
| `js/gastos.js` | Agregar o editar gastos, barras por categoría y tabla |
| `js/datos.js` | Exportar e importar respaldo JSON, Excel (SheetJS desde cdnjs, se carga al pulsar), CSV, Borrar todo |
| `js/usuarios.js` | Solo administrador: crear usuario, cambiar rol o contraseña, activar o desactivar, eliminar |
| `js/app.js` | Navegación, `E.render`, botones `data-act`, menú de usuario, tema claro/oscuro, aviso con **Recargar** si algo falla al cargar |
| `servidor.py` | Opcional, solo biblioteca estándar. Sirve la app en local y guarda en `datos/` (ignorada por git). Reportes: `python3 servidor.py --reporte 2027 [mes] --archivo respaldo.json` y `--stock` |
| `Abrir inventario.command` | Doble clic en Mac: abre `servidor.py` |

## Datos

Todo está en **una tabla**, `public.registros (coleccion, id, data jsonb, actualizado, actualizado_por)`, con clave `(coleccion, id)`. `coleccion` puede ser:

- `items`: prendas, con `{codigo, tipo, coleccion, talla, color, costo, precio, stockInicial, reposiciones:[{fecha, cantidad, nota}], creado}`
- `ventas`: **una fila por prenda vendida**, con `{fecha, pedido, linea, codigo, libre, prenda, cantidad, precio, costo, descuento, canal, estado, cliente, creado}`
  - Las prendas de la misma venta comparten `pedido`.
  - El descuento total va en la `linea` 0.
  - `libre: true` y `codigo: ""` = prenda fuera del inventario.
  - `costo` es el costo unitario **al momento de vender**.
- `gastos`: `{fecha, concepto, categoria, monto, nota}`
- `cierres`: id `AAAA-MM` o `AAAA-anual`, con `{anio, mes (-1 = año), ventas, costo, bruta, gastos, neta, margen, unidades, stockUnidades, stockValor, inventario:[…], cerradoEl}`
- `config`: id `main`, con `{tipos:[…]}`

Las fechas se guardan como `AAAA-MM-DD`.

**Reglas de cálculo:**
- Total = cantidad × precio − descuento; costo = cantidad × costo.
- Stock = stock inicial + repuesto − vendidas.
- Estado: Agotado si el stock es ≤ 0, Stock bajo si es ≤ 3, OK en los demás casos.
- Las ventas **Canceladas nunca cuentan**.

**Usuarios:** `public.perfiles (id → auth.users, usuario, nombre, rol 'admin'|'empleado', activo)`.
- Empleado: todo menos manejar usuarios.
- Desactivar = `ban` en Auth + `activo=false`.
- Siempre debe quedar al menos un administrador activo.

**Seguridad (RLS):**
- `registros`: leer y escribir solo con `es_usuario_activo()`.
- `perfiles`: cada uno lee el suyo, y el admin lee todos.
- Nadie escribe `perfiles` desde el navegador; solo la Edge Function.
- `anon` no tiene permisos. `registros` está en `supabase_realtime` (cambios en vivo).

**Edge Function `usuarios`** (con `verify_jwt=false`; revisa el token ella misma):
- Acciones públicas: `estado` e `inicializar` (esta solo funciona si no existe ningún perfil).
- Solo administrador: `listar`, `crear`, `actualizar` y `eliminar`.
- Usa `SUPABASE_SERVICE_ROLE_KEY`, que pone el entorno; nunca va en el código.

## Cómo publicar un cambio

1. Edita los archivos en `~/Desktop/INVENTARIO/web`.
2. **Sube el número de versión `?v=` de todos los CSS/JS en `index.html`**, por ejemplo `20261104-4` → `20261105-1`. Si no, GitHub Pages (que guarda caché 10 minutos) mezcla archivos viejos con nuevos, y la app se quedó en "cargando" por eso.
3. Revisa la sintaxis: `for f in js/*.js; do node --check "$f"; done` (y `python3 -m py_compile servidor.py`).
4. `git add -A && git commit && git push`. GitHub Pages publica en 1 o 2 minutos; revisa con `gh api repos/Elohim-desing-ec/elohim-inventario/pages/builds/latest`.
5. Cambios de base de datos: con `apply_migration` en Supabase y después `get_advisors` (security).

## Cómo probar sin tocar los datos reales

- **Nunca uses la base real ni la carpeta `datos/` para pruebas.** Copia `index.html css js assets` a una carpeta temporal y pon `url: ""` en su `js/nube-config.js`. Así guarda solo en el navegador. Sírvela con `python3 -m http.server` y pruébala con Playwright.
- Para probar lo que pasa **después de iniciar sesión** sin contraseña real: intercepta `https://kucrypxgjptsdjxsmvce.supabase.co/**` con `page.route` y responde `auth/v1/token`, `auth/v1/user`, `rest/v1/perfiles`, `rest/v1/registros` y `functions/v1/usuarios` (`estado`, `listar`).
- Revisa siempre en celular, con 375 a 390 px de ancho: que no haya scroll lateral y que nada se encime. En los iPhone, la fecha y las listas desplegables ocupan más ancho, así que en celular los formularios van en una columna.
- Borrar datos o usuarios en Supabase con SQL pide la confirmación del usuario. Si se rechaza, no lo fuerces: dale el SQL para que lo ejecute en el panel (SQL Editor).

## Diseño

Es la misma identidad que la tienda https://elohim-desing-ec.github.io/elohim-webstore/:
- Colores: azul noche `#00072d`, `#051650`, `#0a2472`, azul acción `#1336f0` y `#5b7cff`, fondo claro `#f3f5fc`.
- Letras: **Montserrat** para todo y **Playfair Display** en itálica para la palabra de acento (`<span class="serif">`).
- Efecto vidrio: blur 22px saturate 180%, borde blanco translúcido y brillo `inset`.
- Botones en mayúsculas con espaciado, y un relleno que sube al pasar el mouse.
- Header: píldora azul de vidrio con 4 enlaces. Datos y respaldos, Usuarios y Salir van en el menú del círculo con iniciales.
- Colores del gráfico, validados para daltonismo: ventas `#1336f0` / oscuro `#5b7cff`; ganancia neta `#0f8f6f` / oscuro `#1fa57e`.
- El logo es `assets/img/logo-blanco.png`, copiado de la tienda. No lo redibujes.

## A tener en cuenta

- **Plan gratis de Supabase:** se pausa tras 7 días sin uso (se reactiva en el panel) y no tiene copias automáticas. Recomienda "Exportar respaldo" cada mes. Pro cuesta unos $25 al mes, en https://supabase.com/dashboard/org/hjnskgcglmqidoxrfkns/billing
- La clave anon de `nube-config.js` es pública a propósito; la protección está en RLS. **Nunca pongas la service role key en el repositorio.**
- `datos/` (los datos del modo Python) está en `.gitignore`. No lo subas.
- Ya no hay datos de ejemplo. `E.countExamples` y la purga de `ejemplo: true` solo limpian restos de versiones viejas.
- Supabase sugiere activar la protección contra contraseñas filtradas (en el panel de Auth). Está pendiente.

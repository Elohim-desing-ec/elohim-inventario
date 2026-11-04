# ELOHIM · Inventario y ganancias

Panel interno de ELOHIM para llevar el inventario, las ventas, los gastos y la ganancia neta, mes a mes y año a año.

**Página:** https://elohim-desing-ec.github.io/elohim-inventario/

## Cómo entrar

- Cada persona entra con **su usuario y su contraseña**.
- La primera vez que se abre, la app pide crear la cuenta del **administrador**.
- El administrador crea los usuarios de su equipo en la sección **Usuarios** y les pasa su usuario y contraseña.
  - **Administrador:** puede todo, incluido crear, desactivar y borrar usuarios.
  - **Empleado:** puede todo menos manejar usuarios.

## Dónde se guardan los datos

En la nube (Supabase), protegidos: sin iniciar sesión nadie puede leerlos. Este repositorio solo tiene el código de la página, **nunca los datos**. Todo se guarda solo con cada cambio, y lo que registra una persona lo ven las demás al instante.

Para tener una copia propia: **Datos → Exportar respaldo** (archivo JSON) o **Exportar a Excel**.

## Archivos

| Carpeta / archivo | Qué es |
| --- | --- |
| `index.html` | La página y sus secciones: Resumen, Inventario, Ventas, Gastos, Datos, Usuarios |
| `css/` | Diseño: `variables.css` (colores y letras), `base.css`, `layout.css`, `components.css`, `secciones.css` |
| `js/` | Funciones: un archivo por sección, más `calculos.js` (fórmulas), `guardado.js`, `acceso.js` (inicio de sesión) y `nube-config.js` (conexión a Supabase) |
| `servidor.py` | Programa de Python opcional para reportes en la Terminal |
| `assets/img/` | Logo e ícono |

## Reportes con Python (opcional)

Exporta un respaldo desde la app y en la Terminal escribe:

```
python3 servidor.py --reporte 2027 --archivo elohim-respaldo-AAAA-MM-DD.json
python3 servidor.py --reporte 2027 1 --archivo elohim-respaldo-AAAA-MM-DD.json   # solo enero
python3 servidor.py --stock --archivo elohim-respaldo-AAAA-MM-DD.json
```

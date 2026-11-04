/* =========================================================
   ELOHIM INVENTARIO · SECCIÓN 5: DATOS
   Exportar / importar respaldo (JSON), Excel, CSV y
   borrar datos de ejemplo.
   ========================================================= */
(function () {
  "use strict";
  const { $, esc, r2, fdate, MESES } = E;
  E.views = E.views || {}; E.acts = E.acts || {};

  /* ---------- Tablas para exportar ---------- */
  const byCode = (a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true });
  const byDate = (a, b) => String(a.fecha).localeCompare(String(b.fecha));
  const rowsInventario = () => [["Código", "Prenda", "Colección", "Talla", "Color", "Costo unitario", "Precio de venta", "Stock inicial", "Repuesto", "Vendidas", "Stock actual", "Ganancia por unidad", "Margen %", "Valor del stock", "Estado"]]
    .concat(E.D.items.slice().sort(byCode).map(i => [i.codigo, i.tipo, i.coleccion, i.talla, i.color, i.costo, i.precio, i.stockInicial, i.repuesto, i.vendidas, i.stock, i.gu, r2(i.margen * 1000) / 10, i.valor, i.estado]));
  const rowsVentas = () => [["Fecha", "Código", "Prenda", "Cantidad", "Precio unitario", "Descuento", "Total venta", "Costo total", "Ganancia", "Canal", "Estado", "Cliente"]]
    .concat(E.D.sales.slice().sort(byDate).map(s => [s.fecha, s.codigo, s.prendaTxt, s.cantidad, s.precio, s.descuento, s.total, s.costoTotal, s.ganancia, s.canal, s.estado, s.cliente || ""]));
  const rowsGastos = () => [["Fecha", "Concepto", "Categoría", "Monto", "Nota"]]
    .concat(E.D.gastos.slice().sort(byDate).map(g => [g.fecha, g.concepto, g.categoria, g.monto, g.nota || ""]));
  const rowsMeses = y => {
    const rows = [["Mes", "Ventas", "Costo", "Ganancia bruta", "Gastos", "Ganancia neta", "Margen neto %", "Unidades"]];
    MESES.forEach((m, i) => { const a = E.agg(y, i); rows.push([m, a.ventas, a.costo, a.bruta, a.gastos, a.neta, r2(a.margen * 1000) / 10, a.unidades]); });
    const t = E.agg(y, -1); rows.push(["Total " + y, t.ventas, t.costo, t.bruta, t.gastos, t.neta, r2(t.margen * 1000) / 10, t.unidades]);
    return rows;
  };
  const toCSV = rows => "﻿" + rows.map(r => r.map(v => { const s = v == null ? "" : String(v); return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(",")).join("\r\n");

  function loadXLSX() {
    return new Promise((res, rej) => {
      if (window.XLSX) return res(window.XLSX);
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      sc.onload = () => res(window.XLSX); sc.onerror = rej; document.head.appendChild(sc);
    });
  }

  /* ---------- Importar ---------- */
  async function importFile(file) {
    let o; try { o = JSON.parse(await file.text()); } catch (e) { E.toast("Ese archivo no es un respaldo válido.", true); return; }
    const data = o && o.data;
    if (!data || typeof data !== "object" || !["items", "ventas", "gastos"].some(k => data[k] && typeof data[k] === "object")) { E.toast("Ese archivo no parece un respaldo de esta app.", true); return; }
    const cnt = k => data[k] && typeof data[k] === "object" ? Object.keys(data[k]).length : 0;
    const choice = await E.ask("Importar respaldo",
      `El archivo trae ${cnt("items")} prendas, ${cnt("ventas")} ventas, ${cnt("gastos")} gastos y ${cnt("cierres")} cierres${o.exportado ? `, exportado el ${fdate(o.exportado)}` : ""}.<br><br><b>Combinar</b> agrega lo del archivo y actualiza los registros repetidos. <b>Reemplazar todo</b> borra lo que tienes ahora y deja solo lo del archivo.`,
      [{ l: "Combinar", v: "combinar", cls: "btn--outline" }, { l: "Reemplazar todo", v: "reemplazar", cls: "btn--danger" }]);
    if (!choice) return;
    const ops = [];
    if (choice === "reemplazar") E.COLECCIONES.forEach(c => Object.keys(E.S[c]).forEach(id => { if (!(data[c] && data[c][id])) ops.push(["del", c, id]); }));
    E.COLECCIONES.forEach(c => { if (data[c] && typeof data[c] === "object") Object.entries(data[c]).forEach(([id, doc]) => { if (doc && typeof doc === "object" && /^[A-Za-z0-9_\-.~:@+]{1,200}$/.test(id)) ops.push(["put", c, id, doc]); }); });
    let i = 0;
    for (const op of ops) { i++; if (i % 10 === 0) E.toast(`Importando ${i} de ${ops.length}…`); if (op[0] === "del") await E.del(op[1], op[2]); else await E.put(op[1], op[2], op[3]); }
    E.UI.year = null;
    E.toast(`Respaldo importado: ${ops.length} cambios`);
  }

  /* Compara los totales del año calculados por Python (servidor.py) con los de la app */
  async function checkPython() {
    const card = $("#datPython");
    card.hidden = E.Store.mode !== "archivo";
    if (card.hidden) return;
    const y = E.UI.year || E.ANIO_INICIO;
    try {
      const r = await fetch(`api/resumen?anio=${y}`, { cache: "no-store" });
      const p = (await r.json()).total, a = E.agg(y, -1);
      const same = ["ventas", "costo", "gastos", "neta", "unidades"].every(k => Math.abs(p[k] - a[k]) < 0.005);
      $("#datPythonRes").innerHTML = `<b>Año ${y}</b> · Ventas ${E.money(p.ventas)} · Costo ${E.money(p.costo)} · Gastos ${E.money(p.gastos)} · Ganancia neta ${E.money(p.neta)} · ${E.int(p.unidades)} unidades<br>` +
        (same ? `<span class="pill pill--ok">Coincide con la app</span>` : `<span class="pill pill--warn">No coincide: recarga la página</span>`) +
        `<br><br>En la Terminal también puedes escribir <code>python3 servidor.py --reporte ${y}</code> para ver el mes a mes.`;
    } catch (e) { $("#datPythonRes").textContent = "No se pudo consultar a Python. ¿Está abierta la ventana del inventario?"; }
  }

  E.views.datos = {
    init() {
      $("#archivoRespaldo").addEventListener("change", e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ""; });
    },
    render() {
      $("#datModo").textContent = {
        supabase: "Cada cambio se guarda solo en la nube, protegido con usuario y contraseña. Tú y las personas que trabajan contigo ven los mismos datos al instante, en el celular o en la computadora.",
        archivo: `Cada cambio se guarda solo en un archivo de tu computadora (${E.Store.archivo || "datos/elohim-datos.json"}), y el programa de Python guarda una copia de seguridad cada día en datos/respaldos.`,
        local: "Cada cambio se guarda solo en este navegador y sigue ahí al cerrar y volver a abrir. Para guardarlo en un archivo de tu computadora, abre la app con «Abrir inventario» (el programa de Python)."
      }[E.Store.mode] || "";
      $("#datConteo").textContent = `${E.D.items.length} prendas · ${E.D.sales.length} ventas · ${E.D.gastos.length} gastos · ${Object.keys(E.S.cierres).length} meses cerrados`;
      checkPython();
      $("#btnBorrarTodo").disabled = !(E.D.items.length || E.D.sales.length || E.D.gastos.length || Object.keys(E.S.cierres).length);
    }
  };

  E.acts.exportarJSON = () => E.saveFile(`elohim-respaldo-${E.today()}.json`, JSON.stringify({ app: "elohim-inventario", version: 1, exportado: new Date().toISOString(), data: E.S }, null, 1));
  E.acts.importarJSON = () => $("#archivoRespaldo").click();
  E.acts.exportarCSV = b => { const k = b.dataset.k; E.saveFile(`elohim-${k}-${E.today()}.csv`, toCSV(k === "ventas" ? rowsVentas() : k === "gastos" ? rowsGastos() : rowsInventario())); };
  E.acts.exportarExcel = async () => {
    E.toast("Preparando el archivo de Excel…");
    let X; try { X = await loadXLSX(); } catch (e) { E.toast("No se pudo cargar el generador de Excel. Usa los CSV.", true); return; }
    const y = E.UI.year || new Date().getFullYear(), wb = X.utils.book_new();
    const rowsCierres = [["Periodo", "Ventas", "Costo", "Gastos", "Ganancia neta", "Prendas vendidas", "Stock al cierre", "Valor del stock", "Cerrado el"]]
      .concat(Object.values(E.S.cierres).sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes)).map(c => [c.mes < 0 ? "Año " + c.anio : MESES[c.mes] + " " + c.anio, c.ventas, c.costo, c.gastos, c.neta, c.unidades, c.stockUnidades == null ? "" : c.stockUnidades, c.stockValor == null ? "" : c.stockValor, String(c.cerradoEl || "").slice(0, 10)]));
    [["Inventario", rowsInventario()], ["Ventas", rowsVentas()], ["Gastos", rowsGastos()], ["Resumen " + y, rowsMeses(y)], ["Cierres", rowsCierres]].forEach(([name, rows]) => {
      const ws = X.utils.aoa_to_sheet(rows);
      ws["!cols"] = rows[0].map((h, i) => ({ wch: Math.max(10, ...rows.map(r => String(r[i] == null ? "" : r[i]).length)) + 2 }));
      X.utils.book_append_sheet(wb, ws, name);
    });
    await E.saveFile(`elohim-${E.today()}.xlsx`, new Uint8Array(X.write(wb, { bookType: "xlsx", type: "array" })));
  };
  E.acts.borrarTodo = async () => {
    const ok = await E.ask("Borrar todo",
      `Se borrarán <b>${E.D.items.length} prendas, ${E.D.sales.length} ventas, ${E.D.gastos.length} gastos y ${Object.keys(E.S.cierres).length} cierres</b>. Esto no se puede deshacer.<br><br>Si quieres conservar una copia, cancela y pulsa primero «Exportar respaldo».`,
      [{ l: "Sí, borrar todo", v: "si", cls: "btn--danger" }]);
    if (!ok) return;
    await E.borrarTodo();
    E.UI.year = null;
    E.toast("Listo: todo en cero");
  };
})();

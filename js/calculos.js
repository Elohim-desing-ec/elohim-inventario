/* =========================================================
   ELOHIM INVENTARIO · CÁLCULOS
   Todas las fórmulas en un solo lugar:
   stock, ganancias, márgenes y resúmenes por mes o año.
   Las ventas "Cancelado" nunca cuentan.
   ========================================================= */
(function () {
  "use strict";
  const { n, r2, sum, yearOf, monthOf } = E;

  E.tipos = () => {
    const t = E.S.config.main && Array.isArray(E.S.config.main.tipos) ? E.S.config.main.tipos : null;
    return t && t.length ? t : E.TIPOS_INICIO;
  };

  /* Calcula todo a partir de los registros guardados → E.D */
  E.derive = () => {
    const vendidas = {};
    const sales = Object.entries(E.S.ventas).map(([id, v]) => {
      const cantidad = n(v.cantidad), precio = n(v.precio), descuento = n(v.descuento), costoU = n(v.costo);
      const total = r2(cantidad * precio - descuento);        // Total venta = cantidad × precio − descuento
      const costoTotal = r2(cantidad * costoU);               // Costo total = cantidad × costo unitario
      const s = Object.assign({}, v, { id, cantidad, precio, descuento, costoU, total, costoTotal, ganancia: r2(total - costoTotal), activa: v.estado !== "Cancelado" });
      if (s.activa) vendidas[s.codigo] = (vendidas[s.codigo] || 0) + cantidad;
      return s;
    });

    const codeMap = {};
    const items = Object.entries(E.S.items).map(([id, it]) => {
      const costo = n(it.costo), precio = n(it.precio), stockInicial = n(it.stockInicial);
      const repuesto = sum(it.reposiciones || [], x => n(x.cantidad));
      const vend = vendidas[it.codigo] || 0;
      const stock = stockInicial + repuesto - vend;           // Stock actual = inicial + repuesto − vendidas
      const gu = r2(precio - costo);                          // Ganancia por unidad
      const o = Object.assign({}, it, {
        id, costo, precio, stockInicial, repuesto, vendidas: vend, stock, gu,
        margen: precio ? gu / precio : 0,                     // Margen % = ganancia ÷ precio
        valor: r2(Math.max(stock, 0) * costo),                // Valor del stock
        estado: stock <= 0 ? "Agotado" : stock <= E.STOCK_BAJO ? "Stock bajo" : "OK",
        ganGen: r2(vend * gu)
      });
      codeMap[it.codigo] = o;
      return o;
    });

    sales.forEach(s => {
      const it = codeMap[s.codigo];
      s.prendaTxt = it ? [it.tipo, it.talla, it.color].filter(Boolean).join(" · ") : (s.prenda || "No está en inventario");
    });
    const gastos = Object.entries(E.S.gastos).map(([id, g]) => Object.assign({}, g, { id, monto: r2(n(g.monto)) }));
    E.D = { sales, items, codeMap, gastos };
    return E.D;
  };

  /* Resumen de un periodo: month = -1 para todo el año */
  E.agg = (year, month) => {
    const inP = f => yearOf(f) === year && (month < 0 || monthOf(f) === month);
    const ss = E.D.sales.filter(s => s.activa && inP(s.fecha));
    const ventas = r2(sum(ss, s => s.total));
    const costo = r2(sum(ss, s => s.costoTotal));
    const gastos = r2(sum(E.D.gastos.filter(g => inP(g.fecha)), g => g.monto));
    const bruta = r2(ventas - costo), neta = r2(bruta - gastos);
    return { ventas, costo, bruta, gastos, neta, margen: ventas ? neta / ventas : 0, unidades: sum(ss, s => s.cantidad) };
  };

  /* Resumen de un día (para "Hoy") */
  E.aggDay = day => {
    const ss = E.D.sales.filter(s => s.activa && s.fecha === day);
    return { total: r2(sum(ss, s => s.total)), ganancia: r2(sum(ss, s => s.ganancia)), unidades: sum(ss, s => s.cantidad), registros: new Set(ss.map(s => s.pedido || s.id)).size };
  };

  /* Años del selector: desde 2027 (o el año más viejo con datos) hasta
     al menos 2031, y sigue creciendo con el tiempo */
  E.years = () => {
    const cy = new Date().getFullYear(), ys = [E.ANIO_INICIO, cy + 1, E.ANIO_INICIO + 4];
    E.D.sales.forEach(s => s.fecha && ys.push(yearOf(s.fecha)));
    E.D.gastos.forEach(g => g.fecha && ys.push(yearOf(g.fecha)));
    Object.values(E.S.cierres).forEach(c => c.anio && ys.push(c.anio));
    const ok = ys.filter(y => y > 1900 && y < 3000), lo = Math.min(...ok), hi = Math.max(...ok), out = [];
    for (let y = lo; y <= hi; y++) out.push(y);
    return out;
  };

  E.countExamples = () => ["items", "ventas", "gastos"].reduce((t, c) => t + Object.values(E.S[c]).filter(x => x && x.ejemplo).length, 0);
})();

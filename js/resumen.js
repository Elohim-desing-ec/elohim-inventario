/* =========================================================
   ELOHIM INVENTARIO · SECCIÓN 1: RESUMEN
   Tarjetas del periodo, stock de hoy, comparaciones,
   gráfico mes a mes, cierre de mes e historial de cierres.
   ========================================================= */
(function () {
  "use strict";
  const { $, esc, money, pct, int, pad, sum, n, fdate, MESES, MES_CORTO } = E;
  E.views = E.views || {}; E.acts = E.acts || {};
  const UI = E.UI = E.UI || {};
  UI.year = null; UI.month = null;
  let chartRows = null;

  const nombreCierre = c => c.mes < 0 ? `Año ${c.anio}` : `${MESES[c.mes]} ${c.anio}`;
  const cierreId = (y, m) => m < 0 ? `${y}-anual` : `${y}-${pad(m + 1)}`;

  const setK = (root, key, value, cls) => {
    E.$$(`[data-v="${key}"]`, root).forEach(el => { el.textContent = value; if (cls !== undefined) el.classList.toggle(cls[0], !!cls[1]); });
  };

  function pickDefaultPeriod() {
    if (UI.year !== null) return;
    const now = new Date(), cy = now.getFullYear();
    const has = y => E.D.sales.some(s => E.yearOf(s.fecha) === y) || E.D.gastos.some(g => E.yearOf(g.fecha) === y);
    if (has(cy)) { UI.year = cy; UI.month = now.getMonth(); return; }
    const ys = E.years().filter(has);
    if (ys.length) { UI.year = ys[ys.length - 1]; UI.month = -1; return; }
    // Sin datos todavía: abre en el año de inicio (2027), todo el año
    UI.year = Math.max(cy, E.ANIO_INICIO); UI.month = UI.year === cy ? now.getMonth() : -1;
  }

  function delta(cur, prev, isMoney) {
    const d = cur - prev;
    if (Math.abs(d) < 0.005) return `<span class="delta delta--flat">Igual</span>`;
    const p = prev !== 0 ? d / Math.abs(prev) : null;
    const abs = isMoney ? money(Math.abs(d)) : int(Math.abs(d));
    return `<span class="delta ${d > 0 ? "delta--up" : "delta--down"}" title="${d > 0 ? "+" : "−"}${abs}">${d > 0 ? "▲ " : "▼ "}${p != null ? Math.abs(p * 100).toFixed(1) + "%" : abs}</span>`;
  }
  function compareCard(title, cur, prev) {
    const rows = [["Ventas", "ventas", true], ["Ganancia neta", "neta", true], ["Unidades", "unidades", false]];
    return `<div class="compare__card"><span class="eyebrow">${esc(title)}</span>` + rows.map(([l, k, m]) =>
      `<div class="compare__row"><span>${l}<span class="sub">antes ${m ? money(prev[k]) : int(prev[k])}</span></span><b class="tnum">${m ? money(cur[k]) : int(cur[k])}</b>${delta(cur[k], prev[k], m)}</div>`).join("") + `</div>`;
  }

  E.views.resumen = {
    init() {
      $("#rsYear").addEventListener("change", e => { UI.year = +e.target.value; E.render(); });
      $("#rsMonth").addEventListener("change", e => { UI.month = +e.target.value; E.render(); });
      E.fillSelect($("#rsMonth"), [{ v: -1, l: "Todo el año" }].concat(MESES.map((m, i) => ({ v: i, l: m }))));
      // Gráfico: tocar un mes lo selecciona; pasar el mouse muestra el detalle
      $("#rsChart").addEventListener("click", e => { const h = e.target.closest(".hit"); if (h) { UI.month = +h.dataset.i; E.render(); } });
      $("#rsChart").addEventListener("pointermove", e => { const h = e.target.closest(".hit"); if (h) showTip(+h.dataset.i, e); else $("#rsTip").hidden = true; });
      $("#rsChart").addEventListener("pointerleave", () => { $("#rsTip").hidden = true; });
      let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (E.currentPage() === "resumen" && E.ready()) drawChart(); }, 150); });
    },

    render() {
      pickDefaultPeriod();
      const root = $("#resumen"), y = UI.year, m = UI.month, a = E.agg(y, m);
      E.fillSelect($("#rsYear"), E.years(), null, y);
      $("#rsMonth").value = String(m);
      const periodo = m < 0 ? `Todo ${y}` : `${MESES[m]} ${y}`;

      setK(root, "periodo", periodo);
      setK(root, "neta", money(a.neta)); root.querySelector('[data-v="neta"]').classList.toggle("is-neg", a.neta < 0);
      root.querySelector('[data-v="netaNota"]').innerHTML = `Ganancia bruta <b>${money(a.bruta)}</b> menos gastos <b>${money(a.gastos)}</b>`;
      setK(root, "ventas", money(a.ventas));
      setK(root, "costo", money(a.costo));
      setK(root, "bruta", money(a.bruta), ["neg", a.bruta < 0]);
      setK(root, "gastos", money(a.gastos));
      setK(root, "margen", pct(a.margen), ["neg", a.margen < 0]);
      setK(root, "unidades", int(a.unidades));
      setK(root, "anio", String(y));

      // Stock hoy
      const D = E.D, bajos = D.items.filter(i => i.estado !== "OK"), agot = bajos.filter(i => i.estado === "Agotado").length;
      setK(root, "stockU", int(sum(D.items, i => Math.max(i.stock, 0))));
      setK(root, "modelos", `${D.items.length} modelos registrados`);
      setK(root, "stockV", money(sum(D.items, i => i.valor)));
      setK(root, "bajos", String(bajos.length), ["neg", bajos.length > 0]);
      root.querySelector('[data-v="bajosNota"]').innerHTML = bajos.length
        ? `${agot} agotadas · ${bajos.length - agot} con ${E.STOCK_BAJO} o menos · <a href="#inventario" data-act="verStockBajo">Ver</a>`
        : "Todo con stock suficiente";

      // Cerrar mes
      const cid = cierreId(y, m), cierre = E.S.cierres[cid];
      const btn = $("#rsCerrar");
      btn.disabled = E.Store.readOnly;
      btn.textContent = m < 0 ? (cierre ? "Actualizar cierre del año" : "Cerrar año") : (cierre ? "Actualizar cierre" : "Cerrar mes");
      btn.title = "";
      $("#rsAvisoCierre").innerHTML = cierre
        ? `<div class="notice ${Math.abs(cierre.neta - a.neta) >= 0.005 || cierre.unidades !== a.unidades ? "notice--warn" : "notice--ok"}">${nombreCierre(cierre)} se cerró el ${fdate(cierre.cerradoEl)}${cierre.stockUnidades != null ? `, con ${int(cierre.stockUnidades)} prendas en stock (${money(cierre.stockValor)})` : ""}. ` +
          (Math.abs(cierre.neta - a.neta) >= 0.005 || cierre.unidades !== a.unidades
            ? `Hubo cambios después del cierre: ganancia neta guardada ${money(cierre.neta)}, actual ${money(a.neta)}.`
            : "Los números actuales coinciden con el cierre.") + `</div>`
        : "";

      // Comparaciones
      let cards;
      if (m < 0) cards = compareCard(`Contra todo ${y - 1}`, a, E.agg(y - 1, -1));
      else {
        const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
        cards = compareCard(`Mes anterior · ${MESES[pm]} ${py}`, a, E.agg(py, pm)) + compareCard(`Mismo mes del año pasado · ${MESES[m]} ${y - 1}`, a, E.agg(y - 1, m));
      }
      $("#rsCompare").innerHTML = cards;

      // Tabla mes a mes
      const rows = MESES.map((mes, i) => Object.assign({ m: i, mes, cierre: E.S.cierres[`${y}-${pad(i + 1)}`] }, E.agg(y, i)));
      const tot = E.agg(y, -1);
      const cols = [
        { key: "m", label: "Mes", cls: "cell-head", html: r => `<b>${r.mes}</b>${r.cierre ? ` <span class="pill pill--accent">Cerrado</span>` : ""}` },
        { key: "ventas", label: "Ventas", num: true, html: r => money(r.ventas) },
        { key: "costo", label: "Costo", num: true, cls: "hide-mobile", html: r => money(r.costo) },
        { key: "gastos", label: "Gastos", num: true, cls: "hide-mobile", html: r => money(r.gastos) },
        { key: "neta", label: "Ganancia neta", num: true, html: r => `<b class="${r.neta < 0 ? "neg" : ""}">${money(r.neta)}</b>` },
        { key: "unidades", label: "Unidades", num: true, html: r => int(r.unidades) }
      ];
      $("#rsTabla").innerHTML = E.table("meses", cols, rows, {
        cls: "table--compact", rowCls: r => r.m === m ? "is-selected" : "",
        foot: { m: `<b>Total ${y}</b>`, ventas: money(tot.ventas), costo: money(tot.costo), gastos: money(tot.gastos), neta: `<span class="${tot.neta < 0 ? "neg" : ""}">${money(tot.neta)}</span>`, unidades: int(tot.unidades) }
      });

      // Historial de cierres
      const cz = Object.entries(E.S.cierres).map(([id, c]) => Object.assign({ id }, c));
      const changed = r => { const live = E.agg(r.anio, r.mes); return Math.abs(live.neta - r.neta) >= 0.005 || live.unidades !== r.unidades; };
      const cc = [
        { key: "id", label: "Periodo cerrado", cls: "cell-head", html: r => `<b>${nombreCierre(r)}</b>${r.mes < 0 ? ` <span class="pill pill--accent">Año completo</span>` : ""}${changed(r) ? ` <span class="pill pill--warn">Cambió después</span>` : ""}` },
        { key: "ventas", label: "Ventas", num: true, html: r => money(r.ventas) },
        { key: "costo", label: "Costo", num: true, html: r => money(r.costo) },
        { key: "gastos", label: "Gastos", num: true, html: r => money(r.gastos) },
        { key: "neta", label: "Ganancia neta", num: true, html: r => `<b class="${r.neta < 0 ? "neg" : ""}">${money(r.neta)}</b>` },
        { key: "unidades", label: "Unidades vendidas", num: true, html: r => int(r.unidades) },
        { key: "stockUnidades", label: "Stock al cierre", num: true, val: r => n(r.stockUnidades), html: r => r.stockUnidades != null ? int(r.stockUnidades) : "—" },
        { key: "stockValor", label: "Valor del stock", num: true, val: r => n(r.stockValor), html: r => r.stockValor != null ? money(r.stockValor) : "—" },
        { key: "cerradoEl", label: "Cerrado el", html: r => fdate(r.cerradoEl) },
        { key: "_a", label: "Acciones", sort: false, cls: "cell-actions", html: r => `<div class="row-actions"><button class="link-btn" type="button" data-act="verMes" data-y="${r.anio}" data-m="${r.mes}">${r.mes < 0 ? "Ver año" : "Ver mes"}</button>${r.inventario && r.inventario.length ? `<button class="link-btn" type="button" data-act="verInventarioCierre" data-id="${r.id}">Ver inventario</button>` : ""}<button class="link-btn link-btn--danger" type="button" data-act="quitarCierre" data-id="${r.id}">Quitar cierre</button></div>` }
      ];
      $("#rsCierres").innerHTML = E.table("cierres", cc, cz, { sortDir: -1, empty: "Todavía no has cerrado ningún mes ni año. Elige el periodo arriba y pulsa «Cerrar mes» o «Cerrar año»." });

      drawChart();
    }
  };

  /* ---------- Gráfico de barras (SVG) ---------- */
  function niceScale(min, max, count) {
    if (max === min) max = min + 100;
    const raw = (max - min) / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), e = raw / mag;
    const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
    return { lo, hi, ticks };
  }
  function drawChart() {
    const box = $("#rsChart"); if (!box || !box.clientWidth) return;
    const y = UI.year;
    chartRows = MESES.map((x, i) => Object.assign({ i }, E.agg(y, i)));
    const W = Math.max(300, box.clientWidth), H = W < 520 ? 220 : 270, mL = W < 520 ? 46 : 60, mR = 8, mT = 10, mB = 26;
    const vals = chartRows.flatMap(r => [r.ventas, r.neta]);
    const sc = niceScale(Math.min(0, ...vals), Math.max(0, ...vals), 4);
    const yS = v => mT + (H - mT - mB) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
    const gw = (W - mL - mR) / 12, bw = Math.max(3, Math.min(18, (gw - 8) / 2)), gap = 2;
    const short = v => { const a = Math.abs(v); return (v < 0 ? "-" : "") + "$" + (a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1) + "k" : a.toFixed(0)); };
    let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
    sc.ticks.forEach(t => { const yy = yS(t); s += `<line class="${t === 0 ? "zero-line" : "grid-line"}" x1="${mL}" x2="${W - mR}" y1="${yy}" y2="${yy}"/><text x="${mL - 6}" y="${yy + 4}" text-anchor="end">${short(t)}</text>`; });
    const y0 = yS(0);
    chartRows.forEach((r, i) => {
      const gx = mL + i * gw, cx = gx + gw / 2;
      s += `<rect class="hit ${i === UI.month ? "is-selected" : ""}" x="${gx}" y="${mT}" width="${gw}" height="${H - mT - mB}" data-i="${i}"/>`;
      [[r.ventas, "var(--c-ventas)", cx - gap / 2 - bw], [r.neta, "var(--c-neta)", cx + gap / 2]].forEach(([v, c, x]) => {
        if (Math.abs(v) < 0.005) return;
        const yy = yS(v), h = Math.max(1, Math.abs(yy - y0)), top = v >= 0 ? yy : y0, rr = Math.min(4, bw / 2, h);
        s += v >= 0
          ? `<path d="M${x},${top + h}V${top + rr}Q${x},${top} ${x + rr},${top}H${x + bw - rr}Q${x + bw},${top} ${x + bw},${top + rr}V${top + h}Z" fill="${c}" pointer-events="none"/>`
          : `<path d="M${x},${top}V${top + h - rr}Q${x},${top + h} ${x + rr},${top + h}H${x + bw - rr}Q${x + bw},${top + h} ${x + bw},${top + h - rr}V${top}Z" fill="${c}" pointer-events="none"/>`;
      });
      s += `<text x="${cx}" y="${H - 8}" text-anchor="middle" ${i === UI.month ? 'style="fill:var(--ink);font-weight:700"' : ""}>${W < 420 ? MES_CORTO[i].slice(0, 1) : MES_CORTO[i]}</text>`;
    });
    box.innerHTML = s + `</svg>`;
  }
  function showTip(i, ev) {
    const tip = $("#rsTip"), card = tip.parentNode, r = chartRows && chartRows[i]; if (!r) return;
    tip.innerHTML = `<b>${MESES[i]} ${UI.year}</b><div><span>Ventas</span><span>${money(r.ventas)}</span></div><div><span>Costo</span><span>${money(r.costo)}</span></div><div><span>Gastos</span><span>${money(r.gastos)}</span></div><div><span>Ganancia neta</span><span>${money(r.neta)}</span></div><div><span>Unidades</span><span>${int(r.unidades)}</span></div>`;
    tip.hidden = false;
    const bb = card.getBoundingClientRect(), tw = tip.offsetWidth;
    let x = ev.clientX - bb.left + 14; if (x + tw > bb.width - 4) x = ev.clientX - bb.left - tw - 14; if (x < 4) x = 4;
    tip.style.left = x + "px"; tip.style.top = Math.max(8, ev.clientY - bb.top - 40) + "px";
  }

  /* ---------- Acciones ---------- */
  /* Cerrar mes o año: guarda un resumen fijo de ventas y ganancias,
     y una foto del inventario de ese momento (stock y valor de cada prenda). */
  E.acts.cerrarMes = async () => {
    const y = UI.year, m = UI.month;
    const cid = cierreId(y, m), a = E.agg(y, m), prev = E.S.cierres[cid];
    const nombre = m < 0 ? `el año ${y}` : `${MESES[m]} ${y}`;
    const inventario = E.D.items.slice().sort((p, q) => p.codigo.localeCompare(q.codigo, "es", { numeric: true }))
      .map(i => ({ codigo: i.codigo, tipo: i.tipo, talla: i.talla, color: i.color, stock: i.stock, vendidas: i.vendidas, costo: i.costo, precio: i.precio, valor: i.valor }));
    const stockUnidades = sum(E.D.items, i => Math.max(i.stock, 0)), stockValor = E.r2(sum(E.D.items, i => i.valor));
    const ok = await E.ask((prev ? "Actualizar cierre de " : "Cerrar ") + nombre,
      `Se guardará este resumen fijo de ${nombre}:<br><br><span class="tnum">Ventas ${money(a.ventas)} · Costo ${money(a.costo)} · Gastos ${money(a.gastos)}<br><b>Ganancia neta ${money(a.neta)}</b> · ${int(a.unidades)} prendas vendidas<br>Inventario: ${int(stockUnidades)} prendas en stock · ${money(stockValor)} (${inventario.length} modelos)</span>` +
      (prev ? `<br><br>Reemplaza el cierre anterior (ganancia neta ${money(prev.neta)}).` : "") + `<br><br>Tus registros no se borran ni se bloquean.`,
      [{ l: prev ? "Actualizar cierre" : (m < 0 ? "Cerrar año" : "Cerrar mes"), v: "si" }]);
    if (!ok) return;
    await E.put("cierres", cid, { anio: y, mes: m, ventas: a.ventas, costo: a.costo, bruta: a.bruta, gastos: a.gastos, neta: a.neta, margen: E.r2(a.margen * 10000) / 10000, unidades: a.unidades,
      stockUnidades, stockValor, inventario, cerradoEl: new Date().toISOString() });
    E.toast((m < 0 ? "Año " + y : MESES[m] + " " + y) + " cerrado y guardado");
  };
  E.acts.verInventarioCierre = b => {
    const c = E.S.cierres[b.dataset.id]; if (!c) return;
    const filas = (c.inventario || []).map(i => `<div class="receipt__line" style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)"><span><b>${esc(i.codigo)}</b> <span class="muted">${esc(i.tipo)} · ${esc(i.talla)} · ${esc(i.color)}</span></span><span class="tnum">${int(i.stock)} · ${money(i.valor)}</span></div>`).join("");
    E.ask("Inventario al cierre de " + nombreCierre(c), `<p class="small" style="margin-bottom:8px">Guardado el ${fdate(c.cerradoEl)} · ${int(c.stockUnidades)} prendas · ${money(c.stockValor)}</p>${filas}`, []);
  };
  E.acts.quitarCierre = async b => {
    const c = E.S.cierres[b.dataset.id];
    const ok = await E.ask("Quitar cierre de " + nombreCierre(c), "Se borra solo el resumen guardado. Las ventas y gastos del mes siguen intactos.", [{ l: "Quitar cierre", v: "si", cls: "btn--danger" }]);
    if (ok) { await E.del("cierres", b.dataset.id); E.toast("Cierre quitado"); }
  };
  E.acts.verMes = b => { UI.year = +b.dataset.y; UI.month = +b.dataset.m; E.render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  E.acts.verStockBajo = () => { E.sorts.inv = { key: "stock", dir: 1 }; };
})();

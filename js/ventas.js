/* =========================================================
   ELOHIM INVENTARIO · SECCIÓN 3: VENTAS
   Una venta puede tener varias prendas (una gorra, dos
   camisetas…), cada una con su cantidad, precio y costo.
   Resumen en vivo, ventas de hoy, clientes, filtros y tabla.

   Cómo se guarda: cada prenda de la venta es un registro en
   "ventas", y todas las de la misma venta comparten el mismo
   "pedido". Así el stock y las ganancias se calculan igual.
   ========================================================= */
(function () {
  "use strict";
  const { $, esc, money, int, sum, n, r2, fdate, MESES } = E;
  E.views = E.views || {}; E.acts = E.acts || {};

  const LIBRE = "__libre__";        // prenda que no está en el inventario
  let lines = [];                   // prendas del formulario
  let editIds = [];                 // registros de la venta que se está editando
  let editPedido = null;
  let justSaved = false;            // el recibo muestra la venta recién guardada
  let seq = 0;
  const f = { q: "", year: "", month: "", canal: "", estado: "" };

  const D = () => E.D || { items: [], codeMap: {}, sales: [] };
  const newLine = code => ({ key: "l" + (++seq), code: code || "", nombre: "", cant: "1", precio: "", costo: "" });
  const lineEl = key => document.querySelector(`#vLineas [data-line="${key}"]`);

  /* Unidades disponibles de un código (al editar, se suman las de la venta original) */
  function available(code) {
    const it = D().codeMap[code]; if (!it) return null;
    const own = sum(editIds.map(id => E.S.ventas[id]).filter(v => v && v.codigo === code && v.estado !== "Cancelado"), v => n(v.cantidad));
    return it.stock + own;
  }

  function codeOptions(sel) {
    const items = D().items.slice().sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
    let h = `<option value="">Elige una prenda…</option><option value="${LIBRE}">Otra prenda (no está en inventario)</option>` + items.map(i => {
      const d = available(i.codigo);
      return `<option value="${esc(i.codigo)}">${esc(i.codigo)} · ${esc(i.tipo)} · ${esc(i.talla)} · ${esc(i.color)} — ${d <= 0 ? "agotado" : d + " disp."}</option>`;
    }).join("");
    if (sel && sel !== LIBRE && !D().codeMap[sel]) h += `<option value="${esc(sel)}">${esc(sel)} (ya no está en inventario)</option>`;
    return h;
  }

  /* ---------- Filas de prendas ---------- */
  function lineHtml(l, i) {
    const libre = l.code === LIBRE, k = l.key;
    return `<div class="line" data-line="${k}">
      <div class="line__top"><span class="line__n">${i + 1}</span>
        <div class="field"><label for="${k}-code">Prenda</label><select class="input" id="${k}-code" data-lf="code">${codeOptions(l.code)}</select></div>
        ${lines.length > 1 ? `<button class="link-btn link-btn--danger" type="button" data-act="quitarLinea" data-line="${k}" style="margin-bottom:10px">Quitar</button>` : ""}
      </div>
      <div class="field" data-libre ${libre ? "" : "hidden"}><label for="${k}-nombre">Describe la prenda</label><input class="input" id="${k}-nombre" data-lf="nombre" value="${esc(l.nombre)}" placeholder="Ej. Hoodie Génesis negro talla L" autocomplete="off"></div>
      <div class="line__nums">
        <div class="field"><label for="${k}-cant">Cantidad</label><input class="input" id="${k}-cant" data-lf="cant" type="number" inputmode="numeric" min="1" step="1" value="${esc(l.cant)}"></div>
        <div class="field"><label for="${k}-precio">Precio c/u ($)</label><input class="input" id="${k}-precio" data-lf="precio" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(l.precio)}"></div>
        <div class="field"><label for="${k}-costo">Te costó c/u ($)</label><input class="input" id="${k}-costo" data-lf="costo" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(l.costo)}" placeholder="0.00"></div>
      </div>
      <div class="line__foot"><span>Subtotal <b data-lo="sub">$0.00</b></span><span data-lo="stock"></span></div>
    </div>`;
  }
  function renderLines() {
    $("#vLineas").innerHTML = lines.map(lineHtml).join("");
    lines.forEach(l => { const s = $("#" + l.key + "-code"); if (s) s.value = l.code; });
  }
  function onLineField(t) {
    const box = t.closest(".line"); if (!box) return;
    const l = lines.find(x => x.key === box.dataset.line); if (!l) return;
    const fld = t.dataset.lf;
    if (fld === "code") {
      if (t.value === l.code) return;
      l.code = t.value;
      const it = D().codeMap[l.code];
      if (it) { l.precio = it.precio.toFixed(2); l.costo = it.costo.toFixed(2); }
      else if (l.code === LIBRE) { l.costo = ""; }
      $("#" + l.key + "-precio").value = l.precio;
      $("#" + l.key + "-costo").value = l.costo;
      box.querySelector("[data-libre]").hidden = l.code !== LIBRE;
      if (l.code === LIBRE) setTimeout(() => { const el = $("#" + l.key + "-nombre"); if (el) el.focus(); }, 0);
    } else l[fld] = t.value;
  }

  /* ---------- Resumen de la venta (recibo) ---------- */
  function calc() {
    const items = lines.map(l => {
      const it = D().codeMap[l.code], libre = l.code === LIBRE, q = n(l.cant), p = n(l.precio), c = n(l.costo);
      const name = libre ? (l.nombre.trim() || "Otra prenda") : it ? `${it.codigo} · ${it.tipo} · ${it.talla} · ${it.color}` : (l.code || "");
      return { l, it, libre, q, p, c, sub: q * p, cost: q * c, name };
    });
    const need = {};
    items.forEach(x => { if (x.it) need[x.l.code] = (need[x.l.code] || 0) + x.q; });
    const subtotal = sum(items, x => x.sub), d = n($("#vDesc").value), total = subtotal - d, cost = sum(items, x => x.cost);
    return { items, need, subtotal, d, total, cost, gan: total - cost };
  }
  function updateReceipt() {
    const r = calc(), cancel = $("#vEstado").value === "Cancelado";
    const over = Object.keys(r.need).filter(code => r.need[code] > available(code));
    r.items.forEach(x => {
      const el = lineEl(x.l.key); if (!el) return;
      el.querySelector('[data-lo="sub"]').textContent = money(x.sub);
      const disp = x.it ? available(x.l.code) : null;
      el.querySelector('[data-lo="stock"]').textContent = x.libre ? "No afecta el inventario" : x.it ? `Disponibles: ${int(disp)}` : "";
      el.querySelector('[data-lo="stock"]').classList.toggle("neg", !!x.it && over.includes(x.l.code));
    });
    const chosen = r.items.filter(x => x.l.code);
    $("#rcFecha").textContent = $("#vFecha").value ? fdate($("#vFecha").value) : "";
    $("#rcLineas").innerHTML = chosen.length
      ? chosen.map(x => { const a = x.it ? available(x.l.code) : null; return `<div class="receipt__item"><span>${int(x.q)} × ${esc(x.name)}<small>${money(x.p)} c/u${x.it && !cancel ? ` · stock ${int(a)} → ${int(a - r.need[x.l.code])}` : x.libre ? " · fuera del inventario" : ""}</small></span><b>${money(x.sub)}</b></div>`; }).join("")
      : `<span class="small" style="color:var(--on-navy-2)">Elige la primera prenda para ver el resumen.</span>`;
    $("#rcSubtotal").textContent = money(r.subtotal);
    $("#rcDesc").textContent = r.d ? "−" + money(r.d) : money(0);
    $("#rcTotal").textContent = money(r.total);
    $("#rcCosto").textContent = money(r.cost);
    $("#rcGanancia").textContent = money(r.gan); $("#rcGanancia").classList.toggle("neg", r.gan < 0);
    $("#rcCliente").textContent = $("#vCliente").value.trim() || "—";
    let aviso = "";
    if (over.length && !cancel) aviso = over.map(c => `Solo hay ${int(Math.max(available(c), 0))} de ${c} y estás vendiendo ${int(r.need[c])}.`).join(" ") + " Si guardas, el stock quedará en negativo.";
    if (cancel && chosen.length) aviso = "Estado «Cancelado»: esta venta no contará en ventas, costo ni ganancia.";
    $("#rcAviso").hidden = !aviso; $("#rcAviso").textContent = aviso;
    $("#rcListo").hidden = true;
    const extra = over.length && !cancel ? " de todos modos" : "";
    $("#vGuardar").textContent = (editIds.length ? "Guardar cambios" : "Registrar venta") + extra;
  }

  /* ---------- Formulario ---------- */
  function resetFields(keep) {
    lines = [newLine()]; editIds = []; editPedido = null;
    E.clearErr($("#formVenta"));
    $("#vDesc").value = 0; $("#vCliente").value = "";
    if (!keep) { $("#vFecha").value = E.today(); $("#vCanal").value = "Instagram"; $("#vEstado").value = "Pagado"; }
    $("#vTitulo").textContent = "Agregar venta"; $("#vCancelar").hidden = true;
    $("#vGuardar").textContent = "Registrar venta";
    renderLines();
  }
  function resetForm() { justSaved = false; resetFields(false); updateReceipt(); }

  function orderIds(id) {
    const s = E.S.ventas[id]; if (!s) return [];
    if (!s.pedido) return [id];
    return Object.entries(E.S.ventas).filter(([, v]) => v.pedido === s.pedido).sort((a, b) => (a[1].linea || 0) - (b[1].linea || 0)).map(([k]) => k);
  }
  function loadOrder(id) {
    const ids = orderIds(id); if (!ids.length) return;
    justSaved = false; editIds = ids; editPedido = E.S.ventas[ids[0]].pedido || null;
    lines = ids.map(k => {
      const v = E.S.ventas[k], libre = v.libre || !v.codigo, l = newLine(libre ? LIBRE : v.codigo);
      l.nombre = libre ? v.prenda || "" : ""; l.cant = String(v.cantidad); l.precio = n(v.precio).toFixed(2);
      l.costo = v.costo != null && v.costo !== "" ? n(v.costo).toFixed(2) : "";
      return l;
    });
    const first = E.S.ventas[ids[0]];
    $("#vFecha").value = first.fecha; $("#vCanal").value = first.canal; $("#vEstado").value = first.estado; $("#vCliente").value = first.cliente || "";
    $("#vDesc").value = r2(sum(ids, k => n(E.S.ventas[k].descuento)));
    $("#vTitulo").textContent = `Editar venta del ${fdate(first.fecha)}${ids.length > 1 ? ` · ${ids.length} prendas` : ""}`;
    $("#vCancelar").hidden = false;
    renderLines(); updateReceipt();
    $("#formVenta").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveSale(e) {
    e.preventDefault();
    const form = $("#formVenta"); E.clearErr(form);
    let ok = true;
    lines.forEach(l => {
      const k = l.key;
      if (!l.code) { E.fieldErr(k + "-code", "Elige la prenda, o «Otra prenda» si no está en el inventario."); ok = false; }
      if (l.code === LIBRE && !l.nombre.trim()) { E.fieldErr(k + "-nombre", "Escribe qué prenda vendiste."); ok = false; }
      if (!(n(l.cant) > 0) || !Number.isInteger(n(l.cant))) { E.fieldErr(k + "-cant", "Número entero mayor que 0."); ok = false; }
      if (l.precio === "" || n(l.precio) < 0) { E.fieldErr(k + "-precio", "Escribe el precio."); ok = false; }
      if (n(l.costo) < 0) { E.fieldErr(k + "-costo", "No puede ser negativo."); ok = false; }
    });
    if (!$("#vFecha").value) { E.fieldErr("vFecha", "Elige la fecha."); ok = false; }
    const r = calc();
    if (r.d < 0) { E.fieldErr("vDesc", "El descuento no puede ser negativo."); ok = false; }
    else if (r.d > r.subtotal) { E.fieldErr("vDesc", "El descuento es mayor que el total."); ok = false; }
    if (!ok) { const bad = form.querySelector(".is-bad"); if (bad) bad.focus(); return; }

    const pedido = editPedido || E.uid("p"), wasEdit = editIds.length > 0;
    const comunes = { fecha: $("#vFecha").value, canal: $("#vCanal").value, estado: $("#vEstado").value, cliente: $("#vCliente").value.trim(), pedido };
    const writes = lines.map((l, i) => {
      const id = editIds[i] || E.uid("v"), old = E.S.ventas[editIds[i]], libre = l.code === LIBRE, it = D().codeMap[l.code];
      return [id, Object.assign({ creado: old && old.creado ? old.creado : new Date().toISOString() }, comunes, {
        linea: i, codigo: libre ? "" : l.code, libre,
        prenda: libre ? l.nombre.trim() : it ? [it.tipo, it.talla, it.color].join(" · ") : (old && old.prenda) || "",
        cantidad: n(l.cant), precio: r2(n(l.precio)), costo: r2(n(l.costo)),
        descuento: i === 0 ? r2(r.d) : 0           // el descuento va en la primera prenda
      })];
    });
    const sobrantes = editIds.slice(lines.length);
    const prendas = sum(lines, l => n(l.cant));

    // El recibo se queda mostrando la venta guardada hasta que empieces otra
    updateReceipt();
    justSaved = true;
    $("#rcAviso").hidden = true;
    $("#rcListo").hidden = false;
    $("#rcListo").textContent = `✓ ${wasEdit ? "Venta actualizada" : "Venta registrada"}: ${int(prendas)} ${prendas === 1 ? "prenda" : "prendas"} · ${money(r.total)} · ganancia ${money(r.gan)}`;
    resetFields(true);
    for (const [id, data] of writes) await E.put("ventas", id, data);
    for (const id of sobrantes) await E.del("ventas", id);
    E.toast((wasEdit ? "Venta actualizada · " : "Venta registrada · ") + money(r.total));
  }

  /* ---------- Clientes ---------- */
  function clientes() {
    const map = {};
    D().sales.filter(s => s.activa && (s.cliente || "").trim()).forEach(s => {
      const name = s.cliente.trim(), k = name.toLowerCase();
      const c = map[k] || (map[k] = { name, pedidos: new Set(), total: 0, unidades: 0, last: "" });
      c.pedidos.add(s.pedido || s.id); c.total += s.total; c.unidades += s.cantidad; if (s.fecha > c.last) c.last = s.fecha;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }

  E.views.ventas = {
    init() {
      E.fillSelect($("#vCanal"), E.CANALES); E.fillSelect($("#vEstado"), E.ESTADOS);
      resetFields(false);
      $("#formVenta").addEventListener("submit", saveSale);
      const onEdit = e => { if (e.target.dataset && e.target.dataset.lf) onLineField(e.target); justSaved = false; updateReceipt(); };
      $("#formVenta").addEventListener("input", onEdit);
      $("#formVenta").addEventListener("change", onEdit);
      E.fillSelect($("#venMonth"), MESES.map((m, i) => ({ v: i, l: m })), "Todos los meses");
      E.fillSelect($("#venCanal"), E.CANALES, "Todos los canales");
      E.fillSelect($("#venEstado"), E.ESTADOS, "Todos los estados");
      const bind = (id, key, ev) => $("#" + id).addEventListener(ev || "change", e => { f[key] = e.target.value; E.render(); });
      bind("venQ", "q", "input"); bind("venYear", "year"); bind("venMonth", "month"); bind("venCanal", "canal"); bind("venEstado", "estado");
      // Cambio rápido de estado desde la tabla (se aplica a toda la venta)
      $("#venTabla").addEventListener("change", async e => {
        const t = e.target; if (!t.dataset.estado) return;
        for (const id of orderIds(t.dataset.estado)) await E.put("ventas", id, Object.assign(E.clone(E.S.ventas[id]), { estado: t.value }));
        E.toast("Estado: " + t.value);
      });
    },

    render() {
      const data = D();
      $("#venContador").textContent = `${new Set(data.sales.map(s => s.pedido || s.id)).size} ventas registradas`;
      // refrescar las listas de prendas (stock disponible) sin perder lo escrito
      lines.forEach(l => { const s = $("#" + l.key + "-code"); if (s) { s.innerHTML = codeOptions(l.code); s.value = l.code; } });
      if (!justSaved) updateReceipt();

      // Hoy
      const hoy = E.aggDay(E.today()), root = $("#ventas");
      $("#hoyFecha").textContent = fdate(E.today());
      root.querySelector('[data-v="hoyTotal"]').textContent = money(hoy.total);
      root.querySelector('[data-v="hoyGanancia"]').textContent = money(hoy.ganancia);
      root.querySelector('[data-v="hoyUnidades"]').textContent = int(hoy.unidades);
      root.querySelector('[data-v="hoyRegistros"]').textContent = int(hoy.registros);

      // Clientes
      const cl = clientes(), q0 = f.q.trim().toLowerCase();
      $("#listaClientes").innerHTML = [...new Set(data.sales.map(s => (s.cliente || "").trim()).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join("");
      $("#venClientes").innerHTML = cl.length
        ? cl.map(c => `<button class="client-chip" type="button" data-act="verCliente" data-name="${esc(c.name)}" aria-pressed="${q0 === c.name.toLowerCase()}">${esc(c.name)} <span>${c.pedidos.size} ${c.pedidos.size === 1 ? "compra" : "compras"} · ${int(c.unidades)} prendas · ${money(c.total)}</span></button>`).join("")
        : `<span class="muted small">Cuando registres una venta con el nombre del cliente, aparecerá aquí.</span>`;

      // Filtros y tabla
      E.fillSelect($("#venYear"), E.years(), "Todos los años", f.year);
      const q = f.q.trim().toLowerCase();
      const rows = data.sales.filter(s => (!f.year || E.yearOf(s.fecha) === +f.year) && (f.month === "" || E.monthOf(s.fecha) === +f.month) && (!f.canal || s.canal === f.canal) && (!f.estado || s.estado === f.estado) &&
        (!q || [s.codigo, s.cliente, s.prendaTxt].join(" ").toLowerCase().includes(q)));
      const act = rows.filter(s => s.activa);
      const nVentas = new Set(rows.map(s => s.pedido || s.id)).size;
      $("#venTotales").innerHTML = `<div><span>Ventas</span><b>${money(sum(act, s => s.total))}</b></div><div><span>Ganancia</span><b>${money(sum(act, s => s.ganancia))}</b></div><div><span>Prendas vendidas</span><b>${int(sum(act, s => s.cantidad))}</b></div><div><span>Ventas</span><b>${nVentas}</b><small class="muted">${rows.length - act.length} prendas canceladas</small></div>`;

      if (!data.sales.length) {
        $("#venTabla").innerHTML = `<div class="empty"><h3>Aún no hay ventas</h3><p>Usa el formulario de arriba. Puedes poner varias prendas en una misma venta con «+ Agregar otra prenda».</p></div>`;
        return;
      }
      const porPedido = {};
      data.sales.forEach(s => { if (s.pedido) porPedido[s.pedido] = (porPedido[s.pedido] || 0) + 1; });
      const cols = [
        { key: "fecha", label: "Fecha", cls: "cell-head", html: r => `<span><span class="code">${fdate(r.fecha)}</span>${E.tagEjemplo(r)}<span class="sub">${r.codigo ? esc(r.codigo) + " · " : ""}${esc(r.prendaTxt)}${porPedido[r.pedido] > 1 ? ` · venta de ${porPedido[r.pedido]} prendas` : ""}</span></span><b class="money tnum only-mobile">${money(r.total)}</b>` },
        { key: "codigo", label: "Código", cls: "hide-mobile", html: r => r.codigo ? `<span class="code">${esc(r.codigo)}</span>` : `<span class="muted">Sin código</span>` },
        { key: "cantidad", label: "Cant.", num: true, html: r => int(r.cantidad) },
        { key: "precio", label: "Precio", num: true, html: r => money(r.precio) },
        { key: "descuento", label: "Descuento", num: true, html: r => r.descuento ? "−" + money(r.descuento) : "—" },
        { key: "total", label: "Total", num: true, cls: "hide-mobile", html: r => `<b class="money">${money(r.total)}</b>` },
        { key: "costoTotal", label: "Costo", num: true, html: r => `<span class="money">${money(r.costoTotal)}</span>` },
        { key: "ganancia", label: "Ganancia", num: true, html: r => `<span class="money ${r.ganancia < 0 ? "neg" : ""}">${money(r.ganancia)}</span>` },
        { key: "canal", label: "Canal" },
        { key: "cliente", label: "Cliente", html: r => r.cliente ? `<span class="pill pill--warn">${esc(r.cliente)}</span>` : "—" },
        { key: "estado", label: "Estado", val: r => E.ESTADOS.indexOf(r.estado), html: r => `<select class="estado" data-estado="${r.id}" data-e="${esc(r.estado)}" aria-label="Estado de la venta">${E.ESTADOS.map(x => `<option ${x === r.estado ? "selected" : ""}>${x}</option>`).join("")}</select>` },
        { key: "_a", label: "Acciones", sort: false, cls: "cell-actions", html: r => `<div class="row-actions"><button class="link-btn" type="button" data-act="editarVenta" data-id="${r.id}">Editar</button><button class="link-btn link-btn--danger" type="button" data-act="eliminarVenta" data-id="${r.id}">Eliminar</button></div>` }
      ];
      $("#venTabla").innerHTML = E.table("ven", cols, rows, { sortKey: "fecha", sortDir: -1, empty: "Ninguna venta coincide con los filtros.", rowCls: r => r.activa ? "" : "is-cancel" });
    }
  };

  /* ---------- Acciones ---------- */
  E.acts.agregarLinea = () => {
    lines.push(newLine()); justSaved = false; renderLines(); updateReceipt();
    const l = lines[lines.length - 1]; $("#" + l.key + "-code").focus();
  };
  E.acts.quitarLinea = b => {
    lines = lines.filter(l => l.key !== b.dataset.line);
    if (!lines.length) lines = [newLine()];
    renderLines(); updateReceipt();
  };
  E.acts.verCliente = b => {
    const name = b.dataset.name, same = f.q.trim().toLowerCase() === name.toLowerCase();
    f.q = same ? "" : name; $("#venQ").value = f.q; E.render();
    if (!same) $("#venTabla").scrollIntoView({ behavior: "smooth", block: "start" });
  };
  E.acts.editarVenta = b => loadOrder(b.dataset.id);
  E.acts.cancelarEdicionVenta = () => resetForm();
  E.acts.eliminarVenta = async b => {
    const s = D().sales.find(x => x.id === b.dataset.id); if (!s) return;
    const ids = orderIds(s.id);
    const txt = `${fdate(s.fecha)} · ${esc(s.codigo || s.prendaTxt)} ×${s.cantidad} · ${money(s.total)}${s.cliente ? " · " + esc(s.cliente) : ""}<br><br>Si solo no se concretó, mejor cambia su estado a «Cancelado» para conservar el registro.`;
    const btns = ids.length > 1
      ? [{ l: "Solo esta prenda", v: "una", cls: "btn--outline" }, { l: `Toda la venta (${ids.length} prendas)`, v: "todo", cls: "btn--danger" }]
      : [{ l: "Eliminar", v: "todo", cls: "btn--danger" }];
    const ok = await E.ask("Eliminar venta", txt, btns);
    if (!ok) return;
    if (editIds.some(id => ids.includes(id))) resetForm();
    if (ok === "una") {
      const rest = ids.filter(id => id !== s.id), desc = n(E.S.ventas[s.id].descuento);
      await E.del("ventas", s.id);
      if (desc && rest.length) { const nx = E.S.ventas[rest[0]]; await E.put("ventas", rest[0], Object.assign(E.clone(nx), { descuento: r2(n(nx.descuento) + desc) })); }
      E.toast("Prenda quitada de la venta");
    } else {
      for (const id of ids) await E.del("ventas", id);
      E.toast("Venta eliminada");
    }
  };
})();

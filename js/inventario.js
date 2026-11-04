/* =========================================================
   ELOHIM INVENTARIO · SECCIÓN 2: INVENTARIO
   Agregar inventario, agregar precio, reponer stock,
   tipos de prenda, filtros, tabla y resumen por tipo.
   ========================================================= */
(function () {
  "use strict";
  const { $, esc, money, pct, int, sum, n, r2, fdate } = E;
  E.views = E.views || {}; E.acts = E.acts || {};
  let editId = null, restockId = null;
  const f = { q: "", tipo: "", col: "", talla: "", estado: "" };

  const estadoPill = e => `<span class="pill ${e === "Agotado" ? "pill--bad" : e === "Stock bajo" ? "pill--warn" : "pill--ok"}">${e}</span>`;
  const tallaOrden = t => { const i = E.TALLAS.indexOf(t); return i < 0 ? 99 : i; };
  const itemLabel = i => `${i.codigo} · ${i.tipo} · ${i.talla} · ${i.color}`;

  /* Muestra ganancia y margen, y la calculadora de precio:
     precio sugerido = costo ÷ (1 − margen que quieres) */
  function calcBox(boxId, costo, precio, margenId, precioId) {
    const g = n(precio) - n(costo), p = n(precio);
    let h = `<div><span>Ganancia por unidad</span><b class="${g < 0 ? "neg" : ""}">${money(g)}</b></div><div><span>Margen</span><b>${pct(p ? g / p : 0)}</b></div>`;
    const mRaw = margenId ? $("#" + margenId).value : "";
    if (mRaw !== "") {
      const m = n(mRaw) / 100;
      if (m >= 0 && m < 0.96 && n(costo) > 0) {
        const sug = E.r2(n(costo) / (1 - m));
        h += `<div><span>Precio sugerido para ${n(mRaw)}%</span><b>${money(sug)}</b></div><div><span>Ganarías por unidad</span><b>${money(sug - n(costo))}</b></div>` +
          `<div class="full"><button class="link-btn" type="button" data-act="usarPrecio" data-target="${precioId}" data-valor="${sug.toFixed(2)}">Usar ${money(sug)} como precio</button></div>`;
      } else h += `<div class="full"><span>${n(costo) > 0 ? "El margen debe estar entre 0% y 95%." : "Escribe primero el costo para calcular el precio."}</span></div>`;
    }
    $(boxId).innerHTML = h;
  }
  const refreshItemCalc = () => calcBox("#pCalc", $("#pCosto").value, $("#pPrecio").value, "pMargen", "pPrecio");
  const refreshPriceCalc = () => calcBox("#prCalc", $("#prCosto").value, $("#prPrecio").value, "prMargen", "prPrecio");
  function nextCode(c) {
    const m = c.match(/^(.*?)(\d+)$/); if (!m) return c + "-2";
    const base = m[1], w = m[2].length; let k = parseInt(m[2], 10) + 1;
    while (E.D.items.some(i => i.codigo.toUpperCase() === base + String(k).padStart(w, "0"))) k++;
    return base + String(k).padStart(w, "0");
  }

  /* ---------- Panel "Agregar inventario" ---------- */
  function openItem(id) {
    editId = id || null;
    const it = id ? E.S.items[id] : null;
    const form = $("#formPrenda"); E.clearErr(form);
    E.fillSelect($("#pTipo"), it && !E.tipos().includes(it.tipo) ? E.tipos().concat([it.tipo]) : E.tipos(), null, it ? it.tipo : E.tipos()[0]);
    $("#pCod").value = it ? it.codigo : "";
    $("#pCol").value = it ? it.coleccion || "" : "";
    $("#pTalla").value = it ? it.talla || "" : "";
    $("#pColor").value = it ? it.color || "" : "";
    $("#pCosto").value = it ? it.costo : "";
    $("#pPrecio").value = it ? it.precio : "";
    $("#pStock").value = it ? it.stockInicial : "";
    $("#pTitulo").textContent = it ? "Editar " + it.codigo : "Agregar inventario";
    $("#pGuardar").textContent = it ? "Guardar cambios" : "Agregar al inventario";
    const rep = it ? sum(it.reposiciones || [], x => n(x.cantidad)) : 0;
    $("#pNota").hidden = !rep; $("#pNota").textContent = rep ? `Además tiene ${int(rep)} unidades repuestas. Para sumar más usa «Reponer».` : "";
    $("#pMargen").value = ""; refreshItemCalc();
    $("#panelPrecio").hidden = true;
    $("#panelPrenda").hidden = false;
    $("#panelPrenda").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => $("#pCod").focus({ preventScroll: true }), 300);
  }
  async function saveItem(e) {
    e.preventDefault();
    const form = $("#formPrenda"); E.clearErr(form);
    const codigo = $("#pCod").value.trim().toUpperCase(), costo = $("#pCosto").value, precio = $("#pPrecio").value, stock = $("#pStock").value;
    let ok = true;
    if (!codigo) { E.fieldErr("pCod", "Escribe un código, por ejemplo CAM-001."); ok = false; }
    else if (E.D.items.some(i => i.codigo.toUpperCase() === codigo && i.id !== editId)) { E.fieldErr("pCod", "Ese código ya existe. Prueba " + nextCode(codigo) + "."); ok = false; }
    if (!$("#pTalla").value.trim()) { E.fieldErr("pTalla", "Indica la talla."); ok = false; }
    if (costo === "" || n(costo) < 0) { E.fieldErr("pCosto", "Escribe el costo (0 o más)."); ok = false; }
    if (precio === "" || n(precio) < 0) { E.fieldErr("pPrecio", "Escribe el precio (0 o más)."); ok = false; }
    if (stock === "" || n(stock) < 0 || !Number.isInteger(n(stock))) { E.fieldErr("pStock", "Escribe un número entero de unidades."); ok = false; }
    if (!ok) return;
    const old = editId ? E.S.items[editId] : null;
    const data = Object.assign({}, old ? E.clone(old) : { creado: new Date().toISOString(), reposiciones: [] }, {
      codigo, tipo: $("#pTipo").value, coleccion: $("#pCol").value.trim(), talla: $("#pTalla").value.trim(), color: $("#pColor").value.trim(),
      costo: r2(n(costo)), precio: r2(n(precio)), stockInicial: n(stock)
    });
    const id = editId || E.uid("i");
    $("#panelPrenda").hidden = true; editId = null;
    await E.put("items", id, data);
    if (old && old.codigo !== codigo) { // cambiar el código también en sus ventas
      const rel = Object.entries(E.S.ventas).filter(([, v]) => v.codigo === old.codigo);
      for (const [vid, v] of rel) await E.put("ventas", vid, Object.assign(E.clone(v), { codigo }));
      E.toast(`Código cambiado${rel.length ? ` y ${rel.length} ventas actualizadas` : ""}.`);
    } else E.toast(old ? codigo + " actualizada" : codigo + " agregada al inventario");
  }

  /* ---------- Panel "Agregar precio" ---------- */
  function fillPriceSelect(keep) {
    const items = E.D.items.slice().sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }));
    E.fillSelect($("#prCod"), items.map(i => ({ v: i.id, l: `${itemLabel(i)} — ahora ${money(i.precio)}` })), "Elige una prenda…", keep);
  }
  function openPrice(id) {
    fillPriceSelect(id || "");
    const it = id ? E.S.items[id] : null;
    $("#prCosto").value = it ? it.costo : ""; $("#prPrecio").value = it ? it.precio : "";
    $("#prMargen").value = ""; refreshPriceCalc();
    $("#panelPrenda").hidden = true; $("#panelPrecio").hidden = false;
    $("#panelPrecio").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function savePrice(e) {
    e.preventDefault();
    const form = $("#formPrecio"); E.clearErr(form);
    const id = $("#prCod").value, c = $("#prCosto").value, p = $("#prPrecio").value; let ok = true;
    if (!id) { E.fieldErr("prCod", "Elige la prenda."); ok = false; }
    if (c === "" || n(c) < 0) { E.fieldErr("prCosto", "Escribe el costo (0 o más)."); ok = false; }
    if (p === "" || n(p) < 0) { E.fieldErr("prPrecio", "Escribe el precio (0 o más)."); ok = false; }
    if (!ok) return;
    const it = E.S.items[id];
    $("#panelPrecio").hidden = true;
    await E.put("items", id, Object.assign(E.clone(it), { costo: r2(n(c)), precio: r2(n(p)) }));
    E.toast(`${it.codigo}: precio ${money(p)}, costo ${money(c)}`);
  }

  /* ---------- Reponer stock ---------- */
  function openRestock(id) {
    restockId = id;
    const it = E.S.items[id], d = E.D.codeMap[it.codigo];
    $("#rTitulo").textContent = "Reponer " + it.codigo;
    $("#rInfo").innerHTML = `${esc(d.tipo)} · ${esc(d.talla)} · ${esc(d.color)} — stock actual <b>${int(d.stock)}</b>`;
    $("#rCant").value = ""; $("#rFecha").value = E.today(); $("#rNota").value = "";
    const reps = (it.reposiciones || []).slice().reverse();
    $("#rHistorial").innerHTML = reps.length ? `<div class="field"><label>Reposiciones anteriores</label><div class="list">${reps.map(r => `<div><span class="tnum">${fdate(r.fecha)}</span><b class="tnum">+${int(r.cantidad)}</b><span class="muted small">${esc(r.nota || "")}</span></div>`).join("")}</div></div>` : "";
    E.clearErr($("#formReponer"));
    $("#dlgReponer").showModal();
  }
  async function saveRestock(e) {
    e.preventDefault();
    E.clearErr($("#formReponer"));
    const c = n($("#rCant").value);
    if (!(c > 0) || !Number.isInteger(c)) { E.fieldErr("rCant", "Escribe cuántas unidades entran (número entero)."); return; }
    if (!$("#rFecha").value) { E.fieldErr("rFecha", "Elige la fecha."); return; }
    const data = E.clone(E.S.items[restockId]);
    data.reposiciones = (data.reposiciones || []).concat([{ fecha: $("#rFecha").value, cantidad: c, nota: $("#rNota").value.trim() }]);
    $("#dlgReponer").close();
    await E.put("items", restockId, data);
    E.toast(`+${c} unidades en ${data.codigo}`);
  }

  /* ---------- Tipos de prenda ---------- */
  function tipoRow(t, used, isNew) {
    return `<div><input class="input" value="${esc(t)}" data-orig="${isNew ? "" : esc(t)}" aria-label="Tipo de prenda"><span class="muted small" style="white-space:nowrap">${isNew ? "nuevo" : used + " prendas"}</span><button class="link-btn link-btn--danger" type="button" data-act="quitarTipo" ${used ? 'disabled title="Tiene prendas"' : ""}>Quitar</button></div>`;
  }
  function openTipos() {
    $("#tiposLista").innerHTML = E.tipos().map(t => tipoRow(t, E.D.items.filter(i => i.tipo === t).length, false)).join("");
    $("#tipoNuevo").value = "";
    $("#dlgTipos").showModal();
  }
  async function saveTipos(e) {
    e.preventDefault();
    const rows = E.$$("#tiposLista input").map(el => ({ o: el.dataset.orig, v: el.value.trim() }));
    const extra = $("#tipoNuevo").value.trim();
    const vals = [...new Set(rows.map(r => r.v).filter(Boolean).concat(extra ? [extra] : []))];
    if (!vals.length) { E.toast("Deja al menos un tipo de prenda.", true); return; }
    $("#dlgTipos").close();
    await E.put("config", "main", Object.assign({}, E.S.config.main || {}, { tipos: vals }));
    for (const r of rows) {
      if (r.o && r.v && r.o !== r.v) for (const [iid, it] of Object.entries(E.S.items)) if (it.tipo === r.o) await E.put("items", iid, Object.assign(E.clone(it), { tipo: r.v }));
    }
    E.toast("Tipos de prenda guardados");
  }

  E.views.inventario = {
    init() {
      $("#formPrenda").addEventListener("submit", saveItem);
      $("#formPrecio").addEventListener("submit", savePrice);
      $("#formReponer").addEventListener("submit", saveRestock);
      $("#formTipos").addEventListener("submit", saveTipos);
      ["pCosto", "pPrecio", "pMargen"].forEach(id => $("#" + id).addEventListener("input", refreshItemCalc));
      ["prCosto", "prPrecio", "prMargen"].forEach(id => $("#" + id).addEventListener("input", refreshPriceCalc));
      $("#prCod").addEventListener("change", e => { const it = E.S.items[e.target.value]; $("#prCosto").value = it ? it.costo : ""; $("#prPrecio").value = it ? it.precio : ""; refreshPriceCalc(); });
      $("#pCod").addEventListener("blur", e => { e.target.value = e.target.value.trim().toUpperCase(); });
      const bind = (id, key, ev) => $("#" + id).addEventListener(ev || "change", e => { f[key] = e.target.value; E.render(); });
      bind("invQ", "q", "input"); bind("invTipo", "tipo"); bind("invCol", "col"); bind("invTalla", "talla"); bind("invEstado", "estado");
    },

    render() {
      const D = E.D;
      $("#invContador").textContent = `${D.items.length} modelos · ${int(sum(D.items, i => Math.max(i.stock, 0)))} unidades`;
      // listas de los filtros y del formulario
      const cols = [...new Set(D.items.map(i => i.coleccion).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
      const tallas = [...new Set(D.items.map(i => i.talla).filter(Boolean))].sort((a, b) => tallaOrden(a) - tallaOrden(b) || a.localeCompare(b));
      E.fillSelect($("#invTipo"), [...new Set(E.tipos().concat(D.items.map(i => i.tipo).filter(Boolean)))], "Todos los tipos");
      E.fillSelect($("#invCol"), cols, "Todas las colecciones");
      E.fillSelect($("#invTalla"), tallas, "Todas las tallas");
      $("#listaColecciones").innerHTML = cols.map(c => `<option value="${esc(c)}">`).join("");
      $("#listaColores").innerHTML = [...new Set(D.items.map(i => i.color).filter(Boolean))].map(c => `<option value="${esc(c)}">`).join("");
      if (!$("#panelPrecio").hidden) fillPriceSelect();

      if (!D.items.length) {
        $("#invTabla").innerHTML = `<div class="empty"><h3>Aún no hay prendas</h3><p>Registra cada modelo con su código, talla y color. El stock, la ganancia y el estado se calculan solos.</p><button class="btn btn--action" type="button" data-act="abrirPrenda">Agregar inventario</button></div>`;
        $("#invTipos").innerHTML = "";
        return;
      }
      const q = f.q.trim().toLowerCase();
      const rows = D.items.filter(i => (!f.tipo || i.tipo === f.tipo) && (!f.col || i.coleccion === f.col) && (!f.talla || i.talla === f.talla) && (!f.estado || i.estado === f.estado) &&
        (!q || [i.codigo, i.tipo, i.coleccion, i.color, i.talla].join(" ").toLowerCase().includes(q)));
      const c = [
        { key: "codigo", label: "Código", cls: "cell-head", html: r => `<span><span class="code">${esc(r.codigo)}</span>${E.tagEjemplo(r)}<span class="sub">${esc(r.tipo)}${r.coleccion ? " · " + esc(r.coleccion) : ""}</span></span><span class="only-mobile">${estadoPill(r.estado)}</span>` },
        { key: "talla", label: "Talla · Color", html: r => `${esc(r.talla)} · ${esc(r.color)}` },
        { key: "costo", label: "Costo", num: true, html: r => money(r.costo) },
        { key: "precio", label: "Precio", num: true, html: r => money(r.precio) },
        { key: "gu", label: "Ganancia / u", num: true, html: r => `<span class="${r.gu < 0 ? "neg" : ""}">${money(r.gu)}</span>` },
        { key: "margen", label: "Margen", num: true, html: r => pct(r.margen) },
        { key: "stockInicial", label: "Stock inicial", num: true, val: r => r.stockInicial + r.repuesto, html: r => int(r.stockInicial) + (r.repuesto ? ` <span class="muted">+${int(r.repuesto)}</span>` : "") },
        { key: "vendidas", label: "Vendidas", num: true, html: r => int(r.vendidas) },
        { key: "stock", label: "Stock actual", num: true, html: r => `<b class="${r.stock <= 0 ? "neg" : ""}">${int(r.stock)}</b>` },
        { key: "valor", label: "Valor del stock", num: true, html: r => money(r.valor) },
        { key: "estado", label: "Estado", cls: "hide-mobile", val: r => r.stock, html: r => estadoPill(r.estado) },
        { key: "_a", label: "Acciones", sort: false, cls: "cell-actions", html: r => `<div class="row-actions"><button class="link-btn" type="button" data-act="reponer" data-id="${r.id}">Reponer</button><button class="link-btn" type="button" data-act="abrirPrecio" data-id="${r.id}">Precio</button><button class="link-btn" type="button" data-act="editarPrenda" data-id="${r.id}">Editar</button><button class="link-btn link-btn--danger" type="button" data-act="eliminarPrenda" data-id="${r.id}">Eliminar</button></div>` }
      ];
      $("#invTabla").innerHTML = E.table("inv", c, rows, {
        empty: "Ninguna prenda coincide con los filtros.",
        foot: rows.length ? { codigo: `<b>${rows.length} modelos</b>`, stockInicial: int(sum(rows, r => r.stockInicial + r.repuesto)), vendidas: int(sum(rows, r => r.vendidas)), stock: int(sum(rows, r => r.stock)), valor: money(sum(rows, r => r.valor)) } : null
      });

      // Resumen por tipo de prenda
      const byT = {};
      D.items.forEach(i => { const t = byT[i.tipo] || (byT[i.tipo] = { tipo: i.tipo, modelos: 0, ini: 0, vend: 0, stock: 0, valor: 0, gan: 0 }); t.modelos++; t.ini += i.stockInicial + i.repuesto; t.vend += i.vendidas; t.stock += i.stock; t.valor += i.valor; t.gan += i.ganGen; });
      const tr = Object.values(byT);
      const tc = [
        { key: "tipo", label: "Tipo de prenda", cls: "cell-head", html: r => `<b>${esc(r.tipo)}</b>` },
        { key: "modelos", label: "Modelos", num: true, html: r => int(r.modelos) },
        { key: "ini", label: "Stock inicial", num: true, html: r => int(r.ini) },
        { key: "vend", label: "Vendidas", num: true, html: r => int(r.vend) },
        { key: "stock", label: "Stock actual", num: true, html: r => int(r.stock) },
        { key: "valor", label: "Dinero en stock", num: true, html: r => money(r.valor) },
        { key: "gan", label: "Ganancia generada", num: true, html: r => `<b>${money(r.gan)}</b>` }
      ];
      $("#invTipos").innerHTML = E.table("tipos", tc, tr, { foot: { tipo: "<b>Total</b>", modelos: int(sum(tr, r => r.modelos)), ini: int(sum(tr, r => r.ini)), vend: int(sum(tr, r => r.vend)), stock: int(sum(tr, r => r.stock)), valor: money(sum(tr, r => r.valor)), gan: money(sum(tr, r => r.gan)) } });
    }
  };

  /* ---------- Acciones ---------- */
  E.acts.abrirPrenda = () => openItem(null);
  E.acts.editarPrenda = b => openItem(b.dataset.id);
  E.acts.cerrarPrenda = () => { $("#panelPrenda").hidden = true; editId = null; };
  E.acts.abrirPrecio = b => { if (!E.D.items.length) { E.toast("Primero agrega una prenda al inventario.", true); return; } openPrice(b.dataset.id); };
  E.acts.cerrarPrecio = () => { $("#panelPrecio").hidden = true; };
  E.acts.reponer = b => openRestock(b.dataset.id);
  E.acts.abrirTipos = () => openTipos();
  E.acts.usarPrecio = b => { $("#" + b.dataset.target).value = b.dataset.valor; if (b.dataset.target === "pPrecio") refreshItemCalc(); else refreshPriceCalc(); };
  E.acts.agregarTipo = () => { const v = $("#tipoNuevo").value.trim(); if (!v) return; $("#tiposLista").insertAdjacentHTML("beforeend", tipoRow(v, 0, true)); $("#tipoNuevo").value = ""; };
  E.acts.quitarTipo = b => b.closest("div").remove();
  E.acts.eliminarPrenda = async b => {
    const it = E.S.items[b.dataset.id], ns = E.D.sales.filter(s => s.codigo === it.codigo).length;
    const ok = await E.ask("Eliminar " + it.codigo, ns ? `Esta prenda tiene <b>${ns} ventas</b>. Las ventas se conservan, pero ya no descontarán stock de este código.` : "La prenda se borrará del inventario.", [{ l: "Eliminar", v: "si", cls: "btn--danger" }]);
    if (ok) { await E.del("items", b.dataset.id); E.toast(it.codigo + " eliminada"); }
  };
})();

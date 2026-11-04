/* =========================================================
   ELOHIM INVENTARIO · SECCIÓN 4: GASTOS
   Agregar gasto, total por categoría (gráfico) y tabla.
   ========================================================= */
(function () {
  "use strict";
  const { $, esc, money, pct, sum, n, r2, fdate, MESES, CATEGORIAS } = E;
  E.views = E.views || {}; E.acts = E.acts || {};
  let editId = null;
  const f = { q: "", year: "", month: "", cat: "" };

  function resetForm() {
    editId = null; E.clearErr($("#formGasto"));
    $("#gFecha").value = E.today(); $("#gConc").value = ""; $("#gMonto").value = ""; $("#gCat").value = CATEGORIAS[0]; $("#gNota").value = "";
    $("#gTitulo").textContent = "Agregar gasto"; $("#gGuardar").textContent = "Agregar gasto"; $("#gCancelar").hidden = true;
  }
  function loadExpense(id) {
    const g = E.S.gastos[id]; if (!g) return;
    editId = id; E.clearErr($("#formGasto"));
    $("#gFecha").value = g.fecha; $("#gConc").value = g.concepto; $("#gMonto").value = g.monto; $("#gCat").value = g.categoria; $("#gNota").value = g.nota || "";
    $("#gTitulo").textContent = "Editar gasto"; $("#gGuardar").textContent = "Guardar cambios"; $("#gCancelar").hidden = false;
    $("#formGasto").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  async function saveExpense(e) {
    e.preventDefault(); E.clearErr($("#formGasto"));
    let ok = true;
    if (!$("#gFecha").value) { E.fieldErr("gFecha", "Elige la fecha."); ok = false; }
    if (!$("#gConc").value.trim()) { E.fieldErr("gConc", "Describe el gasto."); ok = false; }
    if ($("#gMonto").value === "" || !(n($("#gMonto").value) > 0)) { E.fieldErr("gMonto", "Escribe un monto mayor que 0."); ok = false; }
    if (!ok) return;
    const old = editId ? E.S.gastos[editId] : null;
    const data = Object.assign({}, old ? E.clone(old) : { creado: new Date().toISOString() }, {
      fecha: $("#gFecha").value, concepto: $("#gConc").value.trim(), categoria: $("#gCat").value, monto: r2(n($("#gMonto").value)), nota: $("#gNota").value.trim()
    });
    const id = editId || E.uid("g");
    resetForm();
    await E.put("gastos", id, data);
    E.toast((old ? "Gasto actualizado · " : "Gasto agregado · ") + money(data.monto));
  }

  E.views.gastos = {
    init() {
      E.fillSelect($("#gCat"), CATEGORIAS);
      resetForm();
      $("#formGasto").addEventListener("submit", saveExpense);
      E.fillSelect($("#gasMonth"), MESES.map((m, i) => ({ v: i, l: m })), "Todos los meses");
      E.fillSelect($("#gasCat"), CATEGORIAS, "Todas las categorías");
      const bind = (id, key, ev) => $("#" + id).addEventListener(ev || "change", e => { f[key] = e.target.value; E.render(); });
      bind("gasQ", "q", "input"); bind("gasYear", "year"); bind("gasMonth", "month"); bind("gasCat", "cat");
    },

    render() {
      const D = E.D;
      $("#gasContador").textContent = `${D.gastos.length} gastos registrados`;
      E.fillSelect($("#gasYear"), E.years(), "Todos los años", f.year);
      const inP = g => (!f.year || E.yearOf(g.fecha) === +f.year) && (f.month === "" || E.monthOf(g.fecha) === +f.month);
      const per = D.gastos.filter(inP);
      const q = f.q.trim().toLowerCase();
      const rows = per.filter(g => (!f.cat || g.categoria === f.cat) && (!q || [g.concepto, g.nota].join(" ").toLowerCase().includes(q)));

      // Total por categoría del periodo elegido
      const byC = CATEGORIAS.map(c => ({ c, t: r2(sum(per.filter(g => g.categoria === c), g => g.monto)) })).filter(x => x.t > 0).sort((a, b) => b.t - a.t);
      const tot = sum(byC, x => x.t), mx = Math.max(1, ...byC.map(x => x.t));
      const perTxt = (f.month !== "" ? MESES[+f.month] + " " : "") + (f.year || "todos los años");
      $("#gasPeriodo").textContent = `${perTxt} · total ${money(tot)}`;
      $("#gasCats").innerHTML = byC.length
        ? byC.map(x => `<div class="cat"><span>${esc(x.c)}</span><div class="cat__track" role="img" aria-label="${esc(x.c)}: ${money(x.t)}"><div class="cat__fill" style="width:${(x.t / mx * 100).toFixed(1)}%"></div></div><span class="cat__amount">${money(x.t)} <span class="muted small">${pct(tot ? x.t / tot : 0)}</span></span></div>`).join("")
        : `<span class="muted">No hay gastos en este periodo.</span>`;

      if (!D.gastos.length) { $("#gasTabla").innerHTML = `<div class="empty"><h3>Aún no hay gastos</h3><p>Usa el formulario de arriba para anotar tu primer gasto.</p></div>`; return; }
      const cols = [
        { key: "fecha", label: "Fecha", cls: "cell-head", html: r => `<span><span class="code">${fdate(r.fecha)}</span>${E.tagEjemplo(r)}<span class="sub">${esc(r.concepto)}</span></span><b class="tnum only-mobile">${money(r.monto)}</b>` },
        { key: "concepto", label: "Concepto", cls: "hide-mobile" },
        { key: "categoria", label: "Categoría" },
        { key: "monto", label: "Monto", num: true, cls: "hide-mobile", html: r => `<b>${money(r.monto)}</b>` },
        { key: "nota", label: "Nota", html: r => esc(r.nota || "—") },
        { key: "_a", label: "Acciones", sort: false, cls: "cell-actions", html: r => `<div class="row-actions"><button class="link-btn" type="button" data-act="editarGasto" data-id="${r.id}">Editar</button><button class="link-btn link-btn--danger" type="button" data-act="eliminarGasto" data-id="${r.id}">Eliminar</button></div>` }
      ];
      $("#gasTabla").innerHTML = E.table("gas", cols, rows, {
        sortKey: "fecha", sortDir: -1, empty: "Ningún gasto coincide con los filtros.",
        foot: rows.length ? { fecha: `<b>${rows.length} gastos</b>`, monto: `<b>${money(sum(rows, r => r.monto))}</b>` } : null
      });
    }
  };

  E.acts.editarGasto = b => loadExpense(b.dataset.id);
  E.acts.cancelarEdicionGasto = () => resetForm();
  E.acts.eliminarGasto = async b => {
    const g = E.S.gastos[b.dataset.id];
    const ok = await E.ask("Eliminar gasto", `${fdate(g.fecha)} · ${esc(g.concepto)} · ${money(g.monto)}`, [{ l: "Eliminar", v: "si", cls: "btn--danger" }]);
    if (ok) { if (editId === b.dataset.id) resetForm(); await E.del("gastos", b.dataset.id); E.toast("Gasto eliminado"); }
  };
})();

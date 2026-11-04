/* =========================================================
   ELOHIM INVENTARIO · UTILIDADES
   Formato de dinero y fechas, mensajes, confirmaciones,
   descargas y la tabla ordenable que usan todas las secciones.
   ========================================================= */
(function () {
  "use strict";

  E.$ = (s, root) => (root || document).querySelector(s);
  E.$$ = (s, root) => Array.from((root || document).querySelectorAll(s));
  E.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Números ---------- */
  E.n = v => { const x = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(x) ? x : 0; };
  E.r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;
  E.sum = (list, f) => list.reduce((t, x) => t + f(x), 0);
  const fmtUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  E.money = v => { const x = E.r2(E.n(v)); return fmtUSD.format(x === 0 ? 0 : x); };
  E.pct = v => (Number.isFinite(v) ? (v * 100).toFixed(1) : "0.0") + "%";
  E.int = v => new Intl.NumberFormat("en-US").format(Math.round(E.n(v)));

  /* ---------- Fechas (guardadas como AAAA-MM-DD) ---------- */
  E.pad = x => String(x).padStart(2, "0");
  E.today = () => { const d = new Date(); return d.getFullYear() + "-" + E.pad(d.getMonth() + 1) + "-" + E.pad(d.getDate()); };
  E.fdate = s => { if (!s) return ""; const p = String(s).slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  E.yearOf = s => s ? parseInt(String(s).slice(0, 4), 10) : 0;
  E.monthOf = s => s ? parseInt(String(s).slice(5, 7), 10) - 1 : -1;

  E.uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  E.clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- Listas desplegables ---------- */
  // list: ["a","b"] o [{v, l}]; mantiene la opción elegida si sigue existiendo
  E.fillSelect = (el, list, first, keep) => {
    const cur = keep === undefined ? el.value : keep;
    el.innerHTML = (first != null ? `<option value="">${E.esc(first)}</option>` : "") +
      list.map(o => { const v = typeof o === "object" ? o.v : o, l = typeof o === "object" ? o.l : o; return `<option value="${E.esc(v)}">${E.esc(l)}</option>`; }).join("");
    if ([...el.options].some(o => o.value === String(cur))) el.value = String(cur);
  };

  /* ---------- Errores de formulario ---------- */
  E.fieldErr = (id, msg) => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.add("is-bad");
    const m = document.createElement("span"); m.className = "field-error"; m.textContent = msg;
    el.closest(".field").appendChild(m);
  };
  E.clearErr = form => {
    E.$$(".field-error", form).forEach(e => e.remove());
    E.$$(".is-bad", form).forEach(e => e.classList.remove("is-bad"));
  };
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.classList && t.classList.contains("is-bad")) { t.classList.remove("is-bad"); const m = t.closest(".field") && t.closest(".field").querySelector(".field-error"); if (m) m.remove(); }
  });

  /* ---------- Mensaje flotante ---------- */
  let toastTimer;
  E.toast = (msg, bad) => {
    const t = E.$("#toast"); t.textContent = msg; t.className = "toast" + (bad ? " is-bad" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 5000 : 2800);
  };

  /* ---------- Confirmación (reemplaza confirm()) ---------- */
  E.ask = (title, html, buttons) => new Promise(resolve => {
    const dlg = E.$("#dlgConfirmar");
    E.$("#cfTitulo").textContent = title;
    E.$("#cfTexto").innerHTML = html;
    E.$("#cfBotones").innerHTML = `<button class="btn btn--outline" type="button" data-cf="">${buttons.length ? "Cancelar" : "Cerrar"}</button>` +
      buttons.map(b => `<button class="btn ${b.cls || ""}" type="button" data-cf="${b.v}">${E.esc(b.l)}</button>`).join("");
    let done = false;
    const finish = v => { if (done) return; done = true; dlg.removeEventListener("click", onClick); if (dlg.open) dlg.close(); resolve(v); };
    const onClick = e => { const b = e.target.closest("[data-cf]"); if (b) finish(b.dataset.cf || null); };
    dlg.addEventListener("click", onClick);
    dlg.onclose = () => finish(null);
    dlg.showModal();
  });

  /* ---------- Descargar un archivo ---------- */
  let downloads;
  async function getDownloads() {
    if (downloads !== undefined) return downloads;
    try { downloads = (window.claude && window.claude.use) ? await window.claude.use("downloads") : null; } catch (e) { downloads = null; }
    return downloads;
  }
  E.saveFile = async (filename, data) => {
    const dl = await getDownloads();
    if (dl) {
      try { await dl.save({ filename, data }); E.toast("Archivo listo: " + filename); }
      catch (e) { if (e && e.code === "declined") return; E.toast("No se pudo crear el archivo.", true); }
      return;
    }
    try {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      E.toast("Archivo descargado: " + filename);
    } catch (e) { E.toast("La descarga no está disponible en este navegador.", true); }
  };

  /* ---------- Tabla ordenable ----------
     cols: [{key, label, num, cls, html(r), val(r), sort:false}]
     En el celular cada fila se ve como tarjeta (ver components.css). */
  E.sorts = {};
  E.sortRows = (rows, cols, sort) => {
    const c = cols.find(c => c.key === sort.key); if (!c) return rows;
    const val = c.val || (r => r[c.key]);
    return rows.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      const d = (typeof x === "number" && typeof y === "number") ? x - y : String(x == null ? "" : x).localeCompare(String(y == null ? "" : y), "es", { numeric: true });
      return d * sort.dir;
    });
  };
  E.table = (tid, cols, rows, o) => {
    o = o || {};
    const sort = E.sorts[tid] || (E.sorts[tid] = { key: o.sortKey || cols[0].key, dir: o.sortDir || 1 });
    rows = E.sortRows(rows, cols, sort);
    const sortable = cols.filter(c => c.sort !== false);
    let h = "";
    if (rows.length > 1) {
      h += `<div class="mobile-sort"><label for="ms-${tid}">Ordenar por</label><select id="ms-${tid}" data-msort="${tid}">` +
        sortable.map(c => `<option value="${c.key}" ${c.key === sort.key ? "selected" : ""}>${E.esc(c.label)}</option>`).join("") +
        `</select><button type="button" data-act="ordenDir" data-t="${tid}" aria-label="Invertir orden">${sort.dir > 0 ? "↑" : "↓"}</button></div>`;
    }
    h += `<div class="table-wrap"><table class="table ${o.cls || ""}"><thead><tr>`;
    cols.forEach(c => {
      const cl = c.num ? "num" : "";
      if (c.sort === false) { h += `<th class="${cl}"><span>${E.esc(c.label)}</span></th>`; return; }
      const on = sort.key === c.key;
      h += `<th class="${cl}" ${on ? `aria-sort="${sort.dir > 0 ? "ascending" : "descending"}"` : ""}><button type="button" data-act="ordenar" data-t="${tid}" data-k="${c.key}">${E.esc(c.label)}<span class="arrow">${on ? (sort.dir > 0 ? "▲" : "▼") : ""}</span></button></th>`;
    });
    h += `</tr></thead><tbody>`;
    if (!rows.length) h += `<tr class="is-empty"><td colspan="${cols.length}">${o.empty || "No hay registros."}</td></tr>`;
    rows.forEach(r => {
      h += `<tr class="${o.rowCls ? o.rowCls(r) : ""}">` +
        cols.map(c => `<td class="${(c.num ? "num " : "") + (c.cls || "")}" data-label="${E.esc(c.label)}">${c.html ? c.html(r) : E.esc(r[c.key])}</td>`).join("") + `</tr>`;
    });
    h += `</tbody>`;
    if (o.foot) h += `<tfoot><tr>` + cols.map(c => { const v = o.foot[c.key]; return `<td class="${(c.num ? "num " : "") + (c.cls || "") + (v == null ? " hide-mobile" : "")}" data-label="${E.esc(c.label)}">${v == null ? "" : v}</td>`; }).join("") + `</tr></tfoot>`;
    return h + `</table></div>`;
  };

  E.tagEjemplo = r => r.ejemplo ? `<span class="tag-ejemplo">Ejemplo</span>` : "";
})();

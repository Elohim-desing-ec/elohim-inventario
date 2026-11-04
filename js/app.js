/* =========================================================
   ELOHIM INVENTARIO · ARRANQUE
   Navegación entre secciones (#resumen, #inventario…),
   tema claro/oscuro, botones y primer dibujado.
   ========================================================= */
(function () {
  "use strict";
  const { $, $$ } = E;
  const PAGES = ["resumen", "inventario", "ventas", "gastos", "datos", "usuarios"];

  /* ---------- Navegación ---------- */
  E.currentPage = () => {
    const h = location.hash.replace("#", "");
    if (h === "usuarios" && !(E.yo && E.yo.rol === "admin")) return "resumen"; // solo el administrador
    return PAGES.includes(h) ? h : "resumen";
  };
  function showPage() {
    const p = E.currentPage();
    $$("[data-page]").forEach(s => { s.hidden = s.dataset.page !== p; });
    $$("[data-nav]").forEach(a => { if (a.dataset.nav === p) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    E.render();
  }
  E.showPage = showPage;
  window.addEventListener("hashchange", () => { showPage(); window.scrollTo(0, 0); });

  /* ---------- Dibujar la sección visible ---------- */
  let raf = 0;
  E.render = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!E.ready()) return;
      E.derive();
      $("#avisos").innerHTML = E.Store.readOnly ? `<div class="notice notice--bad">Solo puedes ver estos datos. Pide acceso de edición para registrar cambios.</div>` : "";
      const view = E.views[E.currentPage()];
      if (view) view.render();
    });
  };

  /* ---------- Menú de usuario ---------- */
  const panel = $("#userPanel"), avatar = $("#avatarBtn");
  const abrirMenu = si => { panel.hidden = !si; avatar.setAttribute("aria-expanded", String(si)); };
  avatar.addEventListener("click", e => { e.stopPropagation(); abrirMenu(panel.hidden); });
  document.addEventListener("click", e => { if (!panel.hidden && !e.target.closest(".user-menu")) abrirMenu(false); });
  panel.addEventListener("click", e => { if (e.target.closest("a, button")) abrirMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.hidden) { abrirMenu(false); avatar.focus(); } });

  /* ---------- Botones con data-act ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const a = b.dataset.act;
    if (a === "ordenar") { const s = E.sorts[b.dataset.t], k = b.dataset.k; if (s.key === k) s.dir *= -1; else { s.key = k; s.dir = 1; } E.render(); return; }
    if (a === "ordenDir") { E.sorts[b.dataset.t].dir *= -1; E.render(); return; }
    if (a === "cerrarDialogo") { const d = b.closest("dialog"); if (d) d.close(); return; }
    if (E.Store.readOnly && !["salir", "verMes", "verStockBajo", "exportarJSON", "exportarExcel", "exportarCSV", "cerrarPrenda", "cerrarPrecio"].includes(a)) { E.toast("Solo puedes ver estos datos.", true); return; }
    if (E.acts[a]) E.acts[a](b, e);
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset && t.dataset.msort) { E.sorts[t.dataset.msort].key = t.value; E.render(); }
  });

  /* ---------- Tema claro / oscuro ---------- */
  const ICONS = {
    system: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    dark: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'
  };
  const LABELS = { system: "Tema automático", light: "Tema claro", dark: "Tema oscuro" };
  const getTheme = () => { try { return localStorage.getItem("elohim-tema") || "system"; } catch (e) { return "system"; } };
  function applyTheme(t) {
    if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", t);
    const b = $("#themeBtn"); b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[t]}</svg>`; b.title = LABELS[t]; b.setAttribute("aria-label", LABELS[t] + ". Cambiar");
  }
  $("#themeBtn").addEventListener("click", () => {
    const order = ["system", "light", "dark"], t = order[(order.indexOf(getTheme()) + 1) % 3];
    try { localStorage.setItem("elohim-tema", t); } catch (e) {}
    applyTheme(t); E.toast(LABELS[t]); E.render();
  });
  applyTheme(getTheme());

  /* ---------- Inicio ---------- */
  PAGES.forEach(p => E.views[p] && E.views[p].init());
  showPage();
  E.startStorage(E.render);
})();

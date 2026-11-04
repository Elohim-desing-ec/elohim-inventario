/* =========================================================
   ELOHIM INVENTARIO · GUARDADO AUTOMÁTICO
   Cada cambio se guarda solo, sin botón de guardar.
   Busca dónde guardar, en este orden:
   1. Nube con usuarios (Supabase, ver js/nube-config.js):
      pide usuario y contraseña y todos ven los mismos datos.
   2. Programa de Python (servidor.py): archivo de tu computadora.
   3. Este navegador (localStorage).
   ========================================================= */
(function () {
  "use strict";

  const vacio = () => ({ items: {}, ventas: {}, gastos: {}, cierres: {}, config: { main: { tipos: E.TIPOS_INICIO.slice() } } });
  E.S = vacio();
  const Store = E.Store = { mode: "cargando", sb: null, pending: 0, error: null, readOnly: false, loaded: new Set(), archivo: "" };
  let onChange = () => {};

  function setStatus() {
    const el = E.$("#saveStatus"); if (!el) return;
    el.classList.remove("is-busy", "is-error");
    let t;
    if (Store.mode === "cargando") { t = "Cargando…"; el.classList.add("is-busy"); }
    else if (Store.error) { t = "No se guardó"; el.classList.add("is-error"); }
    else if (Store.pending) { t = "Guardando…"; el.classList.add("is-busy"); }
    else t = { supabase: "Guardado en la nube", archivo: "Guardado en tu computadora", local: "Guardado en este navegador" }[Store.mode] || "";
    el.querySelector("span").textContent = t; el.title = t;
  }
  E.setStatus = setStatus;

  /* ---------- Este navegador ---------- */
  function saveLocal() {
    try { localStorage.setItem(E.CLAVE_LOCAL, JSON.stringify(E.S)); }
    catch (e) { E.toast("No se pudo guardar en este navegador. Exporta un respaldo.", true); }
  }
  function readLocal() {
    try { const raw = localStorage.getItem(E.CLAVE_LOCAL); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  /* ---------- Escritura con un reintento (nube y Python) ---------- */
  async function remoteWrite(fn) {
    Store.pending++; setStatus();
    try { await fn(); }
    catch (e) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 900));
      try { await fn(); return; }
      catch (e2) {
        Store.error = e2;
        if (Store.mode === "supabase" && e2 && e2.sesion) { E.toast("Tu sesión venció. Vuelve a entrar.", true); E.mostrarAcceso && E.mostrarAcceso(); }
        else if (Store.mode === "archivo") E.toast("No se pudo guardar: ¿cerraste la ventana de Python? Vuelve a abrir «Abrir inventario».", true);
        else E.toast("No se pudo guardar. Revisa tu conexión a internet e intenta de nuevo.", true);
      }
    } finally {
      Store.pending--; setStatus();
      if (!Store.pending) setTimeout(() => { if (!Store.pending) { Store.error = null; setStatus(); } }, 5000);
    }
  }
  async function serverSave(body) {
    const r = await fetch("api/guardar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }
  const sbCheck = res => { if (res.error) { const e = new Error(res.error.message); e.sesion = res.status === 401 || /JWT|token/i.test(res.error.message); throw e; } };

  /* Guardar o reemplazar un registro */
  E.put = async (col, id, data) => {
    E.S[col] = Object.assign({}, E.S[col], { [id]: data });
    onChange();
    if (Store.mode === "supabase") await remoteWrite(async () => sbCheck(await Store.sb.from("registros").upsert({ coleccion: col, id, data })));
    else if (Store.mode === "archivo") await remoteWrite(() => serverSave({ col, id, data }));
    else saveLocal();
  };
  /* Borrar un registro */
  E.del = async (col, id) => {
    const c = Object.assign({}, E.S[col]); delete c[id]; E.S[col] = c;
    onChange();
    if (Store.mode === "supabase") await remoteWrite(async () => sbCheck(await Store.sb.from("registros").delete().eq("coleccion", col).eq("id", id)));
    else if (Store.mode === "archivo") await remoteWrite(() => serverSave({ col, id, borrar: true }));
    else saveLocal();
  };
  E.ready = () => Store.loaded.size === E.COLECCIONES.length;

  async function purgeExamples() {
    for (const col of ["ventas", "gastos", "items"]) for (const [id, d] of Object.entries(E.S[col])) if (d && d.ejemplo) await E.del(col, id);
  }

  /* ---------- Nube con usuarios (Supabase) ---------- */
  async function cargarNube() {
    const sb = Store.sb, nuevo = vacio();
    for (let desde = 0; ; desde += 1000) {
      const res = await sb.from("registros").select("coleccion,id,data").order("coleccion").order("id").range(desde, desde + 999);
      if (res.error) throw res.error;
      res.data.forEach(r => { if (nuevo[r.coleccion]) nuevo[r.coleccion][r.id] = r.data; });
      if (res.data.length < 1000) break;
    }
    E.COLECCIONES.forEach(c => { E.S[c] = nuevo[c]; Store.loaded.add(c); });
  }
  let canal = null;
  function escucharCambios() {
    if (canal) return;
    // Lo que registre otro usuario aparece aquí al instante
    canal = Store.sb.channel("registros-en-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "registros" }, p => {
        if (p.eventType === "DELETE") {
          const o = p.old || {}; if (!E.S[o.coleccion] || !(o.id in E.S[o.coleccion])) return;
          const c = Object.assign({}, E.S[o.coleccion]); delete c[o.id]; E.S[o.coleccion] = c;
        } else {
          const r = p.new || {}; if (!E.S[r.coleccion]) return;
          E.S[r.coleccion] = Object.assign({}, E.S[r.coleccion], { [r.id]: r.data });
        }
        onChange();
      })
      .subscribe();
  }
  /* Se llama después de iniciar sesión */
  E.entrarNube = async () => {
    Store.mode = "supabase"; setStatus();
    await cargarNube();
    escucharCambios();
    setStatus(); onChange();
  };
  /* Cada 2 minutos vuelve a leer todo, por si se perdió algún aviso en vivo */
  setInterval(() => { if (Store.mode === "supabase" && E.yo && !Store.pending && document.visibilityState === "visible") cargarNube().then(onChange).catch(() => {}); }, 120000);

  /* ---------- Arranque ---------- */
  E.startStorage = async cb => {
    onChange = cb; setStatus();

    // 1) Nube con usuarios
    if (E.NUBE && E.NUBE.url && window.supabase && window.supabase.createClient) {
      Store.sb = window.supabase.createClient(E.NUBE.url, E.NUBE.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
      Store.mode = "supabase";
      await E.iniciarAcceso(); // js/acceso.js: muestra el inicio de sesión o entra directo
      return;
    }

    // 2) Programa de Python (servidor.py)
    if (location.protocol.startsWith("http")) {
      try {
        const r = await fetch("api/datos", { cache: "no-store" });
        if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
          const o = await r.json();
          Store.mode = "archivo"; Store.archivo = o.archivo || "";
          E.COLECCIONES.forEach(c => { if (o.data && o.data[c] && typeof o.data[c] === "object") E.S[c] = o.data[c]; });
          E.COLECCIONES.forEach(c => Store.loaded.add(c));
          setStatus(); onChange();
          await purgeExamples();
          return;
        }
      } catch (e) { /* no hay servidor: seguimos al navegador */ }
    }

    // 3) Este navegador
    Store.mode = "local";
    const o = readLocal();
    if (o) E.COLECCIONES.forEach(c => { if (o[c] && typeof o[c] === "object") E.S[c] = o[c]; });
    else saveLocal();
    E.COLECCIONES.forEach(c => Store.loaded.add(c));
    setStatus(); onChange();
    await purgeExamples();
  };

  /* Borrar todo (empezar de cero) */
  E.borrarTodo = async () => {
    for (const col of ["ventas", "gastos", "items", "cierres"]) for (const id of Object.keys(E.S[col])) await E.del(col, id);
  };
})();

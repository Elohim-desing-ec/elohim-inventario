/* =========================================================
   ELOHIM INVENTARIO · SECCIÓN 6: USUARIOS (solo administrador)
   Crear usuarios con contraseña para las personas que
   trabajan contigo, cambiar contraseñas, desactivar y borrar.
   ========================================================= */
(function () {
  "use strict";
  const { $, esc, fdate } = E;
  E.views = E.views || {}; E.acts = E.acts || {};
  let lista = null, cargando = false, claveId = null;

  async function cargar() {
    if (cargando) return; cargando = true;
    try { lista = (await E.llamarUsuarios("listar")).usuarios || []; }
    catch (e) { E.toast(e.message, true); lista = lista || []; }
    finally { cargando = false; E.render(); }
  }
  const esAdmin = () => E.yo && E.yo.rol === "admin";

  E.views.usuarios = {
    init() {
      $("#formUsuario").addEventListener("submit", async e => {
        e.preventDefault();
        const form = e.target; E.clearErr(form);
        const nombre = $("#uNombre").value.trim(), usuario = $("#uUsuario").value.trim().toLowerCase(), password = $("#uClave").value, rol = $("#uRol").value;
        let ok = true;
        if (!nombre) { E.fieldErr("uNombre", "Escribe el nombre de la persona."); ok = false; }
        if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) { E.fieldErr("uUsuario", "De 3 a 30 letras minúsculas o números, sin espacios (puede llevar punto o guion)."); ok = false; }
        if (password.length < 8) { E.fieldErr("uClave", "Mínimo 8 caracteres."); ok = false; }
        if (!ok) return;
        const btn = $("#uGuardar"); btn.disabled = true;
        try {
          await E.llamarUsuarios("crear", { nombre, usuario, password, rol });
          form.reset(); $("#uRol").value = "empleado";
          E.toast(`Usuario creado: ${usuario}. Pásale su usuario y contraseña.`);
          await cargar();
        } catch (err) { E.toast(err.message, true); }
        finally { btn.disabled = false; }
      });
      $("#formClave").addEventListener("submit", async e => {
        e.preventDefault(); E.clearErr(e.target);
        const p = $("#nuevaClave").value;
        if (p.length < 8) { E.fieldErr("nuevaClave", "Mínimo 8 caracteres."); return; }
        try { await E.llamarUsuarios("actualizar", { id: claveId, password: p }); $("#dlgClave").close(); E.toast("Contraseña cambiada"); }
        catch (err) { E.toast(err.message, true); }
      });
      $("#usuTabla").addEventListener("change", async e => {
        const t = e.target; if (!t.dataset.rolDe) return;
        try { await E.llamarUsuarios("actualizar", { id: t.dataset.rolDe, rol: t.value }); E.toast("Rol cambiado"); }
        catch (err) { E.toast(err.message, true); }
        await cargar();
      });
    },

    render() {
      if (!esAdmin()) { $("#usuTabla").innerHTML = `<div class="notice">Solo el administrador puede ver esta sección.</div>`; return; }
      if (lista === null) { $("#usuTabla").innerHTML = `<p class="muted">Cargando usuarios…</p>`; cargar(); return; }
      const cols = [
        { key: "nombre", label: "Nombre", cls: "cell-head", html: r => `<span><b>${esc(r.nombre)}</b>${r.id === E.yo.id ? ` <span class="pill pill--accent">Tú</span>` : ""}<span class="sub">Usuario: ${esc(r.usuario)}</span></span><span class="only-mobile">${r.activo ? `<span class="pill pill--ok">Activo</span>` : `<span class="pill pill--bad">Desactivado</span>`}</span>` },
        { key: "usuario", label: "Usuario", cls: "hide-mobile", html: r => `<span class="code">${esc(r.usuario)}</span>` },
        { key: "rol", label: "Rol", html: r => r.id === E.yo.id ? "Administrador" : `<select class="estado" data-rol-de="${r.id}" aria-label="Rol de ${esc(r.nombre)}"><option value="empleado" ${r.rol === "empleado" ? "selected" : ""}>Empleado</option><option value="admin" ${r.rol === "admin" ? "selected" : ""}>Administrador</option></select>` },
        { key: "activo", label: "Estado", cls: "hide-mobile", val: r => r.activo ? 1 : 0, html: r => r.activo ? `<span class="pill pill--ok">Activo</span>` : `<span class="pill pill--bad">Desactivado</span>` },
        { key: "creado", label: "Creado", html: r => fdate(r.creado) },
        { key: "_a", label: "Acciones", sort: false, cls: "cell-actions", html: r => `<div class="row-actions"><button class="link-btn" type="button" data-act="cambiarClave" data-id="${r.id}" data-nombre="${esc(r.nombre)}">Cambiar contraseña</button>${r.id === E.yo.id ? "" : `<button class="link-btn" type="button" data-act="activarUsuario" data-id="${r.id}" data-activo="${r.activo ? "0" : "1"}">${r.activo ? "Desactivar" : "Activar"}</button><button class="link-btn link-btn--danger" type="button" data-act="eliminarUsuario" data-id="${r.id}" data-nombre="${esc(r.nombre)}">Eliminar</button>`}</div>` }
      ];
      $("#usuTabla").innerHTML = E.table("usu", cols, lista, { empty: "Todavía no hay usuarios." });
    }
  };

  E.acts.cambiarClave = b => {
    claveId = b.dataset.id;
    $("#clTitulo").textContent = "Nueva contraseña para " + b.dataset.nombre;
    $("#nuevaClave").value = ""; E.clearErr($("#formClave"));
    $("#dlgClave").showModal();
  };
  E.acts.activarUsuario = async b => {
    const activar = b.dataset.activo === "1";
    try { await E.llamarUsuarios("actualizar", { id: b.dataset.id, activo: activar }); E.toast(activar ? "Usuario activado" : "Usuario desactivado: ya no puede entrar"); }
    catch (err) { E.toast(err.message, true); }
    await cargar();
  };
  E.acts.eliminarUsuario = async b => {
    const ok = await E.ask("Eliminar a " + b.dataset.nombre, "Ya no podrá entrar. Las ventas y registros que hizo se conservan.<br><br>Si solo quieres quitarle el acceso por un tiempo, mejor usa «Desactivar».", [{ l: "Eliminar usuario", v: "si", cls: "btn--danger" }]);
    if (!ok) return;
    try { await E.llamarUsuarios("eliminar", { id: b.dataset.id }); E.toast("Usuario eliminado"); }
    catch (err) { E.toast(err.message, true); }
    await cargar();
  };
})();

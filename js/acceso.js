/* =========================================================
   ELOHIM INVENTARIO · INICIO DE SESIÓN
   Usuario y contraseña. La primera vez pide crear al
   administrador. Los demás usuarios los crea el administrador
   en la sección Usuarios.
   ========================================================= */
(function () {
  "use strict";
  const { $ } = E;
  E.yo = null;

  const sb = () => E.Store.sb;
  const correo = usuario => { const u = String(usuario || "").trim().toLowerCase(); return u.includes("@") ? u : `${u}@${E.NUBE.dominio}`; };

  function error(msg) { const el = $("#accError"); el.hidden = !msg; el.textContent = msg || ""; }
  function ocupado(form, si) { E.$$("button, input", form).forEach(el => { el.disabled = si; }); }

  /* Llama a la función "usuarios" del servidor (crear, listar, cambiar…) */
  E.llamarUsuarios = async (accion, datos) => {
    const { data } = await sb().auth.getSession();
    const token = data && data.session ? data.session.access_token : E.NUBE.anonKey;
    const r = await fetch(`${E.NUBE.url}/functions/v1/usuarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: E.NUBE.anonKey, Authorization: "Bearer " + token },
      body: JSON.stringify(Object.assign({ accion }, datos || {}))
    });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || "No se pudo completar. Revisa tu conexión.");
    return j;
  };

  async function cargarPerfil() {
    const { data } = await sb().auth.getUser();
    const user = data && data.user; if (!user) return "sin-sesion";
    const res = await sb().from("perfiles").select("id,usuario,nombre,rol,activo").eq("id", user.id).maybeSingle();
    if (!res.data || !res.data.activo) { await sb().auth.signOut(); return "desactivado"; }
    E.yo = res.data;
    return "ok";
  }

  async function entrar() {
    document.body.classList.remove("is-locked");
    $("#acceso").hidden = true;
    $("#userChip").hidden = false;
    $("#userNombre").textContent = E.yo.nombre + (E.yo.rol === "admin" ? " · Administrador" : "");
    E.$$('[data-nav="usuarios"]').forEach(a => { a.hidden = E.yo.rol !== "admin"; });
    try { await E.entrarNube(); }
    catch (e) { E.toast("No se pudieron cargar los datos. Revisa tu conexión y recarga la página.", true); }
    E.showPage && E.showPage();
  }

  /* Muestra la pantalla de inicio de sesión (o la de crear administrador) */
  E.mostrarAcceso = async msg => {
    document.body.classList.add("is-locked");
    $("#acceso").hidden = false; $("#userChip").hidden = true;
    error(msg || "");
    let primera = false;
    try { primera = (await E.llamarUsuarios("estado")).necesitaAdmin; } catch (e) { error("No hay conexión con la base de datos. Revisa tu internet y recarga la página."); }
    $("#formEntrar").hidden = primera; $("#formPrimerAdmin").hidden = !primera;
    $("#accTitulo").innerHTML = primera ? 'Crea tu cuenta de <span class="serif">administrador</span>' : 'Inicia <span class="serif">sesión</span>';
    $("#accTexto").textContent = primera
      ? "Es la primera vez que se abre el inventario. Crea tu usuario: tú serás el administrador y podrás crear usuarios para las personas que trabajan contigo."
      : "Entra con el usuario y la contraseña que te dio el administrador.";
    setTimeout(() => { const f = primera ? $("#paNombre") : $("#accUsuario"); if (f) f.focus(); }, 50);
  };

  E.iniciarAcceso = async () => {
    sb().auth.onAuthStateChange(ev => { if (ev === "SIGNED_OUT" && E.yo) location.reload(); });
    const { data } = await sb().auth.getSession();
    if (data && data.session) {
      const r = await cargarPerfil().catch(() => "error");
      if (r === "ok") return entrar();
      return E.mostrarAcceso(r === "desactivado" ? "Tu usuario está desactivado. Habla con el administrador." : "");
    }
    return E.mostrarAcceso();
  };

  async function iniciarSesion(usuario, password) {
    const res = await sb().auth.signInWithPassword({ email: correo(usuario), password });
    if (res.error) {
      const m = res.error.message || "";
      throw new Error(/banned/i.test(m) ? "Tu usuario está desactivado. Habla con el administrador." : /invalid/i.test(m) ? "Usuario o contraseña incorrectos." : "No se pudo entrar: " + m);
    }
    const r = await cargarPerfil();
    if (r !== "ok") throw new Error(r === "desactivado" ? "Tu usuario está desactivado. Habla con el administrador." : "No se pudo entrar. Intenta de nuevo.");
  }

  $("#formEntrar").addEventListener("submit", async e => {
    e.preventDefault(); error("");
    const u = $("#accUsuario").value.trim(), p = $("#accClave").value;
    if (!u || !p) { error("Escribe tu usuario y tu contraseña."); return; }
    ocupado(e.target, true);
    try { await iniciarSesion(u, p); $("#accClave").value = ""; await entrar(); }
    catch (err) { error(err.message); }
    finally { ocupado(e.target, false); }
  });
  $("#formPrimerAdmin").addEventListener("submit", async e => {
    e.preventDefault(); error("");
    const nombre = $("#paNombre").value.trim(), usuario = $("#paUsuario").value.trim().toLowerCase(), p1 = $("#paClave").value, p2 = $("#paClave2").value;
    if (!nombre) return error("Escribe tu nombre.");
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return error("El usuario debe tener de 3 a 30 letras minúsculas o números, sin espacios (puede llevar punto o guion).");
    if (p1.length < 8) return error("La contraseña debe tener al menos 8 caracteres.");
    if (p1 !== p2) return error("Las contraseñas no coinciden.");
    ocupado(e.target, true);
    try { await E.llamarUsuarios("inicializar", { nombre, usuario, password: p1 }); await iniciarSesion(usuario, p1); await entrar(); E.toast("Bienvenido, " + nombre); }
    catch (err) { error(err.message); }
    finally { ocupado(e.target, false); }
  });

  E.acts = E.acts || {};
  E.acts.salir = async () => { E.yo = null; await sb().auth.signOut(); location.hash = "#resumen"; location.reload(); };
})();

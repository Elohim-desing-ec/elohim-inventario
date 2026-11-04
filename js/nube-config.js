/* =========================================================
   ELOHIM INVENTARIO · CONEXIÓN A LA NUBE (Supabase)
   Con esto la app pide usuario y contraseña, y todos los
   usuarios ven los mismos datos.
   La clave "anon" es pública a propósito: los datos están
   protegidos por las reglas de la base de datos (solo entran
   usuarios activos creados por el administrador).
   Para volver a guardar solo en el navegador, deja url vacío.
   ========================================================= */
window.E = window.E || {};
E.NUBE = {
  url: "https://kucrypxgjptsdjxsmvce.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Y3J5cHhnanB0c2RqeHNtdmNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3OTk5NTksImV4cCI6MjEwOTM3NTk1OX0.64ZWNzo2ncHF_X31A3kbCC-JMRAJgJN1KXZcmnOm3VE",
  dominio: "elohim-inventario.app" // los usuarios entran con un nombre; por dentro es nombre@dominio
};

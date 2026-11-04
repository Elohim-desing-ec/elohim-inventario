#!/usr/bin/env python3
"""
ELOHIM INVENTARIO · programa de Python
=======================================
Abre la app en tu navegador y guarda TODO en un archivo de tu computadora:
    datos/elohim-datos.json        (se guarda solo con cada cambio)
    datos/respaldos/               (una copia de seguridad por día)

Cómo usarlo (en la Terminal, dentro de esta carpeta):
    python3 servidor.py                  abre la app
    python3 servidor.py --red            también desde tu celular (misma Wi-Fi)
    python3 servidor.py --reporte 2027   ventas, gastos y ganancia mes a mes
    python3 servidor.py --reporte 2027 1 solo enero de 2027
    python3 servidor.py --stock          inventario actual
    python3 servidor.py --reporte 2027 --archivo elohim-respaldo-2027-12-31.json
                                         reporte con un respaldo exportado de la app

O simplemente haz doble clic en «Abrir inventario.command».
Solo usa la biblioteca estándar de Python 3 (no hay que instalar nada).
"""
import argparse
import datetime
import json
import os
import re
import shutil
import socket
import sys
import tempfile
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

AQUI = os.path.dirname(os.path.abspath(__file__))
DATOS_DIR = os.path.join(AQUI, "datos")
ARCHIVO = os.path.join(DATOS_DIR, "elohim-datos.json")
RESPALDOS = os.path.join(DATOS_DIR, "respaldos")
COLECCIONES = ["items", "ventas", "gastos", "cierres", "config"]
TIPOS_INICIO = ["Camiseta oversize", "Camiseta regular fit", "Camiseta acid wash", "Gorra"]
MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
         "Septiembre", "Octubre", "Noviembre", "Diciembre"]
STOCK_BAJO = 3
ID_VALIDO = re.compile(r"^[A-Za-z0-9_\-.~:@+]{1,200}$")
MAX_CUERPO = 5 * 1024 * 1024
RESPALDOS_A_GUARDAR = 90

candado = threading.Lock()


# ----------------------------------------------------------------------
# Archivo de datos
# ----------------------------------------------------------------------
def vacio():
    d = {c: {} for c in COLECCIONES}
    d["config"] = {"main": {"tipos": list(TIPOS_INICIO)}}
    return d


def leer():
    if not os.path.exists(ARCHIVO):
        return vacio()
    with open(ARCHIVO, encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d.get("data"), dict):  # respaldo exportado desde la app (Datos → Exportar respaldo)
        d = d["data"]
    for c in COLECCIONES:
        if not isinstance(d.get(c), dict):
            d[c] = {}
    if not d["config"].get("main"):
        d["config"]["main"] = {"tipos": list(TIPOS_INICIO)}
    return d


def respaldo_diario():
    """Guarda una copia del archivo una vez al día (antes del primer cambio)."""
    if not os.path.exists(ARCHIVO):
        return
    os.makedirs(RESPALDOS, exist_ok=True)
    destino = os.path.join(RESPALDOS, f"elohim-{datetime.date.today().isoformat()}.json")
    if not os.path.exists(destino):
        shutil.copy2(ARCHIVO, destino)
        viejos = sorted(f for f in os.listdir(RESPALDOS) if f.endswith(".json"))
        for f in viejos[:-RESPALDOS_A_GUARDAR]:
            os.remove(os.path.join(RESPALDOS, f))


def escribir(d):
    """Escritura segura: primero a un archivo temporal y luego se reemplaza."""
    os.makedirs(DATOS_DIR, exist_ok=True)
    respaldo_diario()
    fd, tmp = tempfile.mkstemp(dir=DATOS_DIR, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=1)
    os.replace(tmp, ARCHIVO)


# ----------------------------------------------------------------------
# Cálculos (las mismas fórmulas que la app)
# ----------------------------------------------------------------------
def num(v):
    try:
        return float(str(v).replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def r2(x):
    return round(x + (1e-9 if x >= 0 else -1e-9), 2)


def ventas_calculadas(d):
    """Total venta = cantidad × precio − descuento; costo = cantidad × costo unitario."""
    out = []
    for vid, v in d["ventas"].items():
        cant, precio, desc, costo_u = num(v.get("cantidad")), num(v.get("precio")), num(v.get("descuento")), num(v.get("costo"))
        total = r2(cant * precio - desc)
        costo = r2(cant * costo_u)
        out.append({"id": vid, "fecha": str(v.get("fecha", "")), "codigo": v.get("codigo", ""), "cantidad": cant,
                    "total": total, "costo": costo, "ganancia": r2(total - costo),
                    "activa": v.get("estado") != "Cancelado"})
    return out


def stock_actual(d):
    vendidas = {}
    for s in ventas_calculadas(d):
        if s["activa"]:
            vendidas[s["codigo"]] = vendidas.get(s["codigo"], 0) + s["cantidad"]
    filas = []
    for it in d["items"].values():
        repuesto = sum(num(r.get("cantidad")) for r in it.get("reposiciones", []) or [])
        vend = vendidas.get(it.get("codigo"), 0)
        stock = num(it.get("stockInicial")) + repuesto - vend
        costo, precio = num(it.get("costo")), num(it.get("precio"))
        filas.append({"codigo": it.get("codigo", ""), "tipo": it.get("tipo", ""), "talla": it.get("talla", ""),
                      "color": it.get("color", ""), "vendidas": vend, "stock": stock,
                      "ganancia_unidad": r2(precio - costo), "margen": (precio - costo) / precio if precio else 0,
                      "valor": r2(max(stock, 0) * costo),
                      "estado": "Agotado" if stock <= 0 else "Stock bajo" if stock <= STOCK_BAJO else "OK"})
    return sorted(filas, key=lambda f: f["codigo"])


def resumen(d, anio, mes=None):
    """mes: 1-12, o None para todo el año. Las ventas canceladas no cuentan."""
    def en_periodo(fecha):
        return fecha[:4] == str(anio) and (mes is None or fecha[5:7] == f"{mes:02d}")
    ss = [s for s in ventas_calculadas(d) if s["activa"] and en_periodo(s["fecha"])]
    ventas = r2(sum(s["total"] for s in ss))
    costo = r2(sum(s["costo"] for s in ss))
    gastos = r2(sum(num(g.get("monto")) for g in d["gastos"].values() if en_periodo(str(g.get("fecha", "")))))
    bruta = r2(ventas - costo)
    neta = r2(bruta - gastos)
    return {"anio": anio, "mes": mes, "ventas": ventas, "costo": costo, "bruta": bruta, "gastos": gastos,
            "neta": neta, "margen": (neta / ventas) if ventas else 0,
            "unidades": int(sum(s["cantidad"] for s in ss))}


# ----------------------------------------------------------------------
# Servidor web local
# ----------------------------------------------------------------------
class Manejador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=AQUI, **kw)

    def log_message(self, fmt, *args):  # sin ruido en la Terminal
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def responder(self, codigo, obj):
        cuerpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/datos":
            with candado:
                d = leer()
            return self.responder(200, {"archivo": os.path.relpath(ARCHIVO, AQUI), "data": d})
        if url.path == "/api/resumen":
            q = parse_qs(url.query)
            try:
                anio = int(q.get("anio", [datetime.date.today().year])[0])
                mes = int(q["mes"][0]) if q.get("mes") and q["mes"][0] not in ("", "-1") else None
            except ValueError:
                return self.responder(400, {"error": "anio o mes inválido"})
            with candado:
                d = leer()
            return self.responder(200, {"total": resumen(d, anio, mes),
                                        "meses": [resumen(d, anio, m) for m in range(1, 13)]})
        if url.path.startswith("/datos") or url.path.endswith(".py"):
            return self.responder(403, {"error": "privado"})
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/api/guardar":
            return self.responder(404, {"error": "no existe"})
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self.responder(415, {"error": "se esperaba JSON"})
        largo = int(self.headers.get("Content-Length") or 0)
        if largo <= 0 or largo > MAX_CUERPO:
            return self.responder(413, {"error": "tamaño inválido"})
        try:
            cuerpo = json.loads(self.rfile.read(largo).decode("utf-8"))
            col, rid = cuerpo["col"], str(cuerpo["id"])
        except (ValueError, KeyError, TypeError):
            return self.responder(400, {"error": "datos inválidos"})
        if col not in COLECCIONES or not ID_VALIDO.match(rid):
            return self.responder(400, {"error": "colección o id inválido"})
        with candado:
            d = leer()
            if cuerpo.get("borrar"):
                d[col].pop(rid, None)
            elif isinstance(cuerpo.get("data"), dict):
                d[col][rid] = cuerpo["data"]
            else:
                return self.responder(400, {"error": "falta data"})
            escribir(d)
        return self.responder(200, {"ok": True})


def ip_local():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # no envía nada; solo elige la red
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def iniciar(red=False, puerto=8787, abrir=True):
    host = "0.0.0.0" if red else "127.0.0.1"
    servidor = None
    for p in range(puerto, puerto + 20):
        try:
            servidor = ThreadingHTTPServer((host, p), Manejador)
            puerto = p
            break
        except OSError:
            continue
    if not servidor:
        sys.exit("No encontré un puerto libre. Cierra otras ventanas del inventario e intenta de nuevo.")
    url = f"http://127.0.0.1:{puerto}/"
    print("\n  ELOHIM · Inventario")
    print("  -------------------")
    print(f"  Abierto en:        {url}")
    if red:
        ip = ip_local()
        if ip:
            print(f"  Desde tu celular:  http://{ip}:{puerto}/   (misma Wi-Fi)")
    print(f"  Tus datos:         {ARCHIVO}")
    print("\n  Deja esta ventana abierta mientras usas la app. Para cerrar: Ctrl + C\n")
    if abrir:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\n  Inventario cerrado. Tus datos están guardados.\n")


# ----------------------------------------------------------------------
# Reportes en la Terminal
# ----------------------------------------------------------------------
def dinero(x):
    return f"-${abs(x):,.2f}" if x < 0 else f"${x:,.2f}"


def imprimir_reporte(anio, mes=None):
    d = leer()
    filas = [resumen(d, anio, mes)] if mes else [resumen(d, anio, m) for m in range(1, 13)]
    total = resumen(d, anio, None)
    print(f"\n  ELOHIM · Resumen {MESES[mes - 1] + ' ' if mes else ''}{anio}\n")
    print(f"  {'Mes':<11}{'Ventas':>12}{'Costo':>12}{'Gastos':>12}{'Neta':>12}{'Margen':>9}{'Uds':>6}")
    print("  " + "-" * 74)
    for f in filas:
        print(f"  {MESES[f['mes'] - 1]:<11}{dinero(f['ventas']):>12}{dinero(f['costo']):>12}{dinero(f['gastos']):>12}"
              f"{dinero(f['neta']):>12}{f['margen'] * 100:>8.1f}%{f['unidades']:>6}")
    if not mes:
        print("  " + "-" * 74)
        print(f"  {'Total':<11}{dinero(total['ventas']):>12}{dinero(total['costo']):>12}{dinero(total['gastos']):>12}"
              f"{dinero(total['neta']):>12}{total['margen'] * 100:>8.1f}%{total['unidades']:>6}")
    print()


def imprimir_stock():
    filas = stock_actual(leer())
    print("\n  ELOHIM · Inventario actual\n")
    if not filas:
        print("  Todavía no hay prendas registradas.\n")
        return
    print(f"  {'Código':<10}{'Prenda':<24}{'Talla':<7}{'Color':<10}{'Stock':>6}{'Valor':>11}  Estado")
    print("  " + "-" * 78)
    for f in filas:
        print(f"  {f['codigo']:<10}{f['tipo'][:23]:<24}{f['talla']:<7}{f['color'][:9]:<10}{int(f['stock']):>6}{dinero(f['valor']):>11}  {f['estado']}")
    print("  " + "-" * 78)
    print(f"  {'Total':<51}{int(sum(max(f['stock'], 0) for f in filas)):>6}{dinero(sum(f['valor'] for f in filas)):>11}\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="ELOHIM Inventario")
    ap.add_argument("--red", action="store_true", help="permitir abrir desde el celular en la misma Wi-Fi")
    ap.add_argument("--puerto", type=int, default=8787)
    ap.add_argument("--no-abrir", action="store_true", help="no abrir el navegador automáticamente")
    ap.add_argument("--reporte", nargs="+", type=int, metavar=("AÑO", "MES"), help="resumen del año (y mes 1-12)")
    ap.add_argument("--stock", action="store_true", help="mostrar el inventario actual")
    ap.add_argument("--archivo", help="usar un respaldo exportado de la app en vez de datos/elohim-datos.json")
    a = ap.parse_args()
    if a.archivo:
        ARCHIVO = os.path.abspath(a.archivo)
        if not os.path.exists(ARCHIVO):
            sys.exit(f"No encontré el archivo {ARCHIVO}")
    if a.reporte:
        anio = a.reporte[0]
        mes = a.reporte[1] if len(a.reporte) > 1 else None
        if mes is not None and not 1 <= mes <= 12:
            sys.exit("El mes debe ser un número del 1 al 12.")
        imprimir_reporte(anio, mes)
    elif a.stock:
        imprimir_stock()
    else:
        iniciar(red=a.red, puerto=a.puerto, abrir=not a.no_abrir)

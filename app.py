import csv
import hmac
import io
import json
import os
import threading
import time
import urllib.request
from collections import defaultdict, deque
from html import escape

from flask import (Flask, Response, abort, jsonify, redirect, render_template,
                   request, send_from_directory, session, url_for)
from werkzeug.middleware.proxy_fix import ProxyFix

import db

app = Flask(__name__, static_folder="public", static_url_path="")
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)  # Railway fica atrás de um proxy
app.secret_key = os.environ.get("SECRET_KEY", "dev-troque-em-producao")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax",
                  SESSION_COOKIE_SECURE=bool(os.environ.get("RAILWAY_ENVIRONMENT")))

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

db.init()

_hits = defaultdict(deque)  # ip -> horários dos últimos envios


def rate_limited(ip, limit=5, window=600):
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        return True
    q.append(now)
    return False


def notify_telegram(lead_id, nome, telefone, email, utm, pagina):
    if not (TELEGRAM_TOKEN and TELEGRAM_CHAT_ID):
        return
    ddd_tel = telefone if telefone.startswith("55") else "55" + telefone
    fmt = f"({telefone[:2]}) {telefone[2:-4]}-{telefone[-4:]}" if len(telefone) >= 10 else telefone
    linhas = [
        "🔔 <b>Novo lead – Magnólias II</b>",
        f"👤 {escape(nome)}",
        f'📞 <a href="https://wa.me/{ddd_tel}">{escape(fmt)}</a>',
        f"✉️ {escape(email)}",
        f"📍 Origem: {escape(utm) if utm else 'direto / sem campanha'}",
    ]
    painel = os.environ.get("PUBLIC_URL", "").rstrip("/")
    if painel:
        linhas.append(f'🗂 <a href="{painel}/painel">Abrir painel</a>')
    body = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": "\n".join(linhas),
                       "parse_mode": "HTML", "disable_web_page_preview": True}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage", data=body,
        headers={"Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except Exception as exc:  # o lead já está salvo; só registra a falha
        app.logger.error("Falha ao avisar no Telegram (lead %s): %s", lead_id, exc)


@app.after_request
def seo_headers(resp):
    if request.path.startswith(("/painel", "/api/")):
        resp.headers["X-Robots-Tag"] = "noindex, nofollow"
    elif request.path.startswith(("/images/", "/fonts/")):
        resp.headers["Cache-Control"] = "public, max-age=604800"  # 7 dias
    return resp


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/lead", methods=["POST"])
def lead():
    data = request.get_json(silent=True) or {}
    if data.get("website"):  # campo-armadilha: só robôs preenchem
        return jsonify(ok=True)

    nome = " ".join(str(data.get("nome", "")).split())[:120]
    email = str(data.get("email", "")).strip()[:120]
    telefone = "".join(c for c in str(data.get("telefone", "")) if c.isdigit())[:11]
    utm = str(data.get("utm", "")).strip()[:300]
    pagina = str(data.get("page", "")).strip()[:300]

    if not nome or "@" not in email or len(telefone) not in (10, 11):
        return jsonify(ok=False, erro="dados inválidos"), 400
    if rate_limited(request.remote_addr):
        return jsonify(ok=False, erro="muitas tentativas"), 429

    lead_id = db.insert_lead(nome, email, telefone, utm, pagina)
    threading.Thread(target=notify_telegram,
                     args=(lead_id, nome, telefone, email, utm, pagina), daemon=True).start()
    return jsonify(ok=True)


# ---------- Painel ----------

def logged_in():
    return session.get("admin") is True


@app.route("/painel/login", methods=["GET", "POST"])
def login():
    erro = False
    if request.method == "POST":
        senha = request.form.get("senha", "")
        if ADMIN_PASSWORD and hmac.compare_digest(senha.encode(), ADMIN_PASSWORD.encode()):
            session["admin"] = True
            session.permanent = True
            return redirect(url_for("painel"))
        erro = True
    return render_template("painel/login.html", erro=erro, sem_senha=not ADMIN_PASSWORD)


@app.route("/painel/sair")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/painel")
def painel():
    if not logged_in():
        return redirect(url_for("login"))
    status = request.args.get("status", "")
    busca = request.args.get("q", "").strip()
    return render_template("painel/lista.html", leads=db.list_leads(status, busca),
                           contagem=db.count_by_status(), statuses=db.STATUSES,
                           status=status, busca=busca)


@app.route("/painel/lead/<int:lead_id>", methods=["POST"])
def atualizar(lead_id):
    if not logged_in():
        abort(403)
    db.update_lead(lead_id, request.form.get("status", ""), request.form.get("obs", ""))
    return redirect(request.referrer or url_for("painel"))


@app.route("/painel/leads.csv")
def exportar():
    if not logged_in():
        abort(403)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["data", "nome", "email", "telefone", "status", "origem", "obs"])
    for r in db.list_leads():
        w.writerow([r["criado_em"], r["nome"], r["email"], r["telefone"], r["status"], r["utm"], r["obs"]])
    return Response("﻿" + buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=leads.csv"})


if __name__ == "__main__":
    app.run(debug=True)

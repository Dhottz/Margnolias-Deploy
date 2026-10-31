"""Acesso ao banco: Postgres no Railway (DATABASE_URL) ou SQLite no computador."""
import os
import sqlite3
from contextlib import contextmanager

DATABASE_URL = os.environ.get("DATABASE_URL", "")
SQLITE_PATH = os.environ.get("LEADS_DB", os.path.join(os.path.dirname(__file__), "leads.db"))
USE_PG = DATABASE_URL.startswith("postgres")

STATUSES = ["novo", "contatado", "negociando", "fechado", "descartado"]

if USE_PG:
    import psycopg
    from psycopg.rows import dict_row

SCHEMA_PG = """
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    utm TEXT NOT NULL DEFAULT '',
    pagina TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'novo',
    obs TEXT NOT NULL DEFAULT '',
    criado_em TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'America/Sao_Paulo')
)"""

SCHEMA_SQLITE = """
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT NOT NULL,
    utm TEXT NOT NULL DEFAULT '',
    pagina TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'novo',
    obs TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now', '-3 hours'))
)"""


@contextmanager
def connect():
    if USE_PG:
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _q(sql):
    return sql.replace("?", "%s") if USE_PG else sql


def execute(sql, params=()):
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(_q(sql), params)
        return cur


def init():
    with connect() as conn:
        conn.cursor().execute(SCHEMA_PG if USE_PG else SCHEMA_SQLITE)


def insert_lead(nome, email, telefone, utm, pagina):
    sql = "INSERT INTO leads (nome, email, telefone, utm, pagina) VALUES (?, ?, ?, ?, ?)"
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(_q(sql + (" RETURNING id" if USE_PG else "")), (nome, email, telefone, utm, pagina))
        return cur.fetchone()["id"] if USE_PG else cur.lastrowid


def list_leads(status=None, busca=None):
    sql, params = "SELECT * FROM leads WHERE 1=1", []
    if status in STATUSES:
        sql += " AND status = ?"
        params.append(status)
    if busca:
        sql += " AND (LOWER(nome) LIKE ? OR telefone LIKE ? OR LOWER(email) LIKE ?)"
        like = f"%{busca.lower()}%"
        params += [like, f"%{busca}%", like]
    sql += " ORDER BY id DESC LIMIT 1000"
    with connect() as conn:
        cur = conn.cursor()
        cur.execute(_q(sql), params)
        return [dict(r) for r in cur.fetchall()]


def count_by_status():
    with connect() as conn:
        cur = conn.cursor()
        cur.execute("SELECT status, COUNT(*) AS n FROM leads GROUP BY status")
        return {r["status"]: r["n"] for r in cur.fetchall()}


def update_lead(lead_id, status, obs):
    if status not in STATUSES:
        return
    execute("UPDATE leads SET status = ?, obs = ? WHERE id = ?", (status, obs[:1000], lead_id))

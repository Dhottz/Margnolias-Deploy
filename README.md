# Magnólias II
Site dos Terrenos Magnólias II: Flask serve o site (`public/`), salva os leads no Postgres, avisa no Telegram e tem um painel em `/painel`.

## Variáveis de ambiente (Railway → Variables)
| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Já vem ao adicionar o plugin Postgres (use "Add Reference") |
| `ADMIN_PASSWORD` | Senha do painel `/painel` |
| `SECRET_KEY` | Texto longo e aleatório (assina o login do painel) |
| `TELEGRAM_BOT_TOKEN` | Token do bot criado no @BotFather |
| `TELEGRAM_CHAT_ID` | ID do chat (ou grupo) que recebe os avisos |
| `PUBLIC_URL` | (opcional) endereço do site, p/ link do painel no aviso |

## Rodar no computador
```
pip install -r requirements.txt
python app.py
```
Sem `DATABASE_URL`, usa SQLite (`leads.db`). Sem as variáveis do Telegram, só não avisa.

## Hospedagem
- **Railway**: roda o Flask (API `/api/lead`, painel `/painel`, banco Postgres).
- **Vercel**: serve a pasta `public/` e repassa `/api/*` e `/painel/*` para o Railway (ver `vercel.json`).
  Troque `SEU-APP.up.railway.app` no `vercel.json` pelo endereço real do Railway.

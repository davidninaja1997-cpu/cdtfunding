/**
 * Actualiza assets/stats.json con datos reales del portafolio Elite de
 * copytrading en Bitget, vía la API de Cuenta Unificada (UTA v3):
 * https://www.bitget.com/api-doc/uta/copy/Elite-Trading-API-Guide
 *
 * Secretos requeridos (GitHub Actions): BITGET_API_KEY, BITGET_API_SECRET,
 * BITGET_API_PASSPHRASE — de la clave API Elite del portafolio (solo lectura).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY = process.env.BITGET_API_KEY;
const SECRET = process.env.BITGET_API_SECRET;
const PASSPHRASE = process.env.BITGET_API_PASSPHRASE;

if (!KEY || !SECRET || !PASSPHRASE) {
  console.log('Secretos BITGET_* no configurados — no se actualiza nada.');
  process.exit(0);
}

const BASE = 'https://api.bitget.com';

function sign(timestamp, method, requestPathWithQuery) {
  const prehash = timestamp + method.toUpperCase() + requestPathWithQuery;
  return crypto.createHmac('sha256', SECRET).update(prehash).digest('base64');
}

async function apiGet(pathWithQuery) {
  const ts = Date.now().toString();
  const res = await fetch(BASE + pathWithQuery, {
    headers: {
      'ACCESS-KEY': KEY,
      'ACCESS-SIGN': sign(ts, 'GET', pathWithQuery),
      'ACCESS-TIMESTAMP': ts,
      'ACCESS-PASSPHRASE': PASSPHRASE,
      'Content-Type': 'application/json',
      'locale': 'es-ES',
    },
  });
  const json = await res.json();
  console.log(`GET ${pathWithQuery}\n→ ${JSON.stringify(json).slice(0, 1500)}`);
  if (json.code !== '00000') throw new Error(`Bitget ${json.code}: ${json.msg}`);
  return json.data;
}

const num = (v) => { const n = parseFloat(v); return Number.isNaN(n) ? null : n; };

// ---- 1) Equity del portafolio ----
let equityUsdt = null;
try {
  const data = await apiGet('/api/v3/account/assets');
  const list = Array.isArray(data) ? data : (data?.list ?? (data ? [data] : []));
  for (const it of list) {
    const coin = String(it.coin ?? it.marginCoin ?? '').toUpperCase();
    const val = num(it.equity ?? it.usdtEquity ?? it.accountEquity ?? it.available ?? it.balance);
    if (val != null && (coin === 'USDT' || coin === '' || list.length === 1)) { equityUsdt = val; break; }
  }
  if (equityUsdt == null && data && !Array.isArray(data)) {
    equityUsdt = num(data.accountEquity ?? data.usdtEquity ?? data.equity);
  }
} catch (e) { console.log('assets:', e.message); }

// ---- 2) Posiciones cerradas (90 días) → win rate, operaciones, PnL ----
let winRate = null, trades90d = null, pnl90dUsdt = null;
try {
  const start = Date.now() - 90 * 24 * 3600 * 1000;
  let all = [];
  let cursor = '';
  for (let page = 0; page < 10; page++) {
    const qs = 'category=USDT-FUTURES&limit=100' + (cursor ? `&cursor=${cursor}` : '');
    const data = await apiGet(`/api/v3/position/history-position?${qs}`);
    const list = data?.list ?? [];
    if (!list.length) break;
    all = all.concat(list);
    cursor = data?.cursor ?? '';
    if (!cursor || list.length < 100) break;
  }
  const pnlOf = (p) => num(p.netProfit ?? p.pnl ?? p.realizedPnl ?? p.achievedProfits);
  const closed = all.filter((p) => {
    const t = num(p.updatedTime ?? p.uTime ?? p.ctime ?? p.createdTime) ?? 0;
    return t >= start && pnlOf(p) != null;
  });
  if (closed.length) {
    trades90d = closed.length;
    const wins = closed.filter((p) => pnlOf(p) > 0).length;
    winRate = Math.round((wins * 100) / trades90d);
    pnl90dUsdt = Math.round(closed.reduce((s, p) => s + pnlOf(p), 0) * 100) / 100;
  } else {
    console.log('Aún no hay posiciones cerradas en el portafolio (es nuevo).');
  }
} catch (e) { console.log('history-position:', e.message); }

const stats = {
  equityUsdt: equityUsdt != null ? Math.round(equityUsdt * 100) / 100 : null,
  winRate,
  trades90d,
  pnl90dUsdt,
  updatedAt: new Date().toISOString(),
};
fs.writeFileSync('assets/stats.json', JSON.stringify(stats, null, 2) + '\n');
console.log('assets/stats.json actualizado:', JSON.stringify(stats));

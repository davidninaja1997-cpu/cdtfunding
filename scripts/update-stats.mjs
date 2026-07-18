/**
 * Actualiza assets/stats.json con las estadísticas reales del perfil de
 * copytrading de Bitget, usando la API oficial (v2, futuros / mix-trader).
 *
 * Requiere 3 variables de entorno (configuradas como GitHub Secrets):
 *   BITGET_API_KEY, BITGET_API_SECRET, BITGET_API_PASSPHRASE
 * La API key solo necesita permiso de LECTURA (read-only).
 *
 * Calcula el win rate y el número de operaciones de los últimos 90 días
 * a partir del historial de órdenes del trader:
 *   GET /api/v2/copy/mix-trader/order-history-track
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY = process.env.BITGET_API_KEY;
const SECRET = process.env.BITGET_API_SECRET;
const PASSPHRASE = process.env.BITGET_API_PASSPHRASE;

if (!KEY || !SECRET || !PASSPHRASE) {
  console.log('Secretos BITGET_* no configurados todavía — no se actualizan las estadísticas.');
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
  // Log completo para poder diagnosticar el formato real de la respuesta
  console.log(`GET ${pathWithQuery}\n→ ${JSON.stringify(json).slice(0, 3000)}`);
  if (json.code !== '00000') {
    throw new Error(`Bitget API error ${json.code}: ${json.msg}`);
  }
  return json.data;
}

// ---- Historial de órdenes del trader (últimos 90 días, paginado) ----
const endTime = Date.now();
const startTime = endTime - 90 * 24 * 3600 * 1000;

let orders = [];
let idLessThan = '';
for (let page = 0; page < 20; page++) {
  const qs = `productType=USDT-FUTURES&startTime=${startTime}&endTime=${endTime}&limit=100` +
    (idLessThan ? `&idLessThan=${idLessThan}` : '');
  const data = await apiGet(`/api/v2/copy/mix-trader/order-history-track?${qs}`);
  const list = data?.trackingList ?? data?.list ?? (Array.isArray(data) ? data : []);
  if (!list || list.length === 0) break;
  orders = orders.concat(list);
  const last = list[list.length - 1];
  idLessThan = last?.trackingNo ?? last?.id ?? '';
  if (!idLessThan || list.length < 100) break;
}
console.log(`Órdenes obtenidas: ${orders.length}`);

// ---- Cálculo defensivo de win rate y ganancia ----
const pnlOf = (o) => parseFloat(
  o.achievedProfits ?? o.achievedProfit ?? o.totalProfits ?? o.pnl ?? o.realizedPnl ?? 'NaN'
);
const closed = orders.filter((o) => !Number.isNaN(pnlOf(o)));
const wins = closed.filter((o) => pnlOf(o) > 0).length;
const profitSum = closed.reduce((s, o) => s + pnlOf(o), 0);

const prev = JSON.parse(fs.readFileSync('assets/stats.json', 'utf8'));
const stats = {
  winRate: closed.length ? Math.round((wins * 100) / closed.length) : prev.winRate,
  totalTrades: closed.length || prev.totalTrades,
  profit90dUsdt: closed.length ? Math.round(profitSum * 100) / 100 : prev.profit90dUsdt,
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync('assets/stats.json', JSON.stringify(stats, null, 2) + '\n');
console.log('assets/stats.json actualizado:', stats);

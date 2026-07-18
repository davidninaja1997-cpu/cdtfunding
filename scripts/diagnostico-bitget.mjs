/**
 * Diagnóstico: comprueba si la API de Bitget ya reconoce a la cuenta
 * como trader de copytrading y muestra las respuestas crudas en el log.
 * No modifica ningún archivo del sitio.
 */
import crypto from 'node:crypto';

const KEY = process.env.BITGET_API_KEY;
const SECRET = process.env.BITGET_API_SECRET;
const PASSPHRASE = process.env.BITGET_API_PASSPHRASE;

if (!KEY || !SECRET || !PASSPHRASE) {
  console.log('Secretos BITGET_* no configurados.');
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
  console.log(`\nGET ${pathWithQuery}`);
  console.log('→', JSON.stringify(json).slice(0, 2500));
  return json;
}

const end = Date.now();
const start = end - 90 * 24 * 3600 * 1000;

// 1) Historial de órdenes como trader de futuros (sistema clásico)
await apiGet(`/api/v2/copy/mix-trader/order-history-track?productType=USDT-FUTURES&startTime=${start}&endTime=${end}&limit=20`);

// 2) Órdenes actuales como trader de futuros
await apiGet(`/api/v2/copy/mix-trader/order-current-track?productType=USDT-FUTURES&limit=20`);

// 3) Resumen total del trader
await apiGet(`/api/v2/copy/mix-trader/order-total-detail`);

// 4) Resumen de ganancias del trader
await apiGet(`/api/v2/copy/mix-trader/profit-history-summarys?coin=USDT&pageNo=1&pageSize=10`);

console.log('\nDiagnóstico terminado.');

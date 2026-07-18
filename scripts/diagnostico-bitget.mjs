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

// La clave Elite usa la API de Cuenta Unificada (UTA, v3):
// https://www.bitget.com/api-doc/uta/copy/Elite-Trading-API-Guide

// 1) Activos / saldo del portafolio
await apiGet(`/api/v3/account/assets`);

// 2) Posiciones abiertas
await apiGet(`/api/v3/position/current-position?category=USDT-FUTURES`);

// 3) Posiciones cerradas (con PnL) — para win rate
await apiGet(`/api/v3/position/history-position?category=USDT-FUTURES&limit=20`);

// 4) Historial de órdenes
await apiGet(`/api/v3/trade/history-orders?category=USDT-FUTURES&limit=20`);

console.log('\nDiagnóstico terminado.');

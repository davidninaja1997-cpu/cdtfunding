/* ============================================================
   server.js — Servidor del juego (Fase 1: sirve estáticos)
   En fases siguientes se añade: API REST, SQLite, timers por
   timestamp y validación económica en servidor.
   Pensado para el VPS bajo juego.clubdeltraderfx.com (Nginx
   hace proxy_pass a este puerto).
   ============================================================ */
'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3200;
const ROOT = path.join(__dirname, '..');

// Estáticos del cliente
app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));
// Definiciones de datos (solo lectura)
app.use('/data', express.static(path.join(ROOT, 'data'), { maxAge: '5m' }));

// Salud
app.get('/api/health', (req, res) => {
  res.json({ ok: true, phase: 1, ts: Date.now() });
});

// Fallback al index (SPA-ish)
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Granja & Ciudad CDT] servidor en http://localhost:${PORT}`);
});

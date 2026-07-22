# Granja & Ciudad CDT

Juego web social tipo *farm/city* (dos distritos: Granja y Ciudad en un mismo
mundo isométrico). Arte 100% propio (SVG/Canvas), sin nombres, logos ni assets
de juegos existentes.

## Stack
- **Cliente:** Vanilla HTML/CSS/JS + Canvas 2D isométrico.
- **Servidor:** Node.js + Express (+ SQLite en fases siguientes).
- **Definiciones de balanceo:** JSON en `/data` (sin tocar código).

## Estructura
```
game/
├── public/           # cliente (se sirve estático)
│   ├── index.html
│   ├── css/style.css
│   └── js/{iso.js,main.js}
├── server/server.js  # Express (Fase 1: sirve estáticos + /api/health)
├── data/props.json   # definiciones (tiles y props)
├── tools/            # simulador de balanceo (se crea al terminar la Fase 4)
└── package.json
```

## Correr en local / VPS
```bash
cd game
npm install
npm start        # http://localhost:3200
```

## Estado por fases
- [x] **Fase 1 — Renderizador isométrico y colocación**
  - Proyección diamante 2:1, cámara con paneo (arrastrar) y zoom (rueda).
  - Mundo 16×16 dividido en Granja (verde/tierra) y Ciudad (adoquín/arena).
  - Colocación de props con fantasma, validación de tile libre y rebote al colocar.
  - UI: barra de recursos, tienda inferior con pestañas, toggle Granja↔Ciudad con paneo suave.
  - Entrada por mouse **y** touch (móvil).
- [ ] Fase 2 — Cultivos y riego
- [ ] Fase 3 — Animales y cocina
- [ ] Fase 4 — Ciudad y negocios (+ `tools/simulate.js`)
- [ ] Fase 5 — Persistencia y validación en servidor (SQLite, timers por timestamp)
- [ ] Fase 6 — Social y deploy

## Deploy (ruta elegida: B-sub)
Todo el juego en el VPS bajo **`juego.clubdeltraderfx.com`**:
- Nginx sirve el estático y hace `proxy_pass` a Express (mismo origen, sin CORS).
- HTTPS con Let's Encrypt. La raíz del dominio sigue en GitHub Pages y **`/ruleta` no se toca** ni comparte base de datos.
- **Backup obligatorio** del directorio remoto a `/backups/YYYYMMDD-HHMM/` y verificación de que existe, antes de subir archivos (script de deploy en Fase 6).

> Nota: sin conexión con dinero real, sin depósitos/retiros y sin referencias a
> criptomonedas en la UI. Moneda blanda "Monedas" y dura "Gemas", solo de juego.

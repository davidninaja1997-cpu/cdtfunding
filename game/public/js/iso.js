/* ============================================================
   iso.js — Motor de render isométrico (Fase 1)
   Proyección diamante 2:1, cámara con paneo/zoom, dibujo
   procedural de tiles y props (todo el arte es vectorial).
   ============================================================ */
(function (global) {
  'use strict';

  var TILE_W = 64;   // ancho del rombo
  var TILE_H = 32;   // alto del rombo (2:1)

  function Iso(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grid = opts.grid;                 // { w, h, tiles:[[type]] }
    this.props = opts.propDefs;            // { id: def }
    this.tileTypes = opts.tileTypes;       // { type: colors }
    this.objects = [];                     // { id, gx, gy, t0 }
    this.cam = { x: 0, y: 0, zoom: 1 };    // x/y en unidades iso (centro de vista)
    this.camTarget = { x: 0, y: 0, zoom: 1 };
    this.hover = null;                     // { gx, gy }
    this.ghost = null;                     // { id, gx, gy } en modo colocación
    this.dpr = Math.min(global.devicePixelRatio || 1, 2);
    this.resize();
  }

  Iso.TILE_W = TILE_W;
  Iso.TILE_H = TILE_H;

  Iso.prototype.resize = function () {
    var c = this.canvas;
    var w = c.clientWidth || global.innerWidth;
    var h = c.clientHeight || global.innerHeight;
    c.width = Math.round(w * this.dpr);
    c.height = Math.round(h * this.dpr);
    this.vw = w; this.vh = h;
  };

  /* --- Proyección: centro del tile (gx,gy) -> pantalla --- */
  Iso.prototype.worldToScreen = function (gx, gy) {
    var isoX = (gx - gy) * (TILE_W / 2);
    var isoY = (gx + gy) * (TILE_H / 2);
    return {
      x: (isoX - this.cam.x) * this.cam.zoom + this.vw / 2,
      y: (isoY - this.cam.y) * this.cam.zoom + this.vh / 2
    };
  };

  /* --- Inversa: pantalla -> coordenada de grid (continua) --- */
  Iso.prototype.screenToGrid = function (sx, sy) {
    var isoX = (sx - this.vw / 2) / this.cam.zoom + this.cam.x;
    var isoY = (sy - this.vh / 2) / this.cam.zoom + this.cam.y;
    var gx = (isoX / (TILE_W / 2) + isoY / (TILE_H / 2)) / 2;
    var gy = (isoY / (TILE_H / 2) - isoX / (TILE_W / 2)) / 2;
    return { gx: Math.round(gx), gy: Math.round(gy) };
  };

  Iso.prototype.inBounds = function (gx, gy) {
    return gx >= 0 && gy >= 0 && gx < this.grid.w && gy < this.grid.h;
  };

  Iso.prototype.occupied = function (gx, gy) {
    for (var i = 0; i < this.objects.length; i++) {
      if (this.objects[i].gx === gx && this.objects[i].gy === gy) return true;
    }
    return false;
  };

  /* --- Centrar cámara suavemente en una coordenada de grid --- */
  Iso.prototype.focus = function (gx, gy, zoom) {
    this.camTarget.x = (gx - gy) * (TILE_W / 2);
    this.camTarget.y = (gx + gy) * (TILE_H / 2);
    if (zoom) this.camTarget.zoom = zoom;
  };

  Iso.prototype.update = function () {
    // Tween de cámara (paneo suave)
    var k = 0.16;
    this.cam.x += (this.camTarget.x - this.cam.x) * k;
    this.cam.y += (this.camTarget.y - this.cam.y) * k;
    this.cam.zoom += (this.camTarget.zoom - this.cam.zoom) * k;
  };

  /* ============================================================
     DIBUJO
     ============================================================ */
  Iso.prototype.draw = function (now) {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, this.vh);

    // 1) Terreno
    for (var gy = 0; gy < this.grid.h; gy++) {
      for (var gx = 0; gx < this.grid.w; gx++) {
        this.drawTile(gx, gy);
      }
    }

    // 2) Contorno del tile bajo el cursor / fantasma
    var target = this.ghost || this.hover;
    if (target && this.inBounds(target.gx, target.gy)) {
      var bad = this.ghost && this.occupied(target.gx, target.gy);
      this.drawTileOutline(target.gx, target.gy, bad ? '#E85D5D' : '#FFFFFF');
    }

    // 3) Objetos ordenados por profundidad (gx+gy)
    var objs = this.objects.slice().sort(function (a, b) {
      return (a.gx + a.gy) - (b.gx + b.gy) || a.gx - b.gx;
    });
    for (var i = 0; i < objs.length; i++) {
      this.drawProp(objs[i], now);
    }

    // 4) Fantasma en modo colocación
    if (this.ghost && this.inBounds(this.ghost.gx, this.ghost.gy)) {
      ctx.globalAlpha = this.occupied(this.ghost.gx, this.ghost.gy) ? 0.35 : 0.7;
      this.drawProp({ id: this.ghost.id, gx: this.ghost.gx, gy: this.ghost.gy, t0: 0 }, now, true);
      ctx.globalAlpha = 1;
    }
  };

  Iso.prototype.tilePath = function (ctx, s) {
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - TILE_H / 2 * this.cam.zoom);
    ctx.lineTo(s.x + TILE_W / 2 * this.cam.zoom, s.y);
    ctx.lineTo(s.x, s.y + TILE_H / 2 * this.cam.zoom);
    ctx.lineTo(s.x - TILE_W / 2 * this.cam.zoom, s.y);
    ctx.closePath();
  };

  Iso.prototype.drawTile = function (gx, gy) {
    var ctx = this.ctx;
    var s = this.worldToScreen(gx, gy);
    var z = this.cam.zoom;
    var half = TILE_W / 2 * z, quarter = TILE_H / 2 * z;
    // fuera de pantalla → saltar
    if (s.x < -half || s.x > this.vw + half || s.y < -half || s.y > this.vh + half) return;

    var type = this.grid.tiles[gy][gx];
    var col = this.tileTypes[type] || this.tileTypes.grass;
    // borde grueso 3D (lado)
    ctx.beginPath();
    ctx.moveTo(s.x - half, s.y);
    ctx.lineTo(s.x, s.y + quarter);
    ctx.lineTo(s.x + half, s.y);
    ctx.lineTo(s.x + half, s.y + 5 * z);
    ctx.lineTo(s.x, s.y + quarter + 5 * z);
    ctx.lineTo(s.x - half, s.y + 5 * z);
    ctx.closePath();
    ctx.fillStyle = col.side;
    ctx.fill();
    // cara superior con leve tablero
    this.tilePath(ctx, s);
    var checker = (gx + gy) % 2 === 0;
    ctx.fillStyle = checker ? col.top : col.top2;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.05)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  Iso.prototype.drawTileOutline = function (gx, gy, color) {
    var ctx = this.ctx;
    var s = this.worldToScreen(gx, gy);
    this.tilePath(ctx, s);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  /* Escala de rebote al aparecer (easeOutBack) */
  function bounce(t0, now) {
    if (!t0) return 1;
    var d = (now - t0) / 320;
    if (d >= 1) return 1;
    var c1 = 1.70158, c3 = c1 + 1, x = d;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  Iso.prototype.drawProp = function (obj, now, isGhost) {
    var def = this.props[obj.id];
    if (!def) return;
    var ctx = this.ctx;
    var s = this.worldToScreen(obj.gx, obj.gy);
    var z = this.cam.zoom * bounce(obj.t0, now);

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(z, z);
    // sombra suave en el suelo
    ctx.beginPath();
    ctx.ellipse(0, 2, TILE_W * 0.32, TILE_H * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,40,20,.18)';
    ctx.fill();
    (Iso.DRAW[def.kind] || Iso.DRAW.rock)(ctx, def);
    ctx.restore();
  };

  /* ============================================================
     ARTE PROCEDURAL de cada prop (dibujado sobre el suelo,
     origen 0,0 = centro del tile; se dibuja hacia arriba -y)
     ============================================================ */
  function trunk(ctx, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h, w, h, 3);
    ctx.fill();
  }
  function blob(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // polyfill roundRect
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
      else r = { tl: r[0], tr: r[1], br: r[2], bl: r[3] };
      this.beginPath();
      this.moveTo(x + r.tl, y);
      this.lineTo(x + w - r.tr, y); this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
      this.lineTo(x + w, y + h - r.br); this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
      this.lineTo(x + r.bl, y + h); this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
      this.lineTo(x, y + r.tl); this.quadraticCurveTo(x, y, x + r.tl, y);
      this.closePath();
      return this;
    };
  }

  Iso.DRAW = {
    tree: function (ctx, d) {
      trunk(ctx, 8, 20, d.c3);
      blob(ctx, 0, -30, 17, d.c2);
      blob(ctx, -9, -24, 12, d.c1);
      blob(ctx, 9, -25, 12, d.c1);
      blob(ctx, 0, -38, 13, d.c1);
    },
    pine: function (ctx, d) {
      trunk(ctx, 7, 16, d.c3);
      for (var i = 0; i < 3; i++) {
        var y = -14 - i * 13, w = 22 - i * 5;
        ctx.fillStyle = i % 2 ? d.c1 : d.c2;
        ctx.beginPath();
        ctx.moveTo(0, y - 16); ctx.lineTo(w, y); ctx.lineTo(-w, y);
        ctx.closePath(); ctx.fill();
      }
    },
    bush: function (ctx, d) {
      blob(ctx, -8, -8, 10, d.c2);
      blob(ctx, 8, -8, 10, d.c2);
      blob(ctx, 0, -14, 12, d.c1);
    },
    flower: function (ctx, d) {
      blob(ctx, -7, -6, 4, d.c3);
      blob(ctx, 7, -8, 4, d.c3);
      // pétalos
      [[-10, -14, d.c1], [8, -16, d.c2], [-2, -20, d.c1]].forEach(function (p) {
        for (var a = 0; a < 5; a++) {
          var ang = a / 5 * Math.PI * 2;
          blob(ctx, p[0] + Math.cos(ang) * 4, p[1] + Math.sin(ang) * 4, 3, p[2]);
        }
        blob(ctx, p[0], p[1], 2.6, '#FFF3B0');
      });
    },
    rock: function (ctx, d) {
      ctx.fillStyle = d.c2;
      ctx.beginPath();
      ctx.moveTo(-16, 0); ctx.lineTo(-10, -14); ctx.lineTo(6, -18);
      ctx.lineTo(16, -6); ctx.lineTo(12, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = d.c1;
      ctx.beginPath();
      ctx.moveTo(-10, -14); ctx.lineTo(6, -18); ctx.lineTo(2, -8); ctx.lineTo(-6, -6);
      ctx.closePath(); ctx.fill();
    },
    well: function (ctx, d) {
      // base de piedra
      ctx.fillStyle = d.c2;
      ctx.beginPath(); ctx.ellipse(0, -2, 18, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = d.c1;
      ctx.fillRect(-16, -16, 32, 14);
      ctx.fillStyle = d.c3;
      ctx.beginPath(); ctx.ellipse(0, -16, 15, 7, 0, 0, Math.PI * 2); ctx.fill();
      // techo
      ctx.fillStyle = d.c2;
      ctx.fillRect(-3, -34, 6, 20); ctx.fillRect(-3, -34, 6, 20);
      ctx.fillStyle = '#B23B3B';
      ctx.beginPath();
      ctx.moveTo(0, -44); ctx.lineTo(20, -30); ctx.lineTo(-20, -30); ctx.closePath(); ctx.fill();
    },
    house: function (ctx, d) {
      // cuerpo
      ctx.fillStyle = d.c1;
      ctx.beginPath(); ctx.roundRect(-20, -34, 40, 34, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(0, -34, 20, 34);
      // techo
      ctx.fillStyle = d.c4;
      ctx.beginPath();
      ctx.moveTo(0, -52); ctx.lineTo(26, -32); ctx.lineTo(-26, -32); ctx.closePath(); ctx.fill();
      // puerta y ventana
      ctx.fillStyle = d.c3;
      ctx.beginPath(); ctx.roundRect(-14, -20, 11, 11, 2); ctx.fill();
      ctx.fillStyle = '#7A4A24';
      ctx.beginPath(); ctx.roundRect(4, -18, 10, 18, [3, 3, 0, 0]); ctx.fill();
    },
    shop: function (ctx, d) {
      ctx.fillStyle = d.c1;
      ctx.beginPath(); ctx.roundRect(-22, -32, 44, 32, 4); ctx.fill();
      // toldo a rayas
      for (var i = -22; i < 22; i += 8) {
        ctx.fillStyle = (Math.round((i + 22) / 8) % 2) ? d.c4 : d.c3;
        ctx.beginPath();
        ctx.moveTo(i, -32); ctx.lineTo(i + 8, -32); ctx.lineTo(i + 4, -24); ctx.closePath(); ctx.fill();
      }
      // techo
      ctx.fillStyle = d.c2;
      ctx.fillRect(-24, -50, 48, 18);
      ctx.fillStyle = d.c3;
      ctx.beginPath(); ctx.roundRect(-8, -24, 16, 24, [3, 3, 0, 0]); ctx.fill();
    },
    lamp: function (ctx, d) {
      ctx.fillStyle = d.c1;
      ctx.beginPath(); ctx.roundRect(-3, -40, 6, 40, 3); ctx.fill();
      ctx.fillStyle = d.c2;
      ctx.fillRect(-6, -2, 12, 4);
      // luz
      ctx.fillStyle = d.c3;
      ctx.beginPath(); ctx.roundRect(-6, -48, 12, 12, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,224,138,.45)';
      blob(ctx, 0, -42, 12, 'rgba(255,224,138,.35)');
    },
    fence: function (ctx, d) {
      ctx.fillStyle = d.c2;
      ctx.fillRect(-18, -8, 36, 3);
      ctx.fillStyle = d.c1;
      [-16, -6, 4, 14].forEach(function (x) { ctx.fillRect(x, -18, 4, 18); });
    }
  };

  global.Iso = Iso;
})(window);

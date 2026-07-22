/* ============================================================
   main.js — Arranque del juego (Fase 1: render + colocación)
   ============================================================ */
(function () {
  'use strict';

  var GRID_W = 16, GRID_H = 16;
  var canvas = document.getElementById('world');
  var iso, propDefs = {}, propList = [], tileTypes = {};

  /* ---- Construcción del mundo: mitad granja / mitad ciudad ---- */
  function buildGrid() {
    var tiles = [];
    for (var gy = 0; gy < GRID_H; gy++) {
      var row = [];
      for (var gx = 0; gx < GRID_W; gx++) {
        if (gx < GRID_W / 2) {
          row.push((gx + gy) % 5 === 0 ? 'soil' : 'grass');   // granja
        } else {
          row.push((gx + gy) % 7 === 0 ? 'sand' : 'pavement'); // ciudad
        }
      }
      tiles.push(row);
    }
    return { w: GRID_W, h: GRID_H, tiles: tiles };
  }

  /* ---- Vista Granja / Ciudad ---- */
  var view = 'farm';
  function setView(v) {
    view = v;
    if (v === 'farm') iso.focus(4, 8, iso.cam.zoom);
    else iso.focus(12, 8, iso.cam.zoom);
    var t = document.getElementById('view-toggle');
    t.querySelector('.vt-farm').classList.toggle('on', v === 'farm');
    t.querySelector('.vt-city').classList.toggle('on', v === 'city');
  }
  document.getElementById('view-toggle').addEventListener('click', function () {
    setView(view === 'farm' ? 'city' : 'farm');
  });

  /* ---- Tienda inferior (pestañas por categoría) ---- */
  var selected = null;
  function buildShop() {
    var cats = [];
    propList.forEach(function (p) { if (cats.indexOf(p.cat) === -1) cats.push(p.cat); });
    var tabsEl = document.getElementById('shop-tabs');
    var itemsEl = document.getElementById('shop-items');
    // pestañas del juego completo (las bloqueadas llegan en fases siguientes)
    var allTabs = ['Cultivos', 'Animales', 'Cocina', 'Naturaleza', 'Ciudad', 'Decoración'];
    var active = 'Naturaleza';

    function renderItems(cat) {
      itemsEl.innerHTML = '';
      propList.filter(function (p) { return p.cat === cat; }).forEach(function (p) {
        var el = document.createElement('div');
        el.className = 'item' + (selected === p.id ? ' on' : '');
        var cv = document.createElement('canvas'); cv.width = 128; cv.height = 112;
        drawPreview(cv, p);
        el.appendChild(cv);
        var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = p.name; el.appendChild(nm);
        var pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = '🪙 —'; el.appendChild(pr);
        el.addEventListener('click', function () { selectProp(p.id); });
        itemsEl.appendChild(el);
      });
    }
    function renderTabs() {
      tabsEl.innerHTML = '';
      allTabs.forEach(function (name) {
        var enabled = cats.indexOf(name) !== -1;
        var t = document.createElement('button');
        t.className = 'tab' + (name === active ? ' on' : '') + (enabled ? '' : ' locked');
        t.textContent = enabled ? name : name + ' 🔒';
        if (enabled) t.addEventListener('click', function () {
          active = name; renderTabs(); renderItems(name);
        });
        tabsEl.appendChild(t);
      });
    }
    renderTabs();
    renderItems(active);
  }

  function drawPreview(cv, def) {
    var ctx = cv.getContext('2d');
    var dpr = 2; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(32, 44);
    ctx.beginPath(); ctx.ellipse(0, 2, 20, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,40,20,.14)'; ctx.fill();
    (window.Iso.DRAW[def.kind] || window.Iso.DRAW.rock)(ctx, def);
    ctx.restore();
  }

  function selectProp(id) {
    selected = (selected === id) ? null : id;
    canvas.classList.toggle('placing', !!selected);
    var hint = document.getElementById('place-hint');
    if (selected) {
      hint.hidden = false;
      document.getElementById('place-name').textContent = 'Colocando: ' + propDefs[selected].name;
    } else {
      hint.hidden = true;
      iso.ghost = null;
    }
    // refrescar estado "on" de items
    document.querySelectorAll('.shop-items .item').forEach(function (el, i) {});
    buildShop();
  }
  document.getElementById('place-cancel').addEventListener('click', function () { selectProp(selected); });

  /* ---- Entrada: paneo, zoom y colocación (mouse + touch) ---- */
  var pointer = { down: false, sx: 0, sy: 0, moved: false, lx: 0, ly: 0 };
  var THRESH = 6;

  function evtPos(e) {
    var r = canvas.getBoundingClientRect();
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }

  function onDown(e) {
    var p = evtPos(e);
    pointer.down = true; pointer.sx = p.x; pointer.sy = p.y; pointer.moved = false; pointer.lx = p.x; pointer.ly = p.y;
  }

  function onMove(e) {
    var p = evtPos(e);
    var g = iso.screenToGrid(p.x, p.y);
    iso.hover = g;
    if (selected) iso.ghost = { id: selected, gx: g.gx, gy: g.gy };

    if (pointer.down) {
      if (Math.abs(p.x - pointer.sx) > THRESH || Math.abs(p.y - pointer.sy) > THRESH) pointer.moved = true;
      if (pointer.moved) {
        var dx = (p.x - pointer.lx) / iso.cam.zoom;
        var dy = (p.y - pointer.ly) / iso.cam.zoom;
        iso.cam.x -= dx; iso.cam.y -= dy;
        iso.camTarget.x = iso.cam.x; iso.camTarget.y = iso.cam.y;
        canvas.classList.add('panning');
      }
      pointer.lx = p.x; pointer.ly = p.y;
    }
  }

  function onUp(e) {
    var p = evtPos(e);
    canvas.classList.remove('panning');
    if (pointer.down && !pointer.moved) {
      var g = iso.screenToGrid(p.x, p.y);
      if (selected && iso.inBounds(g.gx, g.gy) && !iso.occupied(g.gx, g.gy)) {
        placeProp(selected, g.gx, g.gy);
      }
    }
    pointer.down = false;
  }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); onDown(e); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend', function (e) { onUp(e); });
  canvas.addEventListener('touchcancel', function () { pointer.down = false; canvas.classList.remove('panning'); });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var z = iso.camTarget.zoom * (e.deltaY < 0 ? 1.12 : 0.89);
    iso.camTarget.zoom = Math.max(0.5, Math.min(2, z));
  }, { passive: false });

  function placeProp(id, gx, gy) {
    iso.objects.push({ id: id, gx: gx, gy: gy, t0: performance.now() });
  }

  /* ---- Bucle de render ---- */
  function loop(now) {
    iso.update();
    iso.draw(now);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', function () { iso.resize(); });

  /* ---- Arranque ---- */
  fetch('data/props.json', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      tileTypes = data.tileTypes;
      propList = data.props;
      propList.forEach(function (p) { propDefs[p.id] = p; });

      iso = new window.Iso(canvas, { grid: buildGrid(), propDefs: propDefs, tileTypes: tileTypes });
      iso.cam.x = iso.camTarget.x = 0;
      iso.cam.y = iso.camTarget.y = (4 + 8) * window.Iso.TILE_H / 2 - 40;
      iso.cam.zoom = iso.camTarget.zoom = 1;
      setView('farm');
      buildShop();

      // Algunos props de ejemplo para que no arranque vacío
      [['tree', 2, 3], ['tree', 3, 5], ['pine', 1, 8], ['bush', 5, 4],
       ['house', 10, 4], ['shop', 12, 6], ['lamp', 11, 8], ['fence', 9, 9]].forEach(function (o) {
        placeProp(o[0], o[1], o[2]);
      });

      document.getElementById('loading').classList.add('hide');
      requestAnimationFrame(loop);

      // API mínima para pruebas
      window.__game = {
        iso: iso,
        select: selectProp,
        place: placeProp,
        objects: function () { return iso.objects; },
        setView: setView,
        get view() { return view; }
      };
    })
    .catch(function (err) {
      document.getElementById('loading').textContent = 'Error cargando el juego: ' + err.message;
    });
})();

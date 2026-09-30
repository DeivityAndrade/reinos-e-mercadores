'use strict';
/* Ferramenta de desenvolvimento: monta uma cena para avaliar o visual (cidade desenvolvida, mapa revelado, pausado).
   Uso no console: s=document.createElement('script');s.src='tools/shot.js';document.body.appendChild(s); depois KM.shot({...}) */
(function (KM) {
  KM.shot = function ({ seed = 4, mins = 9, owner = 1, dist = 16, pitch = 0.8, yaw = 0, reuse = false, dx = 0, dy = 0 } = {}) {
    if (!reuse || !KM.S) {
      KM.startGame({ diff: 'normal', opponents: 1, seed });
      const S = KM.S;
      for (let i = 0; i < 20 * 60 * mins; i++) KM.step(S, KM.DT);
      S.map.explored.fill(255); KM.R.objDirty = true; KM.R.fogDirty = true; S.paused = true;
    }
    const S = KM.S;
    const st = Object.values(S.houses).find((h) => h.owner === owner && h.type === 'storehouse');
    if (st) KM.R.centerOn(st.ex + dx, st.ey + dy);
    KM.R.dist = dist; KM.R.pitch = pitch; KM.R.yaw = yaw;
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const tu = document.querySelector('#tutor'); if (tu) tu.classList.add('hidden');
    KM.ui.update(0.3);
    for (let i = 0; i < 3; i++) KM.R.frame(S, 0.016, KM.ui);
    return 'ok';
  };
  // galeria: todas as construções prontas perto do Armazém; KM.look(tipo) mostra uma isolada
  KM.gallery = function (seed = 4) {
    KM.startGame({ diff: 'normal', opponents: 1, seed, allUnlocked: true });
    const S = KM.S; S.paused = true;
    const st = Object.values(S.houses).find((h) => h.owner === 0 && h.type === 'storehouse');
    for (const t of Object.keys(KM.HOUSES)) { if (t === 'storehouse' || t === 'school') continue; const p = KM.findSpot(S, t, 0, st.ex, st.ey, 20); if (p) KM.addHouse(S, t, 0, p.x, p.y, true); }
    S.map.explored.fill(255); KM.R.objDirty = true; KM.R.fogDirty = true;
    return Object.values(S.houses).filter((h) => h.owner === 0).length;
  };
  const rframe = KM.R.frame.bind(KM.R);
  KM.look = function (type, dist = 6.5, pitch = 0.45, yaw = 0.45) {
    KM.R.frame = () => {};
    const h = Object.values(KM.S.houses).find((x) => x.owner === 0 && x.type === type);
    KM.R.centerOn(h.x + h.w / 2 - 0.5, h.y + h.h / 2 - 0.5); KM.R.dist = dist; KM.R.pitch = pitch; KM.R.yaw = yaw;
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const tu = document.querySelector('#tutor'); if (tu) tu.classList.add('hidden');
    KM.ui.update(0.3); rframe(KM.S, 0.016, KM.ui); rframe(KM.S, 0.016, KM.ui);
    for (const id in KM.R.houseVis) KM.R.houseVis[id].visible = +id === h.id;
    for (const id in KM.R.unitVis) KM.R.unitVis[id].root.visible = false;
    KM.R.renderScene(); KM.R.og.clearRect(0, 0, 9999, 9999);
    return type;
  };
  KM.unlook = function () { KM.R.frame = rframe; };
})(window.KM);

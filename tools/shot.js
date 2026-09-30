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
})(window.KM);

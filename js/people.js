'use strict';
/* Personagens (Quaternius, CC0): cabeça do corpo base + roupa + cabelo + ferramentas/armas fundidos numa
   só malha por tipo de pessoa, com todas as texturas num atlas. Cada unidade é 1 desenho: as cores
   (pele, cabelo, roupa, reino) ficam numa paleta do material. Animações: Universal Animation Library.
   Só visual: a simulação não depende disto. */
(function (KM) {
  const Q = 'assets/quaternius/chars/', QP = 'assets/quaternius/props/';
  const PROPS = ['Sword_Bronze', 'Axe_Bronze', 'Pickaxe_Bronze', 'Shield_Wooden'];
  const FILES = ['Male_Peasant', 'Female_Peasant', 'Male_Ranger', 'Female_Ranger', 'Superhero_Male_FullBody', 'Superhero_Female_FullBody', 'Hair_SimpleParted', 'Hair_Buzzed', 'Hair_Beard', 'Hair_Long', 'Hair_Buns'];
  KM.PEOPLE_SCALE = 0.5; // ~1,8 m do modelo -> ~0,9 ladrilho de altura
  // animações que o jogo pede (nomes do KayKit) -> Universal Animation Library
  const ANIM = {
    Idle: 'Idle_Loop', '2H_Melee_Idle': 'Sword_Idle', Blocking: 'Sword_Idle', Walking_A: 'Jog_Fwd_Loop', Walking_B: 'Jog_Fwd_Loop', Walking_C: 'Walk_Loop',
    '1H_Melee_Attack_Chop': 'Sword_Attack', '2H_Melee_Attack_Chop': 'Sword_Attack', '1H_Melee_Attack_Slice_Diagonal': 'Sword_Attack', '1H_Melee_Attack_Slice_Horizontal': 'Sword_Attack', '2H_Melee_Attack_Stab': 'Punch_Jab',
    Interact: 'Interact', PickUp: 'PickUp_Table', '1H_Ranged_Aiming': 'Spell_Simple_Idle_Loop', '2H_Ranged_Aiming': 'Spell_Simple_Idle_Loop', '1H_Ranged_Shoot': 'Spell_Simple_Shoot', '2H_Ranged_Shoot': 'Spell_Simple_Shoot',
    Sit_Chair_Idle: 'Sitting_Idle_Loop', Death_A: 'Death01',
  };
  // roupa, tom da roupa (profissão) ou peso da cor do reino, ferramenta/arma, capacete/chapéu, escudo
  const LOOK = {
    serf: { o: 'Peasant' }, laborer: { o: 'Peasant', tint: '#7d8ea3', tool: 'hammer' }, woodcutter: { o: 'Peasant', tint: '#7fa060', tool: 'axe2' },
    stonemason: { o: 'Peasant', tint: '#a8a49c', tool: 'pick' }, farmer: { o: 'Peasant', tint: '#e0c878', tool: 'sickle', hat: 'straw' }, carpenter: { o: 'Peasant', tint: '#c08a50', tool: 'hammer' },
    miner: { o: 'Peasant', tint: '#7a7a8c', tool: 'pick', hat: 'miner' }, breeder: { o: 'Peasant', tint: '#d09a7a' }, fisher: { o: 'Peasant', tint: '#6a9cc0', tool: 'rod' },
    metallurgist: { o: 'Peasant', tint: '#c07050', tool: 'hammer' }, smith: { o: 'Peasant', tint: '#707070', tool: 'hammer' }, baker: { o: 'Peasant', tint: '#fff4dc', hat: 'chef' },
    butcher: { o: 'Peasant', tint: '#d07060', tool: 'cleaver' }, recruit: { o: 'Peasant', team: 0.45 }, levy: { o: 'Peasant', team: 0.35, tool: 'hammer' }, militia: { o: 'Peasant', team: 0.4, tool: 'axe1' },
    axeman: { o: 'Ranger', team: 0.5, helm: 'nasal', tool: 'axe1', shield: 'round' }, swordsman: { o: 'Ranger', team: 0.5, helm: 'great', tool: 'sword', shield: 'kite', male: 1 },
    bowman: { o: 'Ranger', team: 0.4, tool: 'bow', hood: 1 }, crossbowman: { o: 'Ranger', team: 0.5, helm: 'kettle', tool: 'crossbow' },
    lancer: { o: 'Ranger', team: 0.5, helm: 'nasal', tool: 'spear', shield: 'round' }, pikeman: { o: 'Ranger', team: 0.5, helm: 'kettle', tool: 'pike' },
    scout: { o: 'Ranger', team: 0.4, tool: 'axe1', hood: 1 }, knight: { o: 'Ranger', team: 0.55, helm: 'great', plume: 1, tool: 'sword', shield: 'kite', male: 1 },
  };
  const HAIR_C = ['#3a2a1a', '#6a4424', '#1e1610', '#a8743a', '#d8b070', '#7a2e18', '#8a8278'];
  const SKIN_C = ['#ffffff', '#f2d8c4', '#d9b090', '#b88a68'];
  // paleta: 0 roupa, 1 pele, 2 cabelo, 3 reino, 4 sem tom
  const SLOT = { cloth: 0, skin: 1, hair: 2, team: 3, raw: 4 };

  const P = KM.PEOPLE = { ready: false, src: {}, clips: null, geo: {}, mats: {} };

  P.load = async function (loader) {
    try {
      const ual = await loader.loadAsync(Q + 'UAL1_Standard.glb');
      P.clips = {};
      for (const a of ual.animations) P.clips[a.name] = a;
      await Promise.all(FILES.map(async (k) => { P.src[k] = await loader.loadAsync(Q + k + '.gltf'); }));
      // armas prontas do Fantasy Props MegaKit e a textura de tecido (tabardos, chapéus)
      await Promise.all(PROPS.map(async (k) => { P.src[k] = await loader.loadAsync(QP + k + '.gltf'); }));
      P.cloth = await new THREE.TextureLoader().loadAsync(QP + 'T_Trim_Cloth_BaseColor.jpg');
      buildAtlas();
      P.ready = true;
    } catch (e) { console.warn('Personagens Quaternius indisponíveis, usando os antigos', e); }
  };
  P.anim = (name) => ANIM[name] || name;

  // ---------- atlas: todas as texturas numa grade 4x4 de 512 px (a última célula é branca, para as peças) ----------
  const N = 4, CELL = 512, INSET = 3 / CELL;
  function buildAtlas() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = N * CELL;
    const g = cv.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect((N - 1) * CELL, (N - 1) * CELL, CELL, CELL);
    // uma célula por imagem (vários materiais podem usar a mesma textura)
    P.cells = {};
    const byImg = new Map();
    // cada arquivo carrega a própria cópia da imagem: a chave é o nome da textura
    const cellOf = (key, img) => {
      if (!byImg.has(key)) {
        const c = byImg.size;
        if (c >= N * N - 1) throw new Error('atlas de personagens cheio');
        byImg.set(key, c); g.drawImage(img, (c % N) * CELL, ((c / N) | 0) * CELL, CELL, CELL);
      }
      return byImg.get(key);
    };
    for (const f of FILES.concat(PROPS)) P.src[f].scene.traverse((o) => { if (o.isMesh && o.material.map) P.cells[o.material.name] = cellOf(o.material.map.name || o.material.name, o.material.map.image); });
    const clothCell = cellOf('T_Trim_Cloth_BaseColor', P.cloth.image);
    P.white = N * N - 1;
    // recortes das texturas "trim" para as peças modeladas aqui: madeira, metal, tecido claro e palha
    const furn = P.cells.MI_Trim_Furniture, metal = P.cells.MI_Trim_Metal_Vertex != null ? P.cells.MI_Trim_Metal_Vertex : P.cells.MI_Trim_Metal, props = P.cells.MI_Trim_Props_Vertex;
    P.rect = { wood: [furn, 0.02, 0.04, 0.98, 0.4], metal: [metal, 0.03, 0.02, 0.84, 0.27], cloth: [clothCell, 0.63, 0.08, 0.96, 0.42], straw: [props, 0.02, 0.005, 0.98, 0.075], white: [P.white, 0.5, 0.5, 0.5, 0.5] };
    const tex = P.atlas = new THREE.CanvasTexture(cv);
    tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  }
  const slotOf = (mn) => (/Peasant|Ranger/.test(mn) ? SLOT.cloth : /Regular|Superhero/i.test(mn) ? SLOT.skin : /Hair/.test(mn) ? SLOT.hair : SLOT.raw);

  // copia uma peça para o espaço comum (esqueleto do corpo base), com UV no atlas e cor/paleta por vértice
  // cell: célula do atlas inteira, ou recorte [célula, u0, v0, u1, v1] (peças modeladas aqui)
  function part(geo, tris, boneMap, m4, cell, slot, color) {
    const src = geo.index ? geo.index.array : null, pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
    const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, vc = geo.attributes.color;
    const ids = tris || (src ? Array.from(src) : Array.from({ length: pos.count }, (_, i) => i));
    const used = new Map(), P3 = [], N3 = [], U2 = [], SI = [], SW = [], C3 = [], SL = [], IDX = [];
    const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m4);
    const [c, r0, s0, r1, s1] = Array.isArray(cell) ? cell : [cell, 0, 0, 1, 1];
    const cx = c % N, cy = (c / N) | 0;
    for (const i of ids) {
      if (!used.has(i)) {
        used.set(i, used.size);
        v.fromBufferAttribute(pos, i).applyMatrix4(m4); P3.push(v.x, v.y, v.z);
        if (nrm) { v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize(); N3.push(v.x, v.y, v.z); } else N3.push(0, 1, 0);
        const uu = r0 + (uv ? KM.clamp(uv.getX(i), 0, 1) : 0.5) * (r1 - r0), vv = s0 + (uv ? KM.clamp(uv.getY(i), 0, 1) : 0.5) * (s1 - s0);
        U2.push((cx + INSET + uu * (1 - 2 * INSET)) / N, (cy + INSET + vv * (1 - 2 * INSET)) / N);
        for (let j = 0; j < 4; j++) { SI.push(si ? boneMap(si.getComponent(i, j)) : boneMap(-1)); SW.push(si ? sw.getComponent(i, j) : j === 0 ? 1 : 0); }
        const k = vc ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : [1, 1, 1];
        C3.push(color[0] * k[0], color[1] * k[1], color[2] * k[2]); SL.push(slot);
      }
      IDX.push(used.get(i));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N3, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C3, 3));
    g.setAttribute('slot', new THREE.Float32BufferAttribute(SL, 1));
    g.setIndex(IDX);
    return g;
  }
  // do corpo base só fica a cabeça (a roupa já tem braços e pernas): triângulos presos a Head/neck
  function headTris(mesh) {
    const keep = new Set(mesh.skeleton.bones.map((b, i) => (/^(Head|neck_0\d)$/.test(b.name) ? i : -1)).filter((i) => i >= 0));
    const geo = mesh.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, idx = geo.index.array, out = [];
    const main = (v) => { let bi = 0, bw = -1; for (let j = 0; j < 4; j++) { const w = sw.getComponent(v, j); if (w > bw) { bw = w; bi = si.getComponent(v, j); } } return bi; };
    for (let t = 0; t < idx.length; t += 3) if (keep.has(main(idx[t])) && keep.has(main(idx[t + 1])) && keep.has(main(idx[t + 2]))) out.push(idx[t], idx[t + 1], idx[t + 2]);
    return out;
  }

  // ---------- peças (em metros do modelo; cabo ao longo de +y, empunhadura na origem) ----------
  // t: recorte de textura (wood, metal, cloth, straw) ou 'model' (peça pronta do pacote); c: tom; team: pinta com a cor do reino
  const TEAM = 'team', GOLD = '#f0c860';
  const piece = (g, t, c) => { const m = new THREE.Mesh(g); m.userData = { t, c: c === TEAM ? '#ffffff' : c || '#ffffff', team: c === TEAM }; return m; };
  // peça pronta (Fantasy Props MegaKit): geometria no espaço da cena, deslocada para a empunhadura
  function model(g, k, s, gripY, rot) {
    const src = P.src[k].scene;
    src.updateMatrixWorld(true);
    src.traverse((o) => {
      if (!o.isMesh) return;
      const m = new THREE.Mesh(o.geometry);
      m.userData = { t: 'model', mn: o.material.name, c: '#ffffff' };
      const M = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeRotationY(rot || 0)).multiply(new THREE.Matrix4().makeTranslation(0, -gripY, 0)).multiply(o.matrixWorld);
      m.applyMatrix4(M);
      g.add(m);
    });
  }
  function tool(kind) {
    const g = new THREE.Group(), add = (geo, t, c, x, y, z) => { const m = piece(geo, t, c); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; };
    const shaft = (len, r, from, c) => add(new THREE.CylinderGeometry(r, r * 1.1, len, 7), 'wood', c || '#ffffff', 0, (from || 0) + len / 2, 0);
    if (kind === 'sword') model(g, 'Sword_Bronze', 0.95, 0, 0);
    if (kind === 'axe1') model(g, 'Axe_Bronze', 1, -0.28, 0);
    if (kind === 'axe2') model(g, 'Axe_Bronze', 1.3, -0.3, 0);
    if (kind === 'pick') model(g, 'Pickaxe_Bronze', 0.75, -0.4, 0);
    if (kind === 'hammer') { shaft(0.48, 0.022, -0.1); add(new THREE.BoxGeometry(0.17, 0.085, 0.085), 'metal', '#d8dce2', 0, 0.36, 0); add(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6), 'metal', '#b0b4ba', 0, 0.3, 0); }
    if (kind === 'sickle') { shaft(0.2, 0.02, -0.07); add(new THREE.TorusGeometry(0.12, 0.014, 4, 12, Math.PI * 1.1).rotateZ(-0.2), 'metal', '#e8ecf0', 0.12, 0.13, 0); }
    if (kind === 'cleaver') { shaft(0.15, 0.02, -0.06); add(new THREE.BoxGeometry(0.13, 0.19, 0.012), 'metal', '#e8ecf0', 0.05, 0.17, 0); }
    if (kind === 'rod') { shaft(1.4, 0.013, -0.25); add(new THREE.CylinderGeometry(0.003, 0.003, 0.5, 3), 'cloth', '#ffffff', 0.02, 0.9, 0); }
    if (kind === 'spear' || kind === 'pike') {
      const L = kind === 'pike' ? 2.3 : 1.65;
      shaft(L, 0.022, -0.6);
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.06, 7), 'metal', '#b0b4ba', 0, L - 0.62, 0);
      add(new THREE.ConeGeometry(0.045, 0.24, 4), 'metal', '#e8ecf0', 0, L - 0.47, 0);
    }
    if (kind === 'bow') {
      const R = 0.45, arc = Math.PI * 0.72;
      // arco centrado na empunhadura, pontas para cima e para baixo; corda reta entre elas
      add(new THREE.TorusGeometry(R, 0.017, 4, 14, arc).rotateZ(-arc / 2).translate(-R, 0, 0), 'wood', '#ffffff');
      const ty = R * Math.sin(arc / 2), tx = R * Math.cos(arc / 2) - R;
      add(new THREE.CylinderGeometry(0.004, 0.004, ty * 2, 3), 'cloth', '#ffffff', tx, 0, 0);
      add(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 7), 'cloth', '#7a5232', 0, 0, 0);
    }
    if (kind === 'crossbow') {
      add(new THREE.BoxGeometry(0.06, 0.62, 0.07), 'wood', '#ffffff', 0, 0.16, 0);
      add(new THREE.TorusGeometry(0.3, 0.014, 4, 12, Math.PI * 0.6).rotateZ(Math.PI * 0.2).translate(0, 0.2, 0), 'metal', '#c0c4ca', 0, 0.2, 0);
      add(new THREE.BoxGeometry(0.03, 0.06, 0.05), 'metal', '#9a9ea4', 0, -0.06, -0.04);
    }
    return g;
  }
  // escudo de madeira do pacote (face em +z) com o brasão do reino pintado na frente
  function shield(kind) {
    const g = new THREE.Group(), s = kind === 'kite' ? 1.12 : 1;
    model(g, 'Shield_Wooden', s, 0, 0);
    const p = piece(new THREE.CylinderGeometry(0.15 * s, 0.15 * s, 0.01, 16).rotateX(Math.PI / 2), 'cloth', TEAM); p.position.z = 0.175 * s; g.add(p);
    const b = piece(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.02, 10).rotateX(Math.PI / 2), 'metal', GOLD); b.position.z = 0.185 * s; g.add(b);
    return g;
  }
  function helmet(kind, plume) {
    const g = new THREE.Group(), add = (geo, t, c, x, y, z) => { const m = piece(geo, t, c); m.position.set(x || 0, y || 0, z || 0); g.add(m); };
    const STEEL = '#e8ecf0', DARK = '#a0a4aa';
    if (kind === 'nasal') { add(new THREE.ConeGeometry(0.142, 0.21, 12), 'metal', STEEL, 0, 0.17, 0.01); add(new THREE.CylinderGeometry(0.145, 0.145, 0.03, 12), 'metal', DARK, 0, 0.075, 0.01); add(new THREE.BoxGeometry(0.022, 0.1, 0.02), 'metal', DARK, 0, 0.06, 0.145); }
    if (kind === 'kettle') { add(new THREE.SphereGeometry(0.138, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', STEEL, 0, 0.1, 0.01); add(new THREE.CylinderGeometry(0.23, 0.21, 0.018, 16), 'metal', DARK, 0, 0.1, 0.01); }
    if (kind === 'great') {
      add(new THREE.CylinderGeometry(0.138, 0.133, 0.28, 14), 'metal', STEEL, 0, 0.08, 0.01);
      add(new THREE.SphereGeometry(0.138, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.4, 1), 'metal', STEEL, 0, 0.22, 0.01);
      add(new THREE.BoxGeometry(0.17, 0.02, 0.02), 'metal', '#2a2622', 0, 0.1, 0.145); add(new THREE.BoxGeometry(0.025, 0.12, 0.02), 'metal', DARK, 0, 0.04, 0.148);
      if (plume) add(new THREE.ConeGeometry(0.05, 0.26, 7).rotateX(-0.5), 'cloth', TEAM, 0, 0.3, -0.04);
    }
    if (kind === 'straw') { add(new THREE.CylinderGeometry(0.27, 0.25, 0.022, 16), 'straw', '#ffffff', 0, 0.14, 0.01); add(new THREE.ConeGeometry(0.135, 0.14, 14), 'straw', '#ffffff', 0, 0.21, 0.01); add(new THREE.CylinderGeometry(0.128, 0.13, 0.025, 14), 'cloth', '#a05a3a', 0, 0.16, 0.01); }
    if (kind === 'chef') add(new THREE.CylinderGeometry(0.135, 0.115, 0.21, 12), 'cloth', '#ffffff', 0, 0.22, 0);
    if (kind === 'miner') { add(new THREE.SphereGeometry(0.138, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), 'metal', '#9a8a70', 0, 0.12, 0.01); add(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).rotateX(Math.PI / 2), 'metal', '#ffd24a', 0, 0.17, 0.135); }
    return g;
  }

  // escolhas de aparência de uma unidade (só 8 variações por tipo, para reaproveitar malhas)
  function look(type, v) {
    const L = LOOK[type] || LOOK.serf, h = (k) => KM.hash(v % 8, k, 41 + type.length);
    const female = !L.male && h(1) < 0.35;
    const hairs = [];
    if (!(L.helm || L.hat || L.hood)) hairs.push(female ? (h(2) < 0.5 ? 'Hair_Long' : 'Hair_Buns') : (h(2) < 0.5 ? 'Hair_SimpleParted' : 'Hair_Buzzed'));
    if (!female && h(3) < 0.45) hairs.push('Hair_Beard');
    const hv = KM.hash(v | 0, 4, 77), sv = KM.hash(v | 0, 5, 77);
    return { L, female, hairs, hairC: HAIR_C[(hv * HAIR_C.length) | 0], skinC: SKIN_C[(sv * SKIN_C.length) | 0] };
  }

  // malha fundida de um tipo + variação (cacheada): roupa, cabeça, cabelos, ferramentas e armas
  function geometry(type, lk) {
    const key = [type, lk.female, lk.hairs.join('+')].join('|');
    if (P.geo[key]) return P.geo[key];
    const { L, female } = lk;
    const bodyK = female ? 'Superhero_Female_FullBody' : 'Superhero_Male_FullBody';
    const body = THREE.SkeletonUtils.clone(P.src[bodyK].scene);
    body.updateMatrixWorld(true);
    let ref = null;
    body.traverse((o) => { if (o.isSkinnedMesh && !ref) ref = o; });
    const bones = {}, order = ref.skeleton.bones.map((b) => b.name);
    ref.skeleton.bones.forEach((b, i) => { bones[b.name] = b; });
    const refBindInv = ref.bindMatrixInverse;
    const parts = [];
    const take = (mesh, tris) => {
      const map = (i) => (i < 0 ? 0 : Math.max(0, order.indexOf(mesh.skeleton.bones[i].name)));
      const m4 = new THREE.Matrix4().multiplyMatrices(refBindInv, mesh.bindMatrix);
      const mn = mesh.material.name;
      parts.push(part(mesh.geometry, tris, map, m4, P.cells[mn] != null ? P.cells[mn] : P.white, slotOf(mn), [1, 1, 1]));
    };
    body.traverse((o) => { if (o.isSkinnedMesh) take(o, /Superhero/i.test(o.material.name) ? headTris(o) : null); });
    const outfit = (female ? 'Female_' : 'Male_') + L.o;
    P.src[outfit].scene.traverse((o) => { if (o.isSkinnedMesh && (L.hood || !/Hood/.test(o.name))) take(o); });
    for (const k of lk.hairs) P.src[k].scene.traverse((o) => { if (o.isSkinnedMesh) take(o); });
    // peças rígidas: orientadas na pose de repouso (lança em pé, espada para cima e para a frente) e presas a um osso
    const pose = new THREE.AnimationMixer(body);
    pose.clipAction(P.clips[KM.SOLDIERS[type] ? 'Sword_Idle' : 'Idle_Loop']).play(); pose.update(0.3);
    body.updateMatrixWorld(true);
    const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
    const props = [];
    const aim = (grp, bone, from, dir) => {
      const qh = bones[bone].getWorldQuaternion(new THREE.Quaternion()).invert();
      grp.quaternion.copy(qh.multiply(new THREE.Quaternion().setFromUnitVectors(from, dir.normalize())));
      props.push([grp, bone]);
    };
    const AIM = { spear: [0, 1, 0.12], pike: [0, 1, 0.1], crossbow: [0, 0.15, 1], bow: [0, 1, 0.05], rod: [0, 0.75, 1], axe2: [0, 1, 0.35] };
    if (L.tool) aim(tool(L.tool), 'hand_r', Y, new THREE.Vector3(...(AIM[L.tool] || [0, 1, 0.55])));
    if (L.shield) aim(shield(L.shield), 'hand_l', Z, new THREE.Vector3(0.55, 0, 0.85));
    if (L.helm || L.hat) props.push([helmet(L.helm || L.hat, L.plume), 'Head']);
    // soldados: tabardo na cor do reino no peito e nas costas, com cinto
    if (KM.SOLDIERS[type]) {
      const sp = bones.spine_03, at = sp.getWorldPosition(new THREE.Vector3()), tab = new THREE.Group();
      const yb = at.y - 0.32, w = female ? 0.3 : 0.34;
      for (const z of [0.15, -0.14]) { const p = piece(new THREE.BoxGeometry(w, 0.62, 0.02), 'cloth', TEAM); p.position.set(0, yb, z * (female ? 0.95 : 1)); tab.add(p); }
      const emb = piece(new THREE.BoxGeometry(0.1, 0.1, 0.025), 'metal', GOLD); emb.position.set(0, yb + 0.12, 0.162); tab.add(emb);
      const belt = piece(new THREE.BoxGeometry(w + 0.04, 0.05, 0.32), 'wood', '#7a5a40'); belt.position.set(0, at.y - 0.42, 0); tab.add(belt);
      tab.applyMatrix4(new THREE.Matrix4().copy(sp.matrixWorld).invert());
      props.push([tab, 'spine_03']);
    }
    // espaço do osso -> espaço de ligação da malha: inverse(boneInverse) leva do osso (em repouso de ligação) ao mundo
    for (const [grp, bone] of props) {
      const bi = order.indexOf(bone);
      grp.updateMatrix(); grp.updateMatrixWorld(true);
      const boneBind = new THREE.Matrix4().copy(ref.skeleton.boneInverses[bi]).invert();
      grp.traverse((o) => {
        if (!o.isMesh) return;
        o.updateMatrix();
        const local = new THREE.Matrix4().multiplyMatrices(grp.matrix, o.matrix);
        const m4 = new THREE.Matrix4().multiplyMatrices(refBindInv, boneBind).multiply(local);
        const u = o.userData, c = new THREE.Color(u.c).toArray();
        const tex = u.t === 'model' ? (P.cells[u.mn] != null ? P.cells[u.mn] : P.white) : P.rect[u.t] || P.rect.white;
        parts.push(part(o.geometry, null, () => bi, m4, tex, u.team ? SLOT.team : SLOT.raw, c));
      });
    }
    pose.stopAllAction(); pose.uncacheRoot(body);
    const merged = THREE.BufferGeometryUtils.mergeGeometries(parts, false);
    merged.computeBoundingSphere();
    return (P.geo[key] = { geo: merged, bodyK, bindMatrix: ref.bindMatrix.clone() });
  }

  // material por unidade (mesmo programa para todos): atlas x cor do vértice x paleta
  function material(pal) {
    const m = new THREE.MeshToonMaterial({ map: P.atlas, vertexColors: true, gradientMap: KM.ART.gradient, alphaTest: 0.5 });
    m.userData.pal = pal;
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPal = { value: pal };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float slot;\nuniform vec3 uPal[5];')
        .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb *= uPal[int(slot + 0.5)];');
    };
    m.customProgramCacheKey = () => 'people-pal';
    return m;
  }

  // monta uma pessoa; v = semente da variação (id da unidade)
  P.build = function (type, owner, v) {
    const lk = look(type, v), L = lk.L, G = geometry(type, lk);
    const team = new THREE.Color(KM.COLORS[owner] || '#888888');
    const cloth = L.team ? new THREE.Color('#ffffff').lerp(team, L.team) : L.tint ? new THREE.Color('#ffffff').lerp(new THREE.Color(L.tint), 0.55) : new THREE.Color('#ffffff');
    const mkey = [type, owner, lk.hairC, lk.skinC].join('|');
    const mat = P.mats[mkey] || (P.mats[mkey] = material([cloth, new THREE.Color(lk.skinC), new THREE.Color(lk.hairC), team.clone(), new THREE.Color('#ffffff')]));
    // esqueleto próprio da unidade (clone do corpo base sem as malhas dele)
    const body = THREE.SkeletonUtils.clone(P.src[G.bodyK].scene);
    let ref = null;
    body.traverse((o) => { if (o.isSkinnedMesh && !ref) ref = o; });
    const mesh = new THREE.SkinnedMesh(G.geo, mat);
    mesh.position.copy(ref.position); mesh.quaternion.copy(ref.quaternion); mesh.scale.copy(ref.scale);
    mesh.bind(ref.skeleton, G.bindMatrix);
    mesh.castShadow = true; mesh.frustumCulled = false;
    const rm = [];
    body.traverse((o) => { if (o.isSkinnedMesh) rm.push(o); });
    ref.parent.add(mesh);
    for (const o of rm) o.parent.remove(o);
    const wrap = new THREE.Group();
    wrap.add(body);
    wrap.scale.setScalar(KM.PEOPLE_SCALE);
    return { obj: wrap, inner: body };
  };
})(window.KM);

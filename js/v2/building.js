// v2 빌딩: 곡면 루프라인 + 수직 루버 파사드 + 유리 커튼월 + 인테리어 (레퍼런스 오마주, WeBlock 브랜딩)
import * as THREE from 'three';
import { clamp, lerp, sat, smoothstep, rng } from '../util.js';

// 전체 치수 (추상 단위): 길이 470, 최고 높이 ~190, 깊이 ~150
export const LEN = 390;
export const HMAX = 192;
export const DONE_X = 300; // 완공 시 uBuild(x 스윕) 값

// ---------------------------------------------------------------- 평면 아웃라인/루프라인
export function depthAt(x) { return lerp(74, 58, smoothstep(-90, 170, x)); }
export function roofAt(x) {
  let h = lerp(182, 96, smoothstep(-105, 120, x) ** 1.15);
  h += 9 * smoothstep(120, 190, x);             // 우측 끝 테라스 들림
  return h;
}
// 닫힌 아웃라인 샘플: [{x,z,nx,nz,s}] (s=아크길이 0..1)
export function buildOutline(N = 320) {
  const pts = [];
  const L2 = LEN / 2;
  const dEnd = (sideX) => depthAt(sideX);
  // 우측 캡 중심/좌측 캡 중심
  const cR = L2 - dEnd(L2), cL = -L2 + dEnd(-L2);
  const seg = [];
  // 뒤쪽(z-) 좌→우
  for (let i = 0; i <= 90; i++) { const x = lerp(cL, cR, i / 90); seg.push([x, -depthAt(x)]); }
  // 우측 캡 (뒤→앞 반원)
  for (let i = 1; i <= 60; i++) { const a = -Math.PI / 2 + (i / 60) * Math.PI; const r = dEnd(L2); seg.push([cR + Math.cos(a) * r, Math.sin(a) * r]); }
  // 앞쪽(z+) 우→좌
  for (let i = 1; i <= 90; i++) { const x = lerp(cR, cL, i / 90); seg.push([x, depthAt(x)]); }
  // 좌측 캡 (앞→뒤 반원)
  for (let i = 1; i < 60; i++) { const a = Math.PI / 2 + (i / 60) * Math.PI; const r = dEnd(-L2); seg.push([cL + Math.cos(a) * r, Math.sin(a) * r]); }
  // 아크길이
  let total = 0;
  const acc = [0];
  for (let i = 1; i < seg.length; i++) { total += Math.hypot(seg[i][0] - seg[i - 1][0], seg[i][1] - seg[i - 1][1]); acc.push(total); }
  const M = seg.length;
  for (let i = 0; i < M; i++) {
    const p = seg[i], pPrev = seg[(i - 1 + M) % M], pNext = seg[(i + 1) % M];
    let tx = pNext[0] - pPrev[0], tz = pNext[1] - pPrev[1];
    const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let nx = tz, nz = -tx; // 법선 후보
    const cx = clamp(p[0], cL, cR);
    const rx = p[0] - cx, rz2 = p[1];
    if (nx * rx + nz * rz2 < 0) { nx = -nx; nz = -nz; }
    pts.push({ x: p[0], z: p[1], nx, nz, s: acc[i] / total });
  }
  pts.total = total;
  return pts;
}

// 전면 유리 개구부: 루버 하단 높이 (기본 3 = 지면 근처까지)
function finBottomAt(x, nz) {
  if (nz < 0.35) return 14; // 후면/캡은 풀 루버 (1층 링 위)
  const h = roofAt(x);
  // 전면: 프라우(x<-95)만 풀 루버, 그 오른쪽은 통유리 + 지붕 아래 루버 밴드
  const glass = smoothstep(-100, -78, x) * (1 - smoothstep(168, 192, x));
  let b = 14;
  b = lerp(b, h - 21, glass);
  return b;
}

// ---------------------------------------------------------------- 루버 핀 (CPU 인스턴스 애니메이션)
export function createFins(envMap) {
  const outline = buildOutline(360);
  const SPACING = 3.6;
  const count = Math.floor(outline.total / SPACING);
  const rand = rng(20260729);
  const fins = [];
  for (let i = 0; i < count; i++) {
    const s = i / count;
    // s 위치의 아웃라인 포인트 보간
    const f = s * outline.length;
    const i0 = Math.floor(f) % outline.length, i1 = (i0 + 1) % outline.length;
    const t = f - Math.floor(f);
    const p = {
      x: lerp(outline[i0].x, outline[i1].x, t),
      z: lerp(outline[i0].z, outline[i1].z, t),
      nx: lerp(outline[i0].nx, outline[i1].nx, t),
      nz: lerp(outline[i0].nz, outline[i1].nz, t),
    };
    const bot = finBottomAt(p.x, p.nz);
    const top = roofAt(p.x) - 1;
    if (top - bot < 6) continue;
    const h = top - bot;
    const yaw = Math.atan2(p.nx, p.nz);
    fins.push({
      px: p.x + p.nx * 4.5, pz: p.z + p.nz * 4.5, py: bot + h / 2,
      h, yaw, seed: rand(),
      scatX: p.x + p.nx * (120 + rand() * 240) + (rand() - 0.5) * 160,
      scatY: bot + h / 2 + 60 + rand() * 160,
      scatZ: p.z + p.nz * (120 + rand() * 240) + (rand() - 0.5) * 160,
    });
  }
  const geo = new THREE.BoxGeometry(2.1, 1, 6);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x71553a, metalness: 0.4, roughness: 0.42,
    envMap, envMapIntensity: 1.15, transparent: true,
    emissive: 0x1a1108, emissiveIntensity: 1.0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, fins.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const M0 = new THREE.Matrix4(); M0.makeScale(0, 0, 0);

  function update(buildX, holo, ghost, t) {
    for (let i = 0; i < fins.length; i++) {
      const f = fins[i];
      const p = sat((buildX - f.px) / 70 - f.seed * 0.25);
      if (p <= 0.001) { mesh.setMatrixAt(i, M0); continue; }
      const e = 1 - Math.pow(1 - Math.min(p, 1), 3);
      dummy.position.set(lerp(f.scatX, f.px, e), lerp(f.scatY, f.py, e), lerp(f.scatZ, f.pz, e));
      dummy.rotation.set((1 - e) * (f.seed - 0.5) * 4, f.yaw + (1 - e) * (f.seed - 0.5) * 6, 0);
      dummy.scale.set(1, f.h * lerp(0.6, 1, e), 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mat.opacity = (1 - ghost * 0.82) * (1 - holo);
    mesh.visible = mat.opacity > 0.02 && buildX > -260;
  }
  return { mesh, mat, update, fins };
}

// ---------------------------------------------------------------- 유리 헐 (Physical + 주입)
export function createHull(envMap) {
  const outline = buildOutline(300);
  const S = outline.length, V = 24;
  const verts = new Float32Array((S + 1) * (V + 1) * 3);
  const uvs = new Float32Array((S + 1) * (V + 1) * 2);
  const idx = [];
  for (let si = 0; si <= S; si++) {
    const o = outline[si % S];
    const inX = o.x - o.nx * 5, inZ = o.z - o.nz * 5;
    const top = roofAt(o.x) - 5;
    for (let vi = 0; vi <= V; vi++) {
      const v = vi / V;
      const i = si * (V + 1) + vi;
      verts[i * 3] = inX; verts[i * 3 + 1] = lerp(1.5, top, v); verts[i * 3 + 2] = inZ;
      uvs[i * 2] = (si === S ? 1 : o.s); uvs[i * 2 + 1] = v;
    }
  }
  for (let si = 0; si < S; si++) {
    for (let vi = 0; vi < V; vi++) {
      const a = si * (V + 1) + vi, b = a + V + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const u = {
    uBuild: { value: -260 },
    uTime: { value: 0 },
    uGhost: { value: 0 },
    uHolo: { value: 0 },
    uScanX: { value: -300 },
    uScanI: { value: 0 },
    uPerim: { value: outline.total },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2016, metalness: 0.1, roughness: 0.08,
    clearcoat: 1.0, clearcoatRoughness: 0.2,
    envMap, envMapIntensity: 1.3,
    transparent: true, opacity: 0.38,
    side: THREE.DoubleSide, depthWrite: false,
  });
  mat.defines = { ...(mat.defines || {}), USE_UV: '' };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        varying vec3 vWp;
        uniform float uBuild, uTime, uGhost, uHolo, uScanX, uScanI, uPerim;
        float bhash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float gAlphaMul = 1.0;
      `)
      .replace('#include <clipping_planes_fragment>', /* glsl */`
        #include <clipping_planes_fragment>
        if (vWp.x > uBuild) discard;
        float ghostAll = max(uGhost, uHolo);
        gAlphaMul = mix(1.0, 0.5, ghostAll);
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        {
          vec3 E = vec3(0.0);
          // 멀리언 (아크길이 기준 세로줄)
          float mull = smoothstep(0.94, 1.0, fract(vUv.x * uPerim / 4.6));
          E += vec3(0.06, 0.05, 0.04) * mull * 0.5;
          // 스캔 플레인
          E += vec3(0.55, 0.35, 1.0) * smoothstep(7.0, 0.0, abs(vWp.x - uScanX)) * uScanI * 3.0;
          // 홀로 그리드
          float ghostAll2 = max(uGhost, uHolo);
          if (ghostAll2 > 0.001) {
            float hg = smoothstep(0.9, 1.0, fract(vUv.y * 16.0)) + smoothstep(0.92, 1.0, fract(vUv.x * uPerim / 22.0));
            E += vec3(0.48, 0.30, 1.0) * ghostAll2 * (0.3 + hg * 1.0);
          }
          totalEmissiveRadiance += E;
        }
      `)
      .replace('#include <alphamap_fragment>', /* glsl */`
        #include <alphamap_fragment>
        diffuseColor.a *= gAlphaMul;
      `);
  };
  mat.customProgramCacheKey = () => 'weblock-hull-v3';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4;

  // 내벽: 유리 너머로 보이는 따뜻한 실내 벽 (관통 방지)
  const wallVerts = new Float32Array((S + 1) * 2 * 3);
  const wallIdx = [];
  for (let si = 0; si <= S; si++) {
    const o = outline[si % S];
    const ix = o.x - o.nx * 15, iz = o.z - o.nz * 15;
    const top = roofAt(o.x) - 6;
    wallVerts[si * 6] = ix; wallVerts[si * 6 + 1] = 0.5; wallVerts[si * 6 + 2] = iz;
    wallVerts[si * 6 + 3] = ix; wallVerts[si * 6 + 4] = top; wallVerts[si * 6 + 5] = iz;
  }
  for (let si = 0; si < S; si++) {
    const a = si * 2, b2 = a + 1, c2 = a + 2, d2 = a + 3;
    wallIdx.push(a, c2, b2, b2, c2, d2);
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wallVerts, 3));
  wallGeo.setIndex(wallIdx);
  wallGeo.computeVertexNormals();
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x2e2014, roughness: 0.9, metalness: 0.05,
    emissive: 0x3a2008, emissiveIntensity: 1.8,
    side: THREE.BackSide, transparent: true,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.renderOrder = 1;

  // 실내 바닥 (웜 우드)
  const floorShape = new THREE.Shape(outline.map((o) => new THREE.Vector2(o.x - o.nx * 8, o.z - o.nz * 8)));
  const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 1.4, bevelEnabled: false });
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.85, emissive: 0x180d05, emissiveIntensity: 1, transparent: true });
  const innerFloor = new THREE.Mesh(floorGeo, floorMat);
  innerFloor.position.y = 2.2;
  innerFloor.renderOrder = 1;

  return { mesh, u, outline, wall, innerFloor, clipMats: [mat, wallMat, floorMat], ghostMats: [wallMat, floorMat] };
}

// ---------------------------------------------------------------- 루프 리본 (브론즈 밴드)
export function createRibbon(envMap) {
  const outline = buildOutline(240);
  const path = new THREE.CatmullRomCurve3(
    outline.map((o) => new THREE.Vector3(o.x, roofAt(o.x) + 1.5, o.z)), true, 'catmullrom', 0.1
  );
  const geo = new THREE.TubeGeometry(path, 420, 6.8, 12, true);
  const u = { uBuild: { value: -260 } };
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x7a5a34, metalness: 0.75, roughness: 0.32,
    envMap, envMapIntensity: 1.5, transparent: true,
    emissive: 0x1c1206, emissiveIntensity: 1.0,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform float uBuild;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vWp.x > uBuild) discard;');
  };
  mat.customProgramCacheKey = () => 'weblock-ribbon-v3';
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, u, mat };
}

// ---------------------------------------------------------------- 인테리어 (개구부 너머)
export function createInterior(envMap) {
  const group = new THREE.Group();
  const mats = [];
  const M = (m) => { m.transparent = true; mats.push(m); return m; };

  // 슬래브 2장 (인셋 아웃라인 → 셰이프)
  const outline = buildOutline(140);
  const mkSlab = (y, maxX) => {
    const pts = outline
      .filter((o) => o.x < maxX)
      .map((o) => new THREE.Vector2(clamp(o.x, -999, maxX) , o.z * 0.99));
    if (pts.length < 8) return;
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x - p.x * 0.04, p.y * 0.86)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, M(new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85, emissive: 0x1e1206, emissiveIntensity: 1 })));
    mesh.position.y = y;
    group.add(mesh);
  };
  mkSlab(48, 34);
  mkSlab(96, -60);

  // 오쿨루스 (발광 디스크 + 링)
  const ocu = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 30, 2, 40),
    M(new THREE.MeshBasicMaterial({ color: 0xffe8c8, toneMapped: false }))
  );
  ocu.position.set(-10, 112, 0);
  const ocuRing = new THREE.Mesh(
    new THREE.TorusGeometry(34, 2.2, 10, 44),
    M(new THREE.MeshStandardMaterial({ color: 0x6b4e2e, metalness: 0.6, roughness: 0.4, envMap }))
  );
  ocuRing.rotation.x = Math.PI / 2;
  ocuRing.position.copy(ocu.position);
  group.add(ocu, ocuRing);

  // 나선 계단 + 기둥
  const stair = new THREE.Group();
  const stepGeo = new THREE.BoxGeometry(16, 1.6, 6);
  const stepMat = M(new THREE.MeshStandardMaterial({ color: 0xc9a878, roughness: 0.6, emissive: 0x241505, emissiveIntensity: 1 }));
  for (let i = 0; i < 34; i++) {
    const a = i * 0.42, y = 5 + i * 2.9;
    const st = new THREE.Mesh(stepGeo, stepMat);
    st.position.set(52 + Math.cos(a) * 20, y, Math.sin(a) * 20);
    st.rotation.y = -a;
    stair.add(st);
  }
  const col = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 110, 16), M(new THREE.MeshStandardMaterial({ color: 0x8a7358, roughness: 0.5, emissive: 0x1a1206, emissiveIntensity: 1 })));
  // 구조 기둥 (유리 너머 리듬)
  const pillarMat = M(new THREE.MeshStandardMaterial({ color: 0x9a8060, roughness: 0.55, emissive: 0x3a2410, emissiveIntensity: 1 }));
  [-70, -20, 30, 85, 135].forEach((px, pi) => {
    const ph = Math.max(roofAt(px) - 24, 60);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, ph, 12), pillarMat);
    pl.position.set(px, ph / 2 + 2, pi % 2 ? 18 : -14);
    stair.add(pl);
  });
  col.position.set(52, 56, 0);
  stair.add(col);
  group.add(stair);

  // 웜 램프 스프라이트
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g2 = c.getContext('2d');
  const grad = g2.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,220,170,1)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g2.fillStyle = grad; g2.fillRect(0, 0, 64, 64);
  const lampTex = new THREE.CanvasTexture(c);
  const rand = rng(88);
  for (let i = 0; i < 52; i++) {
    const sm = M(new THREE.SpriteMaterial({ map: lampTex, color: 0xffdcb0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const sp = new THREE.Sprite(sm);
    const low = i < 12;
    sp.scale.setScalar(low ? 7 + rand() * 6 : 14 + rand() * 16);
    { const lx = -150 + rand() * (low ? 290 : 320); const ly = low ? 5 + rand() * 8 : 8 + rand() * 76; sp.position.set(lx, ly, (rand() - 0.5) * depthAt(lx) * 0.7); }
    group.add(sp);
  }
  // 1층 가구/카운터 매스
  const furnMat = M(new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.8, emissive: 0x241304, emissiveIntensity: 1 }));
  for (let i = 0; i < 14; i++) {
    const w = 14 + rand() * 22, d = 8 + rand() * 10, h2 = 5 + rand() * 6;
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h2, d), furnMat);
    { const fx = -170 + rand() * 380; f.position.set(fx, 2.5 + h2 / 2, (rand() - 0.5) * depthAt(fx) * 0.7); }
    f.rotation.y = rand() * Math.PI;
    group.add(f);
  }
  // 실내 전체를 채우는 대형 웜 글로우
  for (let i = 0; i < 4; i++) {
    const sm = M(new THREE.SpriteMaterial({ map: lampTex, color: 0xffc890, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    const sp = new THREE.Sprite(sm);
    sp.scale.set(100, 66, 1);
    sp.position.set(-130 + i * 70, 40, 0);
    group.add(sp);
  }
  function update(intensity) {
    group.visible = intensity > 0.02;
    for (const m of mats) m.opacity = intensity;
  }
  return { group, update };
}

// ---------------------------------------------------------------- WeBlock 메달리온
export function createMedallion(envMap) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = '#12091f';
    g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    g.lineWidth = 14; g.strokeStyle = '#8a5cff';
    g.beginPath(); g.arc(256, 256, 240, 0, 7); g.stroke();
    const U = 62, G = 6, P = U + G;
    const mx = 256 - (P * 4 + U) / 2, my = 168;
    const blocks = [[0, 0], [4, 0], [2, 0.55], [1, 1.1], [3, 1.1]];
    blocks.forEach(([cx, cy], bi) => {
      g.fillStyle = ['#a684ff', '#a684ff', '#9d7bff', '#8a5cff', '#8a5cff'][bi];
      g.fillRect(mx + cx * P, my + cy * U, U, U);
    });
    g.fillStyle = '#f2f0fa';
    g.font = '800 58px Pretendard, sans-serif';
    g.textAlign = 'center';
    g.fillText('WeBlock', 256, 392);
    tex.needsUpdate = true;
  };
  draw();
  const group = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(27, 27, 2.6, 48),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1030, metalness: 0.5, roughness: 0.35, envMap, envMapIntensity: 1.2, transparent: true })
  );
  disc.rotation.x = Math.PI / 2;
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(25.5, 48), faceMat);
  face.position.z = 1.5;
  group.add(disc, face);
  // 프라우 전면 배치
  const outline = buildOutline(200);
  let best = null;
  for (const o of outline) if (o.nz > 0.5 && o.x < -95 && (!best || o.x < best.x)) best = o;
  const p = best || { x: -170, z: 70, nx: 0, nz: 1 };
  group.position.set(p.x + p.nx * 13, 142, p.z + p.nz * 13);
  group.rotation.y = Math.atan2(p.nx, p.nz);
  const glowMat = faceMat;
  function update(lit, ghost) {
    group.traverse((o) => { if (o.material) o.material.opacity = 1 - ghost * 0.8; });
    glowMat.color.setScalar(0.45 + lit * 0.75);
  }
  return { group, update, redraw: draw };
}

// ---------------------------------------------------------------- 디지털 조각 (헐 표면 → 토큰 링)
export function createFractions() {
  const COUNT = 4200;
  const rand = rng(555777);
  const outline = buildOutline(280);
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);
  const aPos = new Float32Array(COUNT * 3);
  const aQuat = new Float32Array(COUNT * 4);
  const aScale = new Float32Array(COUNT * 2);
  const aSeed = new Float32Array(COUNT);
  const aRing = new Float32Array(COUNT * 3);
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  const tv = new THREE.Vector3(), bv = new THREE.Vector3(0, 1, 0), nv = new THREE.Vector3();
  for (let i = 0; i < COUNT; i++) {
    const oi = Math.floor(rand() * outline.length);
    const o = outline[oi];
    const top = roofAt(o.x);
    const y = 4 + rand() * (top - 10);
    aPos[i * 3] = o.x + o.nx * 5; aPos[i * 3 + 1] = y; aPos[i * 3 + 2] = o.z + o.nz * 5;
    nv.set(o.nx, 0, o.nz);
    tv.crossVectors(bv, nv).normalize();
    m.makeBasis(tv, bv, nv);
    q.setFromRotationMatrix(m);
    aQuat[i * 4] = q.x; aQuat[i * 4 + 1] = q.y; aQuat[i * 4 + 2] = q.z; aQuat[i * 4 + 3] = q.w;
    aScale[i * 2] = 3.0 + rand() * 1.7;
    aScale[i * 2 + 1] = 2.4 + rand() * 1.5;
    const seed = rand();
    aSeed[i] = seed;
    const ringPick = seed < 0.4 ? 0 : seed < 0.75 ? 1 : 2;
    aRing[i * 3] = [330, 420, 510][ringPick] + (rand() - 0.5) * 26;
    aRing[i * 3 + 1] = [120, 190, 260][ringPick] + (rand() - 0.5) * 36;
    aRing[i * 3 + 2] = rand() * Math.PI * 2;
  }
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aQuat', new THREE.InstancedBufferAttribute(aQuat, 4));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(aScale, 2));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  geo.setAttribute('aRing', new THREE.InstancedBufferAttribute(aRing, 3));
  geo.instanceCount = COUNT;

  const u = {
    uShatter: { value: 0 },
    uRingRot: { value: 0 },
    uFade: { value: 1 },
    uEdge: { value: 0 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 aPos; attribute vec4 aQuat; attribute vec2 aScale; attribute float aSeed; attribute vec3 aRing;
      uniform float uShatter, uRingRot, uTime, uFade;
      varying vec2 vUvP; varying float vAlpha; varying float vSeed;
      vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
      float easeIO(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }
      void main(){
        vUvP = uv; vSeed = aSeed;
        float delay = aSeed * 0.30 + clamp((aPos.x + 250.0) / 520.0, 0.0, 1.0) * 0.5;
        float local = clamp((uShatter * 1.75 - delay) / 0.55, 0.0, 1.0);
        float e = easeIO(local);
        float spin = sin(3.14159 * e) * (aSeed - 0.5) * 5.0;
        vec2 rp = vec2(position.x * cos(spin) - position.y * sin(spin), position.x * sin(spin) + position.y * cos(spin));
        vec3 lp = vec3(rp * aScale, 0.0);
        vec3 surface = aPos + qrot(aQuat, lp);
        float ringSpeed = 0.4 + aSeed * 0.9;
        float ang = aRing.z + uRingRot * ringSpeed;
        vec3 rc = vec3(cos(ang) * aRing.x, aRing.y + sin(uTime * 0.6 + aSeed * 21.0) * 5.0, sin(ang) * aRing.x);
        vec3 rn = normalize(vec3(rc.x, 0.0, rc.z));
        vec3 rup = vec3(0.0, 1.0, 0.0);
        vec3 rt = normalize(cross(rup, rn));
        vec3 ring = rc + rt * rp.x * aScale.x + rup * rp.y * aScale.y;
        vec3 p = mix(surface, ring, e);
        p.y += sin(3.14159 * e) * 26.0;
        p += rn * sin(3.14159 * e) * 14.0;
        vAlpha = uFade * smoothstep(0.02, 0.16, local) * step(0.001, uShatter);
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUvP; varying float vAlpha; varying float vSeed;
      uniform float uEdge, uTime;
      void main(){
        if (vAlpha < 0.004) discard;
        vec2 b = abs(vUvP - 0.5);
        float edge = smoothstep(0.36, 0.5, max(b.x, b.y));
        float flick = 0.8 + 0.2 * sin(uTime * (2.0 + vSeed * 5.0) + vSeed * 47.0);
        vec3 face = vec3(0.10, 0.07, 0.22) * 0.25;
        vec3 edgeC = mix(vec3(0.55, 0.38, 1.0), vec3(0.78, 0.68, 1.0), step(0.5, vSeed));
        edgeC = mix(edgeC, vec3(1.0, 0.8, 0.42), step(0.93, vSeed));
        vec3 col = face * (0.3 + uEdge * 0.6) + edgeC * edge * (0.62 + uEdge * 0.8) * flick;
        gl_FragColor = vec4(col * vAlpha * 0.9, vAlpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return { mesh, u };
}

// ---------------------------------------------------------------- 히어로 토큰 카드
function drawTokenFace2(c) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 704);
  g.fillStyle = '#0a0716';
  g.fillRect(0, 0, 512, 704);
  g.strokeStyle = 'rgba(157,123,255,0.95)'; g.lineWidth = 6;
  g.strokeRect(18, 18, 476, 668);
  g.strokeStyle = 'rgba(109,46,245,0.35)'; g.lineWidth = 2;
  g.strokeRect(34, 34, 444, 636);
  const U = 44, G = 4, P = U + G;
  const mx = 256 - (P * 4 + U) / 2, my = 150;
  const blocks = [[0, 0], [4, 0], [2, 0.55], [1, 1.1], [3, 1.1]];
  blocks.forEach(([cx, cy], bi) => {
    g.fillStyle = ['#9d7bff', '#9d7bff', '#8f66ff', '#8a5cff', '#8a5cff'][bi];
    g.fillRect(mx + cx * P, my + cy * U, U, U);
  });
  g.fillStyle = '#F2F0FA';
  g.font = '800 62px Pretendard, sans-serif';
  g.textAlign = 'center';
  g.fillText('WeBlock', 256, 428);
  g.font = '400 28px Pretendard, sans-serif';
  g.fillStyle = 'rgba(190,175,255,0.85)';
  g.fillText('BUILDING FRACTION', 256, 482);
  g.font = '700 44px Pretendard, sans-serif';
  g.fillStyle = '#9d7bff';
  g.fillText('1 / 100,000', 256, 560);
  g.font = '400 23px Pretendard, sans-serif';
  g.fillStyle = 'rgba(140,130,180,0.85)';
  g.fillText('WBL · FLAGSHIP No.0001', 256, 634);
}
export function createToken(envMap) {
  const group = new THREE.Group();
  const W = 60, Hh = 82, D = 5.5;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 704;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const redraw = () => { drawTokenFace2(c); tex.needsUpdate = true; };
  redraw();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, Hh, D),
    new THREE.MeshPhysicalMaterial({ color: 0x120b26, metalness: 0.75, roughness: 0.28, envMap, envMapIntensity: 1.1, transparent: true })
  );
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.94, Hh * 0.94), faceMat);
  face.position.z = D / 2 + 0.15;
  const face2 = face.clone(); face2.rotation.y = Math.PI; face2.position.z = -D / 2 - 0.15;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0x9d7bff, transparent: true, opacity: 0.95 })
  );
  group.add(body, face, face2, edges);
  group.visible = false;
  return { group, mats: [body.material, faceMat, edges.material], redraw };
}

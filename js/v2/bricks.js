// 브릭 시스템 — 스터드 달린 진짜 블록으로 건물을 쌓고, 흩어서 조각(토큰)으로 만든다
import * as THREE from 'three';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '../util.js';

export const U = 10;     // 스터드 피치 (가로/세로)
export const BH = 12;    // 브릭 1단 높이
const STUD_R = 3.0;
const STUD_H = 2.0;
const GAP = 0.22;        // 브릭 사이 미세 간격 (실제 레고처럼 라인이 보이게)

// 머티리얼 팔레트 (레퍼런스: 트래버틴 스톤 / 우드 루버 / 다크 글래스 / 차콜)
export const MAT = {
  STONE: 0, WOOD: 1, GLASS: 2, DARK: 3, WHITE: 4, GREEN: 5, ASPHALT: 6, ACCENT: 7,
};
const COLORS = {
  [MAT.STONE]: 0xe8dcc4,
  [MAT.WOOD]: 0x9c6633,
  [MAT.GLASS]: 0x24333f,
  [MAT.DARK]: 0x2b2f36,
  [MAT.WHITE]: 0xf6f4ee,
  [MAT.GREEN]: 0x4a7c3f,
  [MAT.ASPHALT]: 0x3a3d44,
  [MAT.ACCENT]: 0x7c4dff,
};
const IS_GLASS = (m) => m === MAT.GLASS;

const LENGTHS = [8, 6, 4, 3, 2, 1];

// ---------------------------------------------------------------- 브릭 지오메트리 (박스 + 스터드 병합)
function brickGeometry(len) {
  const w = len * U - GAP, d = U - GAP, h = BH - GAP;
  const parts = [];
  const body = new THREE.BoxGeometry(w, h, d);
  parts.push(body);
  for (let i = 0; i < len; i++) {
    const stud = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 10, 1, false);
    stud.translate(-w / 2 + U * (i + 0.5) - GAP / 2 + GAP / 2, h / 2 + STUD_H / 2 - 0.4, 0);
    parts.push(stud);
  }
  const geo = BGU.mergeGeometries(parts, false);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------- 그리드 → 브릭 리스트
export class BrickGrid {
  constructor() { this.cells = new Map(); this.minY = 1e9; this.maxY = -1e9; }
  key(x, y, z) { return `${x}|${y}|${z}`; }
  set(x, y, z, mat) {
    this.cells.set(this.key(x, y, z), mat);
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }
  del(x, y, z) { this.cells.delete(this.key(x, y, z)); }
  has(x, y, z) { return this.cells.has(this.key(x, y, z)); }
  // 박스 채우기 (경계 포함)
  fill(x0, x1, z0, z1, y0, y1, mat) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.set(x, y, z, mat);
  }
  // 속 빈 벽 (두께 1)
  shell(x0, x1, z0, z1, y0, y1, mat) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (x === x0 || x === x1 || z === z0 || z === z1) this.set(x, y, z, mat);
  }
  clear(x0, x1, z0, z1, y0, y1) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) this.del(x, y, z);
  }
  // X축 런렝스 병합 → 브릭 (스태거드 본드: 행마다 시작점 어긋나게)
  toBricks() {
    const rows = new Map(); // `${y}|${z}` → [{x, mat}]
    for (const [k, mat] of this.cells) {
      const [x, y, z] = k.split('|').map(Number);
      const rk = `${y}|${z}`;
      if (!rows.has(rk)) rows.set(rk, []);
      rows.get(rk).push({ x, mat });
    }
    const bricks = [];
    for (const [rk, list] of rows) {
      const [y, z] = rk.split('|').map(Number);
      list.sort((a, b) => a.x - b.x);
      let i = 0;
      // 행마다 오프셋을 줘서 이음매가 어긋나게
      const stagger = ((y * 7 + z * 3) % 2) === 0 ? 0 : 1;
      let firstRun = true;
      while (i < list.length) {
        const mat = list[i].mat;
        // 연속 구간 길이
        let run = 1;
        while (i + run < list.length && list[i + run].x === list[i].x + run && list[i + run].mat === mat) run++;
        let placed = 0;
        while (placed < run) {
          const remain = run - placed;
          let len = LENGTHS.find((L) => L <= remain) || 1;
          if (firstRun && stagger === 1 && remain > 2 && len > 2) len = 2; // 본드 어긋내기
          firstRun = false;
          bricks.push({ x: list[i].x + placed, y, z, len, mat });
          placed += len;
        }
        i += run;
      }
    }
    return bricks;
  }
}

// ---------------------------------------------------------------- 브릭 셰이더 주입
function injectBrickAnim(mat, u) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        attribute vec3 aTgt;
        attribute vec3 aScat;
        attribute vec3 aRing;
        attribute float aSeed;
        attribute float aOrder;
        uniform float uProg, uShatter, uRingRot, uTime, uReveal;
        varying float vFly;
        vec3 gPos; float gAng; float gHide;
        mat2 rot2b(float a){ float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
        float easeIO3(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }
      `)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        #include <beginnormal_vertex>
        {
          // ── 조립 (아래→위, 스태거)
          float p = clamp((uProg * 1.18 - aOrder) / 0.14, 0.0, 1.0);
          float e = 1.0 - pow(1.0 - p, 3.0);
          gHide = step(p, 0.0005);
          vec3 pos = mix(aScat, aTgt, e);
          pos.y += sin(3.14159 * e) * 26.0;
          float ang = (1.0 - e) * (aSeed - 0.5) * 9.0;
          vFly = 1.0 - e;

          // ── 조각화 (표면 → 토큰 링)
          float delay = aSeed * 0.32 + aOrder * 0.42;
          float sh = clamp((uShatter * 1.85 - delay) / 0.5, 0.0, 1.0);
          if (sh > 0.0) {
            float se = easeIO3(sh);
            float spd = 0.4 + aSeed * 0.9;
            float a2 = aRing.z + uRingRot * spd;
            vec3 rc = vec3(cos(a2) * aRing.x, aRing.y + sin(uTime * 0.6 + aSeed * 21.0) * 6.0, sin(a2) * aRing.x);
            pos = mix(pos, rc, se);
            pos.y += sin(3.14159 * se) * 30.0;
            ang += se * (aSeed - 0.5) * 14.0 + uRingRot * spd;
            vFly = max(vFly, se);
          }
          gPos = pos; gAng = ang;
          objectNormal.xz = rot2b(gAng) * objectNormal.xz;
        }
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        transformed.xz = rot2b(gAng) * transformed.xz;
        transformed += gPos;
        if (gHide > 0.5 || aTgt.x > uReveal + 9000.0) transformed = vec3(0.0);
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        varying float vFly;
        uniform float uGhostB;
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.42, 0.30, 1.0) * vFly * 0.4;
        totalEmissiveRadiance += vec3(0.35, 0.24, 0.9) * uGhostB * 0.5;
      `);
  };
  mat.customProgramCacheKey = () => 'weblock-brick-v1' + (mat.transparent ? '-g' : '');
}

// ---------------------------------------------------------------- 빌드
export function buildBrickMeshes(bricks, envMap, opts = {}) {
  const rand = rng(31337);
  const originX = opts.originX ?? 0, originZ = opts.originZ ?? 0;
  const u = {
    uProg: { value: 0 },
    uShatter: { value: 0 },
    uRingRot: { value: 0 },
    uTime: { value: 0 },
    uReveal: { value: 1e9 },
    uGhostB: { value: 0 },
  };

  const opaque = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.66, metalness: 0.04,
    envMap, envMapIntensity: 0.55,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.12, metalness: 0.0,
    clearcoat: 1.0, clearcoatRoughness: 0.15,
    envMap, envMapIntensity: 1.5,
    transparent: true, opacity: 0.62,
  });
  injectBrickAnim(opaque, u);
  injectBrickAnim(glass, u);

  // 정렬: 아래→위, 같은 층은 안쪽→바깥쪽
  bricks.sort((a, b) => (a.y - b.y) || (Math.abs(a.x - 16) + Math.abs(a.z - 12)) - (Math.abs(b.x - 16) + Math.abs(b.z - 12)));
  const N = bricks.length;

  // 그룹: [glass?][len]
  const groups = new Map();
  bricks.forEach((b, i) => {
    const g = (IS_GLASS(b.mat) ? 'g' : 'o') + b.len;
    if (!groups.has(g)) groups.set(g, []);
    b.order = N > 1 ? i / (N - 1) : 0;
    groups.get(g).push(b);
  });

  const meshes = [];
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (const [gk, list] of groups) {
    const isG = gk[0] === 'g';
    const len = parseInt(gk.slice(1), 10);
    const geo = brickGeometry(len);
    const mesh = new THREE.InstancedMesh(geo, isG ? glass : opaque, list.length);
    mesh.frustumCulled = false;
    if (isG) mesh.renderOrder = 3;
    const aTgt = new Float32Array(list.length * 3);
    const aScat = new Float32Array(list.length * 3);
    const aRing = new Float32Array(list.length * 3);
    const aSeed = new Float32Array(list.length);
    const aOrder = new Float32Array(list.length);
    list.forEach((b, i) => {
      const wx = (b.x + len / 2 - originX) * U;
      const wy = b.y * BH + BH / 2;
      const wz = (b.z + 0.5 - originZ) * U;
      aTgt[i * 3] = wx; aTgt[i * 3 + 1] = wy; aTgt[i * 3 + 2] = wz;
      const ang = rand() * Math.PI * 2, rr = 260 + rand() * 420;
      aScat[i * 3] = Math.cos(ang) * rr;
      aScat[i * 3 + 1] = wy + 190 + rand() * 300;
      aScat[i * 3 + 2] = Math.sin(ang) * rr;
      const seed = rand();
      aSeed[i] = seed;
      const pick = seed < 0.4 ? 0 : seed < 0.75 ? 1 : 2;
      aRing[i * 3] = [330, 430, 530][pick] + (rand() - 0.5) * 30;
      aRing[i * 3 + 1] = [110, 190, 265][pick] + (rand() - 0.5) * 40;
      aRing[i * 3 + 2] = rand() * Math.PI * 2;
      aOrder[i] = b.order;
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const base = COLORS[b.mat];
      col.setHex(base);
      const v = 0.93 + rand() * 0.14; // 미세 색 편차
      col.multiplyScalar(v);
      mesh.setColorAt(i, col);
    });
    geo.setAttribute('aTgt', new THREE.InstancedBufferAttribute(aTgt, 3));
    geo.setAttribute('aScat', new THREE.InstancedBufferAttribute(aScat, 3));
    geo.setAttribute('aRing', new THREE.InstancedBufferAttribute(aRing, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
    geo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(aOrder, 1));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    meshes.push(mesh);
  }
  return { meshes, u, materials: [opaque, glass], count: N };
}

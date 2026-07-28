// 타워: 슈퍼일립스 로프트 쉘 + 유리 셰이더, 코어/크레인, 크라운, 조각 패널, 히어로 토큰
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng, GLSL_COMMON } from './util.js';

export const H = 555;          // 타워 높이(m)
const BASE_A = 37;             // 기단 반폭(m)

// 높이 t(0..1)에서의 단면 정의 — 완만한 볼록 테이퍼, 사각→타원 모핑
export function towerSection(t) {
  const taper = Math.pow(t, 1.16);
  let rs = lerp(1.0, 0.235, taper);
  const crown = smoothstep(0.945, 1.0, t);
  rs *= 1.0 - crown * 0.66; // 크라운 핀치
  const n = lerp(3.6, 2.05, smoothstep(0.0, 0.85, t));
  const a = BASE_A * rs;
  const b = BASE_A * rs * lerp(1.0, 0.8, smoothstep(0.15, 1.0, t));
  return { a, b, n };
}
export function sectionPoint(theta, sec) {
  const c = Math.cos(theta), s = Math.sin(theta);
  const x = sec.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / sec.n);
  const z = sec.b * Math.sign(s) * Math.pow(Math.abs(s), 2 / sec.n);
  return [x, z];
}

// ---------------------------------------------------------------- 쉘 지오메트리
function buildShellGeometry(RAD = 144, ROWS = 250) {
  const cols = RAD + 1;
  const verts = new Float32Array(cols * (ROWS + 1) * 3);
  const uvs = new Float32Array(cols * (ROWS + 1) * 2);
  const idx = [];
  for (let r = 0; r <= ROWS; r++) {
    const t = r / ROWS;
    const sec = towerSection(t);
    for (let c = 0; c <= RAD; c++) {
      const theta = (c / RAD) * Math.PI * 2;
      const [x, z] = sectionPoint(theta, sec);
      const i = r * cols + c;
      verts[i * 3] = x; verts[i * 3 + 1] = t * H; verts[i * 3 + 2] = z;
      uvs[i * 2] = c / RAD; uvs[i * 2 + 1] = t;
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < RAD; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // 랩 심(u=0/1) 노멀 봉합
  const nrm = geo.attributes.normal;
  for (let r = 0; r <= ROWS; r++) {
    const i0 = r * cols, i1 = r * cols + RAD;
    const nx = (nrm.getX(i0) + nrm.getX(i1)) / 2;
    const ny = (nrm.getY(i0) + nrm.getY(i1)) / 2;
    const nz = (nrm.getZ(i0) + nrm.getZ(i1)) / 2;
    nrm.setXYZ(i0, nx, ny, nz); nrm.setXYZ(i1, nx, ny, nz);
  }
  return geo;
}

// ---------------------------------------------------------------- 유리 커튼월 셰이더
function buildShellMaterial() {
  const u = {
    uBuild: { value: 0 },            // 건설 컷 높이(m). 완성 = 565
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, -0.6).normalize() },
    uSunColor: { value: new THREE.Color(0xffd9a0) },
    uSunI: { value: 0.6 },
    uSkyZenith: { value: new THREE.Color(0x0a1128) },
    uSkyHorizon: { value: new THREE.Color(0x1e3a54) },
    uWinLit: { value: 0.0 },         // 점등률 0..1
    uWinWave: { value: 0.0 },        // 점등 스윕 (0..1, v 기준)
    uWork: { value: 0.0 },           // 공사 작업등
    uGhost: { value: 0.0 },          // 홀로그램화 0..1
    uHolo: { value: 0.0 },           // 서막 프리뷰 홀로그램
    uScanY: { value: -50 },          // 스캔라인 높이(m)
    uScanI: { value: 0.0 },
    uSeamGlow: { value: 0.0 },
    uGoldY: { value: 180 }, uGoldW: { value: 12 }, uGoldI: { value: 0.0 },
    uCrownLit: { value: 0.0 },
    uFrontier: { value: 0.0 },       // 공사 프런티어 발광
    uFogColor: { value: new THREE.Color(0x0a1020) },
    uFogDensity: { value: 0.00035 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec2 vUvS; varying float vViewZ;
      void main(){
        vUvS = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mv = viewMatrix * w;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vW; varying vec3 vN; varying vec2 vUvS; varying float vViewZ;
      uniform float uBuild, uTime, uSunI, uWinLit, uWinWave, uWork, uGhost, uHolo;
      uniform float uScanY, uScanI, uSeamGlow, uGoldY, uGoldW, uGoldI, uCrownLit, uFrontier, uFogDensity;
      uniform vec3 uSunDir, uSunColor, uSkyZenith, uSkyHorizon, uFogColor;
      ${GLSL_COMMON}
      const float FLOORS = 123.0;
      const float COLS = 160.0;
      void main(){
        float y = vW.y;
        float v = vUvS.y;
        float uu = vUvS.x;
        if (y > uBuild) discard;

        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        bool front = gl_FrontFacing;
        if (!front) {
          // 내부: 어두운 슬래브 힌트
          float fl = fract(v * FLOORS);
          float slab = smoothstep(0.06, 0.0, abs(fl - 0.5) - 0.42);
          vec3 icol = vec3(0.012, 0.016, 0.024) + vec3(0.05, 0.06, 0.08) * slab * 0.4;
          icol = applyFog(icol, vViewZ, uFogColor, uFogDensity);
          gl_FragColor = vec4(icol, mix(1.0, 0.25, uGhost));
          return;
        }

        // ── 크라운(랜턴) 영역
        float crown = smoothstep(0.945, 0.955, v);
        // 양 대각 모서리 슬릿: 보이는 부분 마스크
        float ang = atan(vW.z, vW.x);
        float slit = smoothstep(0.10, 0.30, abs(sin(ang + 0.785)));
        if (crown > 0.5 && slit < 0.15) discard;

        // ── 커튼월 격자
        float fl = fract(v * FLOORS);
        float col = fract(uu * COLS);
        float mullion = smoothstep(0.10, 0.0, abs(col - 0.5) - 0.40);       // 세로 흰 멀리언
        float spandrel = smoothstep(0.05, 0.0, abs(fl - 0.5) - 0.36);       // 층간 밴드

        // ── 유리 기조: 프레넬 하늘 반사
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
        vec3 R = reflect(-V, N);
        vec3 skyRef = mix(uSkyHorizon, uSkyZenith, clamp(R.y * 0.7 + 0.5, 0.0, 1.0));
        vec3 glass = vec3(0.016, 0.026, 0.045);
        vec3 colr = glass + skyRef * (0.16 + 0.55 * fres);

        // 태양 스펙큘러 (세로로 긴 하이라이트)
        vec3 Hv = normalize(normalize(uSunDir) + V);
        float spec = pow(max(dot(N, Hv), 0.0), 320.0);
        float streak = pow(max(dot(normalize(vec3(N.x, 0.0, N.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 42.0);
        colr += uSunColor * (spec * 3.2 + streak * 0.10) * uSunI;

        // 멀리언(흰 래커) 리듬
        colr = mix(colr, vec3(0.30, 0.34, 0.40) * (0.25 + 0.75 * fres + uSunI * 0.35), mullion * 0.55);
        colr = mix(colr, glass * 0.7, spandrel * 0.5);

        // ── 창문 점등
        vec2 cell = vec2(floor(uu * COLS), floor(v * FLOORS));
        float r1 = hash12(cell * 1.13 + 7.7);
        float midBoost = 0.55 + 0.45 * sin(3.14159 * clamp(v * 1.05, 0.0, 1.0));
        float ratio = clamp(uWinLit * midBoost * 1.25, 0.0, 1.0);
        float waveMask = step(v, uWinWave) * step(r1, 0.58);
        float lit = max(step(r1, ratio), waveMask * step(0.02, uWinWave));
        float winShape = step(0.12, col) * step(col, 0.88) * step(0.10, fl) * step(fl, 0.80);
        float warmPick = hash12(cell * 2.7 + 1.3);
        vec3 winC = mix(vec3(0.98, 0.82, 0.58), vec3(0.72, 0.83, 0.98), step(0.6, warmPick));
        float flick = 0.93 + 0.07 * sin(uTime * (0.6 + r1 * 1.8) + r1 * 40.0);
        float bright = 0.4 + 0.85 * hash12(cell + 3.1);
        colr += winC * winShape * lit * bright * flick * 0.78 * (1.0 - uGhost * 0.85);

        // 공사 작업등 (드문 주황 점)
        float work = step(0.986, r1) * uWork;
        colr += vec3(1.0, 0.62, 0.3) * winShape * work * 1.4;

        // ── 세로 심(구도심을 향한 이음), 크라운 모서리 심 2줄
        float seam = smoothstep(0.0035, 0.0012, abs(uu - 0.815));
        float seam2 = smoothstep(0.0030, 0.0010, abs(uu - 0.315)) * crown;
        colr = mix(colr, glass * 0.4, (seam + seam2) * 0.8);
        colr += vec3(0.35, 0.9, 1.0) * (seam + seam2) * uSeamGlow * 2.4;

        // ── 크라운 다이어그리드 + 발광
        if (crown > 0.0) {
          float d1 = abs(fract(uu * 30.0 + v * 130.0) - 0.5);
          float d2 = abs(fract(uu * 30.0 - v * 130.0) - 0.5);
          float grid = smoothstep(0.46, 0.5, max(d1, d2));
          vec3 latticeC = mix(vec3(0.55, 0.62, 0.72), vec3(1.0, 0.86, 0.6), uCrownLit * 0.6);
          colr = mix(colr, colr * 0.35, crown * 0.5);
          colr += latticeC * grid * crown * (0.12 + uCrownLit * 1.8);
          colr += vec3(1.0, 0.85, 0.6) * crown * uCrownLit * 0.22;
        }

        // ── 공사 프런티어 발광 밴드
        float fr = smoothstep(uBuild - 6.5, uBuild - 1.2, y);
        colr += mix(vec3(0.3, 0.85, 1.0), vec3(1.0, 0.72, 0.35), 0.35) * fr * uFrontier * 1.0;
        float frLine = smoothstep(uBuild - 1.6, uBuild - 0.3, y);
        colr += vec3(1.0, 0.95, 0.85) * frLine * uFrontier * 1.9;

        // ── 스캔라인
        float scan = smoothstep(5.5, 0.0, abs(y - uScanY));
        colr += vec3(0.30, 0.9, 1.0) * scan * uScanI * 3.5;

        // ── 골드 지분 밴드
        float gold = smoothstep(uGoldW, uGoldW * 0.35, abs(y - uGoldY));
        colr += vec3(1.0, 0.78, 0.38) * gold * uGoldI * 2.2;

        // ── 홀로그램 (고스트/프리뷰)
        float holoGrid = smoothstep(0.92, 1.0, fract(v * FLOORS * 0.5)) + smoothstep(0.94, 1.0, fract(uu * 40.0));
        vec3 holoC = vec3(0.25, 0.85, 1.0);
        float ghost = max(uGhost, uHolo);
        colr = mix(colr, holoC * (0.10 + holoGrid * 0.5 + fres * 0.8), ghost * 0.75);
        colr += holoC * fres * ghost * 0.5;

        float alpha = mix(1.0, 0.15 + fres * 0.45, ghost);
        if (crown > 0.5) alpha = min(alpha, 0.9);
        alpha = mix(alpha, alpha * 0.35, uHolo);

        colr = applyFog(colr, vViewZ, uFogColor, uFogDensity);
        gl_FragColor = vec4(colr, alpha);
      }
    `,
  });
  return { mat, u };
}

// ---------------------------------------------------------------- 조각 패널 (토큰화)
function buildPanels() {
  const AZ = 44, VR = 92;
  const rand = rng(555123);
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.attributes.position);
  geo.setAttribute('uv', base.attributes.uv);

  const count = AZ * VR;
  const aPos = new Float32Array(count * 3);
  const aQuat = new Float32Array(count * 4);
  const aScale = new Float32Array(count * 2);
  const aSeed = new Float32Array(count);
  const aRing = new Float32Array(count * 3); // radius, height, angle0

  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const pT = new THREE.Vector3(), pB = new THREE.Vector3(), nrm = new THREE.Vector3();
  let i = 0;
  for (let vi = 0; vi < VR; vi++) {
    const t = ((vi + 0.5) / VR) * 0.94 + 0.015;
    const sec = towerSection(t);
    const secUp = towerSection(Math.min(t + 0.004, 0.955));
    for (let ai = 0; ai < AZ; ai++) {
      const th = ((ai + 0.5) / AZ) * Math.PI * 2;
      const dth = (Math.PI * 2) / AZ;
      const [x, z] = sectionPoint(th, sec);
      const [x2, z2] = sectionPoint(th + dth * 0.5, sec);
      const [x0, z0] = sectionPoint(th - dth * 0.5, sec);
      const [xu, zu] = sectionPoint(th, secUp);
      aPos[i * 3] = x; aPos[i * 3 + 1] = t * H; aPos[i * 3 + 2] = z;
      // 기저: 접선(둘레), 상향, 노멀
      pT.set(x2 - x0, 0, z2 - z0).normalize();
      pB.set(xu - x, 0.004 * H, zu - z).normalize();
      nrm.crossVectors(pT, pB).normalize();
      m.makeBasis(pT, pB, nrm);
      q.setFromRotationMatrix(m);
      aQuat[i * 4] = q.x; aQuat[i * 4 + 1] = q.y; aQuat[i * 4 + 2] = q.z; aQuat[i * 4 + 3] = q.w;
      const arc = Math.hypot(x2 - x0, z2 - z0);
      aScale[i * 2] = Math.max(arc * 0.92, 1.2);
      aScale[i * 2 + 1] = (H * 0.94) / VR * 0.9;
      const seed = rand();
      aSeed[i] = seed;
      const ringPick = seed < 0.4 ? 0 : seed < 0.75 ? 1 : 2;
      const rr = [300, 385, 470][ringPick] + (rand() - 0.5) * 26;
      const rh = [215, 320, 420][ringPick] + (rand() - 0.5) * 44;
      aRing[i * 3] = rr; aRing[i * 3 + 1] = rh; aRing[i * 3 + 2] = rand() * Math.PI * 2;
      i++;
    }
  }
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aQuat', new THREE.InstancedBufferAttribute(aQuat, 4));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(aScale, 2));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  geo.setAttribute('aRing', new THREE.InstancedBufferAttribute(aRing, 3));
  geo.instanceCount = count;

  const u = {
    uShatter: { value: 0 },
    uInvest: { value: 0 },
    uRingRot: { value: 0 },
    uFade: { value: 1 },
    uEdge: { value: 0 },
    uTime: { value: 0 },
    uWalletPos: { value: new THREE.Vector3(0, 60, 300) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 aPos; attribute vec4 aQuat; attribute vec2 aScale; attribute float aSeed; attribute vec3 aRing;
      uniform float uShatter, uInvest, uRingRot, uTime, uFade;
      uniform vec3 uWalletPos;
      varying vec2 vUvP; varying float vAlpha; varying float vSeed;
      vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
      float easeIO(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }
      void main(){
        vUvP = uv; vSeed = aSeed;
        float delay = aSeed * 0.30 + (aPos.y / ${H.toFixed(1)}) * 0.52;
        float local = clamp((uShatter * 1.8 - delay) / 0.55, 0.0, 1.0);
        float e = easeIO(local);

        // 비행 중 자체 회전
        float spin = sin(3.14159 * e) * (aSeed - 0.5) * 5.0;
        vec2 rp = vec2(position.x * cos(spin) - position.y * sin(spin), position.x * sin(spin) + position.y * cos(spin));
        vec3 lp = vec3(rp * aScale, 0.0);

        vec3 surface = aPos + qrot(aQuat, lp);

        // 링 목표 위치/기저
        float ringSpeed = 0.4 + aSeed * 0.9;
        float ang = aRing.z + uRingRot * ringSpeed;
        vec3 rc = vec3(cos(ang) * aRing.x, aRing.y + sin(uTime * 0.6 + aSeed * 21.0) * 7.0, sin(ang) * aRing.x);
        vec3 rn = normalize(vec3(rc.x, 0.0, rc.z));
        vec3 rup = vec3(0.0, 1.0, 0.0);
        vec3 rt = normalize(cross(rup, rn));
        float sc = 0.95;
        vec3 ring = rc + rt * rp.x * aScale.x * sc + rup * rp.y * aScale.y * sc;

        vec3 p = mix(surface, ring, e);
        p.y += sin(3.14159 * e) * 34.0;
        p += rn * sin(3.14159 * e) * 16.0;

        // 투자 스트림: 일부 조각이 지갑으로
        float sel = step(0.84, aSeed);
        float inv = clamp((uInvest * 1.7 - fract(aSeed * 7.31) * 0.6) / 0.5, 0.0, 1.0) * sel;
        float ei = inv * inv;
        vec3 ctrl = mix(ring, uWalletPos, 0.35) + vec3(0.0, 90.0, 0.0);
        vec3 b1 = mix(ring, ctrl, ei);
        vec3 b2 = mix(ctrl, uWalletPos, ei);
        vec3 bez = mix(b1, b2, ei);
        p = mix(p, bez, step(0.001, inv));
        float shrink = 1.0 - ei * 0.92;

        vec3 world = p;
        // 등장 페이드(표면에서 분리될 때)
        vAlpha = uFade * smoothstep(0.02, 0.16, local) * shrink;

        vec4 mv = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUvP; varying float vAlpha; varying float vSeed;
      uniform float uEdge, uTime;
      void main(){
        if (vAlpha < 0.004) discard;
        vec2 b = abs(vUvP - 0.5);
        float edge = smoothstep(0.38, 0.5, max(b.x, b.y));
        float flick = 0.8 + 0.2 * sin(uTime * (2.0 + vSeed * 5.0) + vSeed * 47.0);
        vec3 face = vec3(0.05, 0.16, 0.22) * 0.22;
        vec3 edgeC = mix(vec3(0.25, 0.9, 1.0), vec3(1.0, 0.78, 0.4), step(0.93, vSeed));
        vec3 col = face * (0.4 + uEdge) + edgeC * edge * (0.9 + uEdge * 1.0) * flick;
        gl_FragColor = vec4(col * vAlpha * 0.85, vAlpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, u };
}

// ---------------------------------------------------------------- 히어로 토큰
function makeTokenTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 704;
  const g = c.getContext('2d');
  g.fillStyle = '#08131f'; g.fillRect(0, 0, 512, 704);
  // 프레임
  g.strokeStyle = 'rgba(94,230,255,0.9)'; g.lineWidth = 6;
  g.strokeRect(18, 18, 476, 668);
  g.strokeStyle = 'rgba(94,230,255,0.25)'; g.lineWidth = 2;
  g.strokeRect(34, 34, 444, 636);
  // 글리프: 사각 4분할 조각
  const cx = 256, cy = 250, s = 120, gap = 16;
  const frag = (dx, dy, color) => {
    g.fillStyle = color;
    g.save(); g.translate(cx + dx, cy + dy);
    g.fillRect(-s / 2, -s / 2, s - gap, s - gap);
    g.restore();
  };
  frag(-s / 2 - gap / 2, -s / 2 - gap / 2, '#5EE6FF');
  frag(s / 2 + gap / 2 - 8, -s / 2 - gap / 2 + 6, '#2f9fc9');
  frag(-s / 2 - gap / 2 + 6, s / 2 + gap / 2 - 6, '#E8B86B');
  frag(s / 2 + gap / 2 - 2, s / 2 + gap / 2 + 2, '#8ff0ff');
  // 텍스트
  g.fillStyle = '#EAF6FF';
  g.font = '700 64px Pretendard, sans-serif';
  g.textAlign = 'center';
  g.fillText('WEBLOCK', 256, 470);
  g.font = '400 30px Pretendard, sans-serif';
  g.fillStyle = 'rgba(160,220,255,0.85)';
  g.fillText('BUILDING FRACTION', 256, 522);
  g.font = '600 40px Pretendard, sans-serif';
  g.fillStyle = '#E8B86B';
  g.fillText('1 / 100,000', 256, 590);
  g.font = '400 24px Pretendard, sans-serif';
  g.fillStyle = 'rgba(120,160,190,0.8)';
  g.fillText('WBL · SEOUL LANDMARK No.0001', 256, 646);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildHeroToken() {
  const group = new THREE.Group();
  const W = 66, Hh = 90, D = 6;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, Hh, D),
    new THREE.MeshStandardMaterial({ color: 0x0a1626, metalness: 0.7, roughness: 0.3, transparent: true })
  );
  const tex = makeTokenTexture();
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.94, Hh * 0.94), faceMat);
  face.position.z = D / 2 + 0.15;
  const face2 = face.clone(); face2.rotation.y = Math.PI; face2.position.z = -D / 2 - 0.15;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: 0x5ee6ff, transparent: true, opacity: 0.9 })
  );
  group.add(body, face, face2, edges);
  group.visible = false;
  return { group, mats: [body.material, faceMat, edges.material] };
}

// ---------------------------------------------------------------- 코어 + 크레인
function buildCore() {
  const sec = { a: 13, b: 10.5, n: 5 };
  const pts = [];
  const SEG = 40;
  for (let i = 0; i <= SEG; i++) {
    const th = (i / SEG) * Math.PI * 2;
    const [x, z] = sectionPoint(th, sec);
    pts.push(new THREE.Vector2(x, z));
  }
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
  geo.rotateX(-Math.PI / 2); // z→y 위로
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a919d, roughness: 0.92, metalness: 0.05, emissive: 0x171a20, emissiveIntensity: 1.0 });
  const mesh = new THREE.Mesh(geo, mat);
  // 슬립폼 플랫폼
  const slip = new THREE.Mesh(
    new THREE.CylinderGeometry(16.5, 16.5, 3.2, 28),
    new THREE.MeshStandardMaterial({ color: 0xc06a28, roughness: 0.8, emissive: 0xcc5522, emissiveIntensity: 0.9, transparent: true })
  );
  const g = new THREE.Group();
  g.add(mesh, slip);
  return { group: g, core: mesh, slip };
}

function buildCrane() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xd9a13b, roughness: 0.7, metalness: 0.3, transparent: true, emissive: 0x3a2a0c, emissiveIntensity: 1.0 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.8, transparent: true, emissive: 0x0e1014, emissiveIntensity: 1.0 });
  const mast = new THREE.Mesh(new THREE.BoxGeometry(2.6, 58, 2.6), steel); mast.position.y = 29;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 3.8), dark); cab.position.y = 60;
  const jibG = new THREE.Group(); jibG.position.y = 62;
  const jib = new THREE.Mesh(new THREE.BoxGeometry(48, 2.0, 2.0), steel); jib.position.x = 22;
  const cjib = new THREE.Mesh(new THREE.BoxGeometry(15, 1.8, 1.8), steel); cjib.position.x = -8.5;
  const cw = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.4, 4.5), dark); cw.position.set(-14, -1.2, 0);
  const peak = new THREE.Mesh(new THREE.BoxGeometry(1.4, 9, 1.4), steel); peak.position.y = 4.5;
  const lineMat = new THREE.LineBasicMaterial({ color: 0x9aa2ad, transparent: true, opacity: 0.8 });
  const mkLine = (a, b) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), lineMat);
  jibG.add(jib, cjib, cw, peak,
    mkLine(new THREE.Vector3(0, 9, 0), new THREE.Vector3(44, 1, 0)),
    mkLine(new THREE.Vector3(0, 9, 0), new THREE.Vector3(-14, 0, 0)));
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 2.2), dark); trolley.position.set(30, -1.2, 0);
  const hookLine = mkLine(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -26, 0)); hookLine.position.copy(trolley.position);
  const hook = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 2.8), dark); hook.position.set(30, -28, 0);
  jibG.add(trolley, hookLine, hook);
  // 항공등
  const beaconMat = new THREE.SpriteMaterial({ color: 0xff3020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const beacon = new THREE.Sprite(beaconMat); beacon.scale.setScalar(7); beacon.position.y = 68;
  g.add(mast, cab, jibG, beacon);
  return { group: g, jib: jibG, trolley, hook, hookLine, beaconMat, mats: [steel, dark, lineMat] };
}

// ---------------------------------------------------------------- 스프라이트 텍스처(광원)
function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// ---------------------------------------------------------------- 조립
export function createTower() {
  const group = new THREE.Group();

  const shellGeo = buildShellGeometry();
  const { mat: shellMat, u: shellU } = buildShellMaterial();
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.renderOrder = 3;
  group.add(shell);

  const panels = buildPanels();
  group.add(panels.mesh);

  const token = buildHeroToken();
  group.add(token.group);

  const coreObj = buildCore();
  group.add(coreObj.group);

  const craneA = buildCrane(), craneB = buildCrane();
  group.add(craneA.group, craneB.group);

  // 기초 슬래브
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(106, 7, 106),
    new THREE.MeshStandardMaterial({ color: 0x5b616c, roughness: 0.95, transparent: true })
  );
  slab.position.y = -8;
  group.add(slab);

  const glowTex = makeGlowTexture();
  // 타워 정상 항공등 + 완공 비컨 필라
  const aviMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff4030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const avi = new THREE.Sprite(aviMat); avi.scale.setScalar(16); avi.position.y = H + 4;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 6.5, 420, 16, 1, true), beamMat);
  beam.position.y = H + 200;
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: 0x8fd8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(88); halo.position.y = H - 10;
  group.add(avi, beam, halo);

  const api = {
    group, shellU, panelsU: panels.u,
    update(state, t, dt) {
      const su = shellU;
      su.uTime.value = t;
      su.uBuild.value = state.holo > 0.005 ? 566 : state.buildH; // 서막 홀로그램은 전신 표시
      su.uWinLit.value = state.winLit;
      su.uWinWave.value = state.winWave;
      su.uWork.value = state.work;
      su.uGhost.value = state.ghost;
      su.uHolo.value = state.holo;
      su.uScanY.value = state.scanY;
      su.uScanI.value = state.scanI;
      su.uSeamGlow.value = state.seamGlow;
      su.uGoldI.value = state.goldI;
      su.uGoldY.value = state.goldY;
      su.uCrownLit.value = state.crownLit;
      su.uFrontier.value = state.frontier;
      shell.visible = state.buildH > 0.5 || state.holo > 0.01;

      const pu = panels.u;
      pu.uTime.value = t;
      pu.uShatter.value = state.shatter;
      pu.uInvest.value = state.invest;
      pu.uRingRot.value = state.ringRot;
      pu.uFade.value = state.panelFade;
      pu.uEdge.value = state.edgeGlow;
      pu.uWalletPos.value.copy(state.walletPos);
      panels.mesh.visible = state.shatter > 0.001 && state.panelFade > 0.005;

      // 코어/크레인/슬래브 — 건설 phase 전용
      const coreH = state.coreH;
      const showCon = state.conAlpha > 0.01 && coreH > 1;
      coreObj.group.visible = showCon;
      craneA.group.visible = craneB.group.visible = showCon && coreH > 40;
      slab.visible = state.slabT > 0.01;
      if (slab.visible) {
        slab.position.y = lerp(-14, -2.5, state.slabT);
        slab.material.opacity = state.conAlpha;
      }
      if (showCon) {
        coreObj.core.scale.set(1, coreH, 1);
        coreObj.core.material.opacity = state.conAlpha;
        coreObj.core.material.transparent = true;
        coreObj.slip.position.y = coreH + 1;
        coreObj.slip.material.opacity = state.conAlpha;
        const place = (cr, sgn, phase) => {
          cr.group.position.set(16 * sgn, coreH + 2, -12 * sgn);
          cr.group.rotation.y = t * 0.12 * sgn + phase;
          cr.trolley.position.x = 18 + 14 * (0.5 + 0.5 * Math.sin(t * 0.3 + phase));
          cr.hook.position.x = cr.trolley.position.x;
          cr.hookLine.position.x = cr.trolley.position.x;
          const blink = 0.5 + 0.5 * Math.sin(t * 3.5 + phase * 2);
          cr.beaconMat.opacity = state.conAlpha * blink;
          cr.mats.forEach((mm) => (mm.opacity = state.conAlpha));
        };
        place(craneA, 1, 0);
        place(craneB, -1, 2.4);
      }

      // 항공등/비컨
      aviMat.opacity = state.aviI * (0.55 + 0.45 * Math.sin(t * 2.2));
      beamMat.opacity = state.beamI * 0.38;
      haloMat.opacity = state.beamI * 0.5 + state.crownLit * 0.1;

      // 히어로 토큰
      token.group.visible = state.tokScale > 0.001;
      if (token.group.visible) {
        token.group.position.copy(state.tokPos);
        token.group.scale.setScalar(state.tokScale);
        token.group.rotation.y = t * 0.5;
        token.group.rotation.x = Math.sin(t * 0.7) * 0.08;
        token.mats.forEach((mm) => (mm.opacity = state.tokAlpha));
      }
    },
  };
  return api;
}

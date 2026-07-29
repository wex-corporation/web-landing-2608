// v2 타워: MeshPhysicalMaterial 커튼월(IBL 반사 + 창문별 마이크로 노멀) + 조립/조각화 패널 + 히어로 토큰
import * as THREE from 'three';
import { clamp, lerp, rng } from '../util.js';
import { towerSection, sectionPoint, H } from '../tower.js';

// ---------------------------------------------------------------- 쉘 지오메트리 (고밀도)
function buildShellGeometry(RAD = 208, ROWS = 400) {
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

// ---------------------------------------------------------------- 커튼월 머티리얼 (Physical + 주입)
function buildShellMaterial(envMap) {
  const u = {
    uBuild: { value: 0 },
    uTime: { value: 0 },
    uWinLit: { value: 0 },
    uWinWave: { value: 0 },
    uWork: { value: 0 },
    uGhost: { value: 0 },
    uHolo: { value: 0 },
    uScanY: { value: -60 },
    uScanI: { value: 0 },
    uSeamGlow: { value: 0 },
    uCrownLit: { value: 0 },
    uFrontier: { value: 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x0c1322,
    metalness: 0.08,
    roughness: 0.13,
    clearcoat: 1.0,
    clearcoatRoughness: 0.32,
    envMap,
    envMapIntensity: 1.55,
    transparent: true,
    side: THREE.FrontSide,
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
        uniform float uBuild, uTime, uWinLit, uWinWave, uWork, uGhost, uHolo;
        uniform float uScanY, uScanI, uSeamGlow, uCrownLit, uFrontier;
        float whash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        float gWin, gMullion, gSpandrel, gCrown, gLit, gBright, gWarm, gR1;
        vec2 gCell;
        float gAlphaMul = 1.0;
        const float FLOORS = 123.0;
        const float COLS = 176.0;
      `)
      .replace('#include <clipping_planes_fragment>', /* glsl */`
        #include <clipping_planes_fragment>
        float yM = vWp.y;
        float vN = clamp(vUv.y, 0.0, 1.0);
        float uuN = vUv.x;
        if (yM > uBuild) discard;
        gCrown = smoothstep(0.945, 0.955, vN);
        float angW = atan(vWp.z, vWp.x);
        float slit = smoothstep(0.10, 0.30, abs(sin(angW + 0.785)));
        if (gCrown > 0.5 && slit < 0.15) discard;
        float colF = fract(uuN * COLS);
        float flrF = fract(vN * FLOORS);
        gMullion = smoothstep(0.10, 0.0, abs(colF - 0.5) - 0.40);
        gSpandrel = smoothstep(0.05, 0.0, abs(flrF - 0.5) - 0.36);
        gWin = step(0.12, colF) * step(colF, 0.88) * step(0.10, flrF) * step(flrF, 0.80);
        gCell = vec2(floor(uuN * COLS), floor(vN * FLOORS));
        gR1 = whash(gCell * 1.13 + 7.7);
        float midBoost = 0.55 + 0.45 * sin(3.14159 * clamp(vN * 1.05, 0.0, 1.0));
        float ratio = clamp(uWinLit * midBoost * 1.25, 0.0, 1.0);
        float waveMask = step(vN, uWinWave) * step(gR1, 0.58);
        gLit = max(step(gR1, ratio), waveMask * step(0.02, uWinWave));
        gWarm = step(0.6, whash(gCell * 2.7 + 1.3));
        gBright = 0.4 + 0.85 * whash(gCell + 3.1);
        float ghostAll = max(uGhost, uHolo);
        gAlphaMul = mix(1.0, 0.14, ghostAll);
      `)
      .replace('#include <color_fragment>', /* glsl */`
        #include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.46, 0.55), gMullion * 0.55);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.02, 0.03, 0.05), gSpandrel * 0.5);
      `)
      .replace('#include <normal_fragment_begin>', /* glsl */`
        #include <normal_fragment_begin>
        {
          float j1 = whash(gCell * 3.7 + 0.31) - 0.5;
          float j2 = whash(gCell * 5.1 + 4.7) - 0.5;
          float j3 = whash(gCell * 7.9 + 9.2) - 0.5;
          vec3 jit = vec3(j1, j2 * 0.55, j3) * 0.055 * gWin;
          normal = normalize(normal + jit);
          nonPerturbedNormal = normal;
        }
      `)
      .replace('#include <roughnessmap_fragment>', /* glsl */`
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (whash(gCell * 9.3 + 2.2) - 0.5) * 0.10 + gSpandrel * 0.4 + gMullion * 0.2, 0.05, 1.0);
      `)
      .replace('#include <emissivemap_fragment>', /* glsl */`
        #include <emissivemap_fragment>
        {
          vec3 E = vec3(0.0);
          float vN2 = clamp(vUv.y, 0.0, 1.0);
          float yM2 = vWp.y;
          // 창문 점등 (+화면 픽셀밀도 LOD: 원경에서는 부드러운 면광으로)
          vec3 winC = mix(vec3(0.98, 0.82, 0.58), vec3(0.72, 0.83, 0.98), gWarm);
          float flick = 0.93 + 0.07 * sin(uTime * (0.6 + gR1 * 1.8) + gR1 * 40.0);
          float cellPx = fwidth(vUv.x * COLS) + fwidth(vUv.y * FLOORS);
          float det = smoothstep(1.7, 0.65, cellPx);
          float ghostDim = 1.0 - max(uGhost, uHolo) * 0.9;
          float midB = 0.55 + 0.45 * sin(3.14159 * clamp(vN2 * 1.05, 0.0, 1.0));
          float ratioE = clamp(uWinLit * midB * 1.25, 0.0, 1.0);
          float waveE = max(ratioE, step(vN2, uWinWave) * 0.55 * step(0.02, uWinWave));
          E += winC * gWin * gLit * gBright * flick * 0.85 * ghostDim * det;
          E += vec3(0.9, 0.84, 0.72) * waveE * 0.22 * (1.0 - det) * ghostDim;
          // 공사 작업등
          E += vec3(1.0, 0.62, 0.3) * gWin * step(0.977, gR1) * uWork * 1.8;
          // 프런티어 결정화 밴드 (바이올렛-웜)
          float fr = smoothstep(uBuild - 7.0, uBuild - 1.2, yM2);
          E += mix(vec3(0.55, 0.35, 1.0), vec3(1.0, 0.75, 0.4), 0.3) * fr * uFrontier * 1.15;
          float frLine = smoothstep(uBuild - 1.8, uBuild - 0.3, yM2);
          E += vec3(0.95, 0.9, 1.0) * frLine * uFrontier * 2.4;
          // 스캔라인
          E += vec3(0.55, 0.35, 1.0) * smoothstep(5.5, 0.0, abs(yM2 - uScanY)) * uScanI * 3.2;
          // 세로 심
          float seam = smoothstep(0.0035, 0.0012, abs(vUv.x - 0.815));
          float seam2 = smoothstep(0.0030, 0.0010, abs(vUv.x - 0.315)) * gCrown;
          E += vec3(0.6, 0.4, 1.0) * (seam + seam2) * uSeamGlow * 2.2;
          // 크라운 다이어그리드
          if (gCrown > 0.0) {
            float d1 = abs(fract(vUv.x * 30.0 + vN2 * 130.0) - 0.5);
            float d2 = abs(fract(vUv.x * 30.0 - vN2 * 130.0) - 0.5);
            float grid = smoothstep(0.46, 0.5, max(d1, d2));
            E += mix(vec3(0.5, 0.55, 0.72), vec3(1.0, 0.85, 0.6), uCrownLit * 0.5) * grid * gCrown * (0.10 + uCrownLit * 2.2);
            E += vec3(1.0, 0.85, 0.6) * gCrown * uCrownLit * 0.3;
          }
          // 홀로그램 그리드 (고스트/서막)
          float ghostAll = max(uGhost, uHolo);
          if (ghostAll > 0.001) {
            float hg = smoothstep(0.92, 1.0, fract(vN2 * FLOORS * 0.5)) + smoothstep(0.94, 1.0, fract(vUv.x * 44.0));
            E += vec3(0.48, 0.30, 1.0) * ghostAll * (0.12 + hg * 0.7);
          }
          totalEmissiveRadiance += E;
        }
      `)
      .replace('#include <alphamap_fragment>', /* glsl */`
        #include <alphamap_fragment>
        diffuseColor.a *= gAlphaMul;
      `);
  };
  // 유니폼 변경으로 프로그램 캐시 무효화 방지
  mat.customProgramCacheKey = () => 'weblock-shell-v2';
  return { mat, u };
}

// 내부 실루엣 (고스트 시 내부 비침 방지 + 슬래브 힌트)
function buildInnerMaterial() {
  const u = { uBuild: { value: 0 }, uGhost: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.BackSide,
    transparent: true,
    vertexShader: /* glsl */`
      varying vec3 vWp; varying vec2 vUvS;
      void main(){
        vUvS = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWp = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vWp; varying vec2 vUvS;
      uniform float uBuild, uGhost;
      void main(){
        if (vWp.y > uBuild) discard;
        float fl = fract(vUvS.y * 123.0);
        float slab = smoothstep(0.08, 0.0, abs(fl - 0.5) - 0.4);
        vec3 col = vec3(0.008, 0.010, 0.018) + vec3(0.05, 0.045, 0.09) * slab * 0.35;
        gl_FragColor = vec4(col, mix(1.0, 0.35, uGhost));
      }
    `,
  });
  return { mat, u };
}

// ---------------------------------------------------------------- 조각 패널 (조립 + 조각화)
function buildPanels() {
  const AZ = 60, VR = 128;
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
  const aRing = new Float32Array(count * 3);
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
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
      pT.set(x2 - x0, 0, z2 - z0).normalize();
      pB.set(xu - x, 0.004 * H, zu - z).normalize();
      nrm.crossVectors(pT, pB).normalize();
      m.makeBasis(pT, pB, nrm);
      q.setFromRotationMatrix(m);
      aQuat[i * 4] = q.x; aQuat[i * 4 + 1] = q.y; aQuat[i * 4 + 2] = q.z; aQuat[i * 4 + 3] = q.w;
      const arc = Math.hypot(x2 - x0, z2 - z0);
      aScale[i * 2] = Math.max(arc * 0.92, 1.0);
      aScale[i * 2 + 1] = (H * 0.94) / VR * 0.9;
      const seed = rand();
      aSeed[i] = seed;
      const ringPick = seed < 0.4 ? 0 : seed < 0.75 ? 1 : 2;
      aRing[i * 3] = [300, 385, 470][ringPick] + (rand() - 0.5) * 26;
      aRing[i * 3 + 1] = [215, 320, 420][ringPick] + (rand() - 0.5) * 44;
      aRing[i * 3 + 2] = rand() * Math.PI * 2;
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
    uRingRot: { value: 0 },
    uFade: { value: 1 },
    uEdge: { value: 0 },
    uTime: { value: 0 },
    uBuildM: { value: 0 },
    uAssembleOn: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 aPos; attribute vec4 aQuat; attribute vec2 aScale; attribute float aSeed; attribute vec3 aRing;
      uniform float uShatter, uRingRot, uTime, uFade, uBuildM, uAssembleOn;
      varying vec2 vUvP; varying float vAlpha; varying float vSeed;
      vec3 qrot(vec4 q, vec3 v){ return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
      float easeIO(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) / 2.0; }
      float easeOC(float t){ return 1.0 - pow(1.0 - t, 3.0); }
      void main(){
        vUvP = uv; vSeed = aSeed;

        // ── 조각화 경로
        float delay = aSeed * 0.30 + (aPos.y / ${H.toFixed(1)}) * 0.52;
        float local = clamp((uShatter * 1.8 - delay) / 0.55, 0.0, 1.0);
        float e = easeIO(local);
        float spin = sin(3.14159 * e) * (aSeed - 0.5) * 5.0;

        // ── 조립 경로
        float birth = clamp((uBuildM - aPos.y) / 90.0, 0.0, 1.0);
        float eA = easeOC(birth);
        float spinA = (1.0 - eA) * (aSeed - 0.5) * 7.0;
        float useAsm = uAssembleOn * step(uShatter, 0.001);
        float sp = mix(spin, spinA, useAsm);

        vec2 rp = vec2(position.x * cos(sp) - position.y * sin(sp), position.x * sin(sp) + position.y * cos(sp));
        vec3 lp = vec3(rp * aScale, 0.0);
        vec3 surface = aPos + qrot(aQuat, lp);
        vec3 nDir = qrot(aQuat, vec3(0.0, 0.0, 1.0));
        vec3 tDir = qrot(aQuat, vec3(1.0, 0.0, 0.0));

        // 조립 출발점: 바깥 공간에서 나선형으로
        vec3 startP = aPos + nDir * (140.0 + aSeed * 260.0) + vec3(0.0, 40.0 + aSeed * 120.0, 0.0) + tDir * (aSeed - 0.5) * 220.0;
        vec3 asmP = mix(startP, surface, eA);
        float asmAlpha = useAsm * smoothstep(0.0, 0.06, birth) * (1.0 - smoothstep(0.88, 1.0, birth));

        // 링 목표
        float ringSpeed = 0.4 + aSeed * 0.9;
        float ang = aRing.z + uRingRot * ringSpeed;
        vec3 rc = vec3(cos(ang) * aRing.x, aRing.y + sin(uTime * 0.6 + aSeed * 21.0) * 7.0, sin(ang) * aRing.x);
        vec3 rn = normalize(vec3(rc.x, 0.0, rc.z));
        vec3 rup = vec3(0.0, 1.0, 0.0);
        vec3 rt = normalize(cross(rup, rn));
        float sc = 0.95;
        vec3 ring = rc + rt * rp.x * aScale.x * sc + rup * rp.y * aScale.y * sc;
        vec3 shatP = mix(surface, ring, e);
        shatP.y += sin(3.14159 * e) * 34.0;
        shatP += rn * sin(3.14159 * e) * 16.0;
        float shatAlpha = uFade * smoothstep(0.02, 0.16, local) * step(0.001, uShatter);

        vec3 world = mix(shatP, asmP, useAsm);
        vAlpha = max(shatAlpha, asmAlpha);
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
        vec3 face = vec3(0.10, 0.07, 0.22) * 0.25;
        vec3 edgeC = mix(vec3(0.55, 0.38, 1.0), vec3(0.78, 0.68, 1.0), step(0.5, vSeed));
        edgeC = mix(edgeC, vec3(1.0, 0.8, 0.42), step(0.93, vSeed)); // 골드 스프링클
        vec3 col = face * (0.4 + uEdge) + edgeC * edge * (0.95 + uEdge * 1.1) * flick;
        gl_FragColor = vec4(col * vAlpha * 0.9, vAlpha);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, u };
}

// ---------------------------------------------------------------- 히어로 토큰 (WeBlock 브랜드)
function drawTokenFace(c) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 704);
  g.fillStyle = '#0a0716';
  g.fillRect(0, 0, 512, 704);
  g.strokeStyle = 'rgba(157,123,255,0.95)'; g.lineWidth = 6;
  g.strokeRect(18, 18, 476, 668);
  g.strokeStyle = 'rgba(109,46,245,0.35)'; g.lineWidth = 2;
  g.strokeRect(34, 34, 444, 636);
  // W 블록 마크
  const U = 44, G = 4, P = U + G;
  const mx = 256 - (P * 4 + U) / 2, my = 150;
  g.fillStyle = '#7c4dff';
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
  g.fillText('WBL · SEOUL LANDMARK No.0001', 256, 634);
}
function buildHeroToken(envMap) {
  const group = new THREE.Group();
  const W = 66, Hh = 90, D = 6;
  const c = document.createElement('canvas');
  c.width = 512; c.height = 704;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const redraw = () => { drawTokenFace(c); tex.needsUpdate = true; };
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

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- 조립
export function createTower2(envMap) {
  const group = new THREE.Group();
  const geo = buildShellGeometry();
  const { mat: shellMat, u: shellU } = buildShellMaterial(envMap);
  const shell = new THREE.Mesh(geo, shellMat);
  shell.renderOrder = 3;
  const inner = buildInnerMaterial();
  const innerMesh = new THREE.Mesh(geo, inner.mat);
  innerMesh.scale.set(0.988, 0.999, 0.988);
  innerMesh.renderOrder = 2;
  group.add(innerMesh, shell);

  const panels = buildPanels();
  group.add(panels.mesh);

  const token = buildHeroToken(envMap);
  group.add(token.group);

  const glowTex = makeGlowTexture();
  const aviMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xff4030, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const avi = new THREE.Sprite(aviMat); avi.scale.setScalar(9); avi.position.y = H - 4;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xc4b2ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 6.0, 420, 16, 1, true), beamMat);
  beam.position.y = H + 200;
  const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xb09aff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(84); halo.position.y = H - 10;
  group.add(avi, beam, halo);

  return {
    group, shellU, panelsU: panels.u,
    refreshToken: token.redraw,
    update(state, t) {
      shellU.uTime.value = t;
      shellU.uBuild.value = state.holo > 0.005 ? 566 : state.buildH;
      shellU.uWinLit.value = state.winLit;
      shellU.uWinWave.value = state.winWave;
      shellU.uWork.value = state.work;
      shellU.uGhost.value = state.ghost;
      shellU.uHolo.value = state.holo;
      shellU.uScanY.value = state.scanY;
      shellU.uScanI.value = state.scanI;
      shellU.uSeamGlow.value = state.seamGlow;
      shellU.uCrownLit.value = state.crownLit;
      shellU.uFrontier.value = state.frontier;
      shell.visible = state.buildH > 0.5 || state.holo > 0.005;
      inner.u.uBuild.value = shellU.uBuild.value;
      inner.u.uGhost.value = Math.max(state.ghost, state.holo);
      innerMesh.visible = shell.visible;

      const pu = panels.u;
      pu.uTime.value = t;
      pu.uShatter.value = state.shatter;
      pu.uRingRot.value = state.ringRot;
      pu.uFade.value = state.panelFade;
      pu.uEdge.value = state.edgeGlow;
      pu.uBuildM.value = state.buildH;
      pu.uAssembleOn.value = state.assembleOn;
      panels.mesh.visible = (state.shatter > 0.001 && state.panelFade > 0.005) || (state.assembleOn > 0.01 && state.buildH > 2 && state.buildH < 555);

      aviMat.opacity = state.aviI * (0.55 + 0.45 * Math.sin(t * 2.2));
      beamMat.opacity = state.beamI * 0.34;
      haloMat.opacity = state.beamI * 0.45 + state.crownLit * 0.1;

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
}

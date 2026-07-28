// 월드: 하늘 돔, 절차적 도시, 지면/광장, 석촌호수, 교통 광류
import * as THREE from 'three';
import { rng, GLSL_COMMON } from './util.js';

const FOG_UNIFORMS = () => ({
  uFogColor: { value: new THREE.Color(0x0a1020) },
  uFogDensity: { value: 0.00035 },
});

// ---------------------------------------------------------------- 하늘
export function createSky() {
  const u = {
    uZenith: { value: new THREE.Color(0x0a1128) },
    uHorizon: { value: new THREE.Color(0x1e3a54) },
    uHaze: { value: new THREE.Color(0x38536e) },
    uSunDir: { value: new THREE.Vector3(0.3, -0.2, -1).normalize() },
    uSunColor: { value: new THREE.Color(0xffd9a0) },
    uSunDisc: { value: 0.0 },   // 태양 원반 강도
    uSunGlow: { value: 0.4 },   // 지평 광휘
    uStars: { value: 0.8 },
    uTime: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_Position.z = gl_Position.w; // 항상 최원경
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uZenith, uHorizon, uHaze, uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunDisc, uSunGlow, uStars, uTime;
      ${GLSL_COMMON}
      void main(){
        vec3 d = normalize(vDir);
        float el = d.y;
        // 기본 그라디언트
        vec3 col = mix(uHorizon, uZenith, pow(clamp(el, 0.0, 1.0), 0.48));
        // 지평 안개 띠
        col += uHaze * exp(-abs(el) * 9.0) * 0.55;
        // 수평 아래는 어두운 지면 헤이즈
        col = mix(col, uHaze * 0.35, smoothstep(0.0, -0.25, el));
        // 미세 대기 노이즈 (밴딩 방지 + 결)
        float n = vnoise(vec2(atan(d.z, d.x) * 6.0, el * 14.0) + uTime * 0.005);
        col *= 0.97 + 0.06 * n;
        // 태양
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(s, 900.0) * uSunDisc * 30.0;   // 원반 (HDR)
        col += uSunColor * pow(s, 24.0) * uSunGlow * 0.9;     // 근접 광휘
        col += uSunColor * pow(s, 3.0) * uSunGlow * 0.16;     // 넓은 산란
        // 별
        if (uStars > 0.001 && el > 0.02) {
          vec2 sp = vec2(atan(d.z, d.x) * 34.0, asin(clamp(d.y,-1.0,1.0)) * 34.0);
          vec2 cell = floor(sp);
          float r = hash12(cell);
          vec2 pos = fract(sp) - vec2(hash12(cell + 7.1), hash12(cell + 3.7));
          float star = smoothstep(0.06, 0.0, length(pos)) * step(0.82, r);
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
          col += vec3(0.8, 0.9, 1.0) * star * tw * uStars * smoothstep(0.02, 0.25, el) * 1.4;
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4400, 48, 32), mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}

// ---------------------------------------------------------------- 도시
export function createCity() {
  const rand = rng(20260728);
  const items = []; // {x,z,sx,sy,sz,seed,lit}
  const PITCH = 112, ROAD = 24;
  const inLake = (x, z) => {
    const dx = (x + 385) / 260, dz = (z - 265) / 190; // 호수 타원(마진 포함)
    return dx * dx + dz * dz < 1.0;
  };
  // 카메라 진입 경로를 따라 타워로 향하는 대로(大路) 회랑 확보
  const AVE = { x: 0.5, z: 0.87 }; // 정규화 방향
  const inAvenue = (x, z) => {
    const proj = x * AVE.x + z * AVE.z;
    if (proj < 60 || proj > 1500) return false;
    const perp = Math.abs(x * AVE.z - z * AVE.x);
    return perp < 95;
  };
  for (let gx = -16; gx <= 16; gx++) {
    for (let gz = -16; gz <= 16; gz++) {
      const cx = gx * PITCH, cz = gz * PITCH;
      const dist = Math.hypot(cx, cz);
      if (dist < 315 || dist > 1750) continue;
      if (inLake(cx, cz)) continue;
      if (inAvenue(cx, cz)) continue;
      const falloff = 1.0 - Math.min(1, Math.max(0, (dist - 350) / 1500)) * 0.55;
      const nb = 1 + Math.floor(rand() * 2.4);
      for (let i = 0; i < nb; i++) {
        const bw = 22 + rand() * 34;
        const bd = 22 + rand() * 34;
        const half = (PITCH - ROAD) / 2 - 4;
        const ox = (rand() * 2 - 1) * (half - bw / 2);
        const oz = (rand() * 2 - 1) * (half - bd / 2);
        let h = (16 + Math.pow(rand(), 2.1) * 150) * falloff;
        if (rand() < 0.055) h *= 1.9; // 소수의 고층
        h = Math.min(h, 265);
        items.push({ x: cx + ox, z: cz + oz, sx: bw, sy: h, sz: bd, seed: rand() * 100, lit: 0.22 + Math.pow(rand(), 1.7) * 0.68 });
      }
    }
  }
  // 타워 기단 포디움 (몰 컴플렉스 오마주)
  items.push({ x: 118, z: 62, sx: 96, sy: 36, sz: 74, seed: 7.7, lit: 0.95 });
  items.push({ x: -96, z: -88, sx: 82, sy: 28, sz: 96, seed: 8.8, lit: 0.9 });
  items.push({ x: 36, z: -128, sx: 70, sy: 44, sz: 58, seed: 9.9, lit: 0.85 });
  // 원경 스카이라인 링
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1850 + rand() * 1500;
    items.push({
      x: Math.cos(a) * r, z: Math.sin(a) * r,
      sx: 70 + rand() * 120, sy: 30 + Math.pow(rand(), 1.6) * 130, sz: 70 + rand() * 120,
      seed: rand() * 100, lit: 0.1 + rand() * 0.16,
    });
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const u = {
    uCityLit: { value: 0.0 },
    uTime: { value: 0 },
    uHemiSky: { value: new THREE.Color(0x233246) },
    uHemiGround: { value: new THREE.Color(0x090c12) },
    uSunDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunColor: { value: new THREE.Color(0xffe0b0) },
    uSunI: { value: 0.0 },
    ...FOG_UNIFORMS(),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      attribute float aSeed;
      attribute float aLit;
      varying vec3 vLocal; varying vec3 vN; varying float vSeed; varying float vLit;
      varying float vViewZ; varying float vH;
      void main(){
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLocal = position * sc;
        vH = sc.y;
        vN = normalize(mat3(instanceMatrix) * normal);
        vec4 w = instanceMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * w;
        vViewZ = -mv.z;
        vSeed = aSeed; vLit = aLit;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vLocal; varying vec3 vN; varying float vSeed; varying float vLit;
      varying float vViewZ; varying float vH;
      uniform float uCityLit, uTime, uSunI;
      uniform vec3 uHemiSky, uHemiGround, uFogColor, uSunDir, uSunColor;
      uniform float uFogDensity;
      ${GLSL_COMMON}
      void main(){
        vec3 an = abs(vN);
        vec3 base = mix(vec3(0.030, 0.040, 0.062), vec3(0.052, 0.066, 0.096), clamp(vLocal.y / 90.0, 0.0, 1.0));
        // 반구 앰비언트
        float hemi = clamp(vN.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 amb = mix(uHemiGround, uHemiSky, hemi);
        // 면별 미세 명암
        float faceTone = 0.75 + 0.25 * (0.5 + 0.5 * vN.x) * (0.6 + 0.4 * vN.z);
        vec3 col = base * amb * 3.2 * faceTone;
        // 주간 태양 음영 (일출·아침)
        float sunDiff = max(dot(vN, normalize(uSunDir)), 0.0);
        col += base * uSunColor * sunDiff * uSunI * 6.5;
        col *= 1.0 + uSunI * 0.4;
        if (an.y < 0.5) {
          vec2 fc = (an.x > 0.5) ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
          vec2 pitch = vec2(5.4, 4.1);
          vec2 cell = floor(fc / pitch);
          vec2 f = fract(fc / pitch);
          float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.24, f.y) * step(f.y, 0.76);
          float r1 = hash12(cell + vSeed * 17.0);
          float ratio = uCityLit * vLit;
          float lit = step(r1, ratio);
          float warmPick = step(0.55, hash12(cell * 1.71 + vSeed));
          vec3 wc = mix(vec3(0.95, 0.78, 0.55), vec3(0.68, 0.79, 0.95), warmPick);
          float flick = 0.93 + 0.07 * sin(uTime * (0.5 + r1 * 1.4) + r1 * 31.0);
          float bright = 0.45 + 0.9 * hash12(cell * 3.3 + vSeed * 5.0);
          // 원거리 LOD: 개별 창 → 면 평균 글로우 (+화면 픽셀밀도 기반 AA)
          float detail = 1.0 - smoothstep(850.0, 2100.0, vViewZ);
          float cellPx = fwidth((fc / pitch).x) + fwidth((fc / pitch).y);
          detail *= smoothstep(0.55, 0.22, cellPx);
          vec3 winEmiss = wc * win * lit * bright * flick;
          vec3 avgEmiss = vec3(0.88, 0.82, 0.70) * ratio * 0.13;
          col += mix(avgEmiss, winEmiss, detail) * 0.85;
          // 저층부 상가 불빛
          float shop = step(vLocal.y, 5.0) * smoothstep(0.1, 0.5, ratio) * detail;
          col += vec3(0.95, 0.75, 0.5) * shop * 0.3;
        } else {
          col *= 0.55; // 지붕은 어둡게
        }
        col = applyFog(col, vViewZ, uFogColor, uFogDensity);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, items.length);
  const dummy = new THREE.Object3D();
  const seeds = new Float32Array(items.length);
  const lits = new Float32Array(items.length);
  items.forEach((b, i) => {
    dummy.position.set(b.x, 0, b.z);
    dummy.scale.set(b.sx, b.sy, b.sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    seeds[i] = b.seed; lits[i] = b.lit;
  });
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(lits, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, u };
}

// ---------------------------------------------------------------- 지면/광장
export function createGround() {
  const u = {
    uPitGlow: { value: 0.0 },     // 공사 초기: 부지 윤곽 발광
    uPlazaLit: { value: 0.0 },    // 광장 조명
    uHoloSite: { value: 0.0 },    // 서막: 홀로그램 풋프린트
    uTime: { value: 0 },
    ...FOG_UNIFORMS(),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      varying vec2 vXZ; varying float vViewZ;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        vec4 mv = viewMatrix * w;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vXZ; varying float vViewZ;
      uniform float uPitGlow, uPlazaLit, uHoloSite, uTime, uFogDensity;
      uniform vec3 uFogColor;
      ${GLSL_COMMON}
      float sdRoundRect(vec2 p, vec2 b, float r){
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main(){
        float d = length(vXZ);
        // 기본 아스팔트/대지
        vec3 col = mix(vec3(0.020, 0.026, 0.040), vec3(0.012, 0.015, 0.024), clamp(d / 2600.0, 0.0, 1.0));
        col *= 0.92 + 0.08 * vnoise(vXZ * 0.02);
        // 광장 (r < 210): 살짝 밝은 석재 + 은은한 포장 패턴
        float plaza = smoothstep(215.0, 185.0, d);
        vec3 stone = vec3(0.026, 0.031, 0.045);
        float pave = (smoothstep(0.94, 1.0, fract(vXZ.x / 16.0)) + smoothstep(0.94, 1.0, fract(vXZ.y / 16.0))) * 0.03;
        col = mix(col, stone + pave * uPlazaLit, plaza);
        // 광장 조명 워시
        col += vec3(0.30, 0.26, 0.19) * plaza * uPlazaLit * 0.13 * max(1.0 - d / 260.0, 0.0);
        // 타워 발치 접지 음영 (가짜 AO)
        col *= 1.0 - 0.32 * smoothstep(130.0, 22.0, d);
        // 부지 윤곽 발광 (건설 초기)
        float sd = sdRoundRect(vXZ, vec2(52.0), 14.0);
        float outline = smoothstep(3.2, 0.0, abs(sd));
        float pulse = 0.75 + 0.25 * sin(uTime * 2.1);
        col += vec3(1.0, 0.62, 0.25) * outline * uPitGlow * 2.2 * pulse;
        // 서막 홀로그램: 풋프린트 + 스캔 그리드
        float grid = (smoothstep(0.93, 1.0, fract(vXZ.x / 24.0)) + smoothstep(0.93, 1.0, fract(vXZ.y / 24.0)));
        float site = smoothstep(0.0, -40.0, sd);
        col += vec3(0.20, 0.75, 1.0) * uHoloSite * (outline * 1.8 * pulse + site * grid * 0.22 + site * 0.06);
        col = applyFog(col, vViewZ, uFogColor, uFogDensity);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(5200, 96), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.5;
  return { mesh, u };
}

// ---------------------------------------------------------------- 석촌호수
export function createLake() {
  const u = {
    uTowerLit: { value: 0.0 },
    uTime: { value: 0 },
    uSkyHorizon: { value: new THREE.Color(0x1e3a54) },
    uSkyZenith: { value: new THREE.Color(0x0a1128) },
    ...FOG_UNIFORMS(),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: false,
    vertexShader: /* glsl */`
      varying vec2 vUvL; varying vec2 vXZ; varying float vViewZ;
      void main(){
        vUvL = uv;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        vec4 mv = viewMatrix * w;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUvL; varying vec2 vXZ; varying float vViewZ;
      uniform float uTowerLit, uTime, uFogDensity;
      uniform vec3 uSkyHorizon, uSkyZenith, uFogColor;
      ${GLSL_COMMON}
      void main(){
        // 하늘 반사 기조
        vec3 col = mix(uSkyZenith, uSkyHorizon, 0.35) * 0.55;
        col = mix(col, vec3(0.012, 0.022, 0.038), 0.45);
        // 잔물결 스파클 (원거리에서만 은은히)
        float n1 = vnoise(vXZ * 0.06 + vec2(uTime * 0.4, uTime * 0.1));
        float n2 = vnoise(vXZ * 0.13 - vec2(uTime * 0.22, uTime * 0.3));
        float far = smoothstep(320.0, 900.0, vViewZ);
        float spark = pow(n1 * n2, 6.0) * 1.5 * (0.35 + 0.65 * far);
        col += vec3(0.75, 0.85, 1.0) * spark * (0.2 + uTowerLit * 0.6);
        // 타워 방향 금빛 리플렉션 시트
        float towardTower = exp(-length(vXZ) / 620.0);
        col += vec3(0.9, 0.72, 0.4) * towardTower * uTowerLit * (0.05 + 0.05 * n1);
        // 기슭 라인
        float rim = smoothstep(0.985, 1.0, max(abs(vUvL.x - 0.5), abs(vUvL.y - 0.5)) * 2.0);
        col += vec3(0.9, 0.8, 0.6) * rim * uTowerLit * 0.15;
        col = applyFog(col, vViewZ, uFogColor, uFogDensity);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const geo = new THREE.CircleGeometry(1, 64);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(225, 160, 1);
  mesh.position.set(-385, 0.4, 265);
  mesh.rotation.z = 0.4;
  return { mesh, u };
}

// ---------------------------------------------------------------- 교통 광류
export function createTrails() {
  const rand = rng(9137);
  const COUNT = 42;
  const u = { uTime: { value: 0 }, uStr: { value: 0 }, ...FOG_UNIFORMS() };
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSpeed; attribute float aOff; attribute float aWarm;
      varying vec2 vUvT; varying float vSpeed; varying float vOff; varying float vWarm; varying float vViewZ;
      void main(){
        vUvT = uv; vSpeed = aSpeed; vOff = aOff; vWarm = aWarm;
        vec4 w = instanceMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * w;
        vViewZ = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUvT; varying float vSpeed; varying float vOff; varying float vWarm; varying float vViewZ;
      uniform float uTime, uStr, uFogDensity;
      uniform vec3 uFogColor;
      ${GLSL_COMMON}
      void main(){
        float head = fract(vUvT.x * 3.0 - uTime * vSpeed + vOff);
        float pulse = smoothstep(0.0, 0.42, head) * smoothstep(0.62, 0.44, head);
        vec3 c = mix(vec3(1.0, 0.92, 0.75), vec3(1.0, 0.32, 0.22), vWarm);
        float endFade = sin(3.14159 * vUvT.x);
        float lat = sin(3.14159 * vUvT.y);
        vec3 col = c * pulse * endFade * lat * uStr * 3.2;
        col = applyFog(col, vViewZ, uFogColor, uFogDensity * 0.7);
        gl_FragColor = vec4(col, pulse * endFade * uStr);
      }
    `,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
  const dummy = new THREE.Object3D();
  const speeds = new Float32Array(COUNT), offs = new Float32Array(COUNT), warms = new Float32Array(COUNT);
  const PITCH = 112;
  for (let i = 0; i < COUNT; i++) {
    const alongX = rand() > 0.5;
    const lane = (Math.floor(rand() * 14) - 7) * PITCH + PITCH / 2 * (rand() > 0.5 ? 1 : -1) * 0.96;
    const start = (rand() * 2 - 1) * 900;
    const len = 160 + rand() * 260;
    const x = alongX ? start : lane;
    const z = alongX ? lane : start;
    if (Math.hypot(x, z) < 240) { speeds[i] = 0; continue; }
    dummy.position.set(x, 0.7, z);
    dummy.rotation.set(-Math.PI / 2, 0, alongX ? 0 : Math.PI / 2);
    dummy.scale.set(len, 5.2, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    speeds[i] = (0.25 + rand() * 0.5) * (rand() > 0.5 ? 1 : -1);
    offs[i] = rand();
    warms[i] = rand() > 0.5 ? 1 : 0;
  }
  geo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs, 1));
  geo.setAttribute('aWarm', new THREE.InstancedBufferAttribute(warms, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return { mesh, u };
}

// 이펙트: 용접 불꽃, 배당 골드 스트림, 포스트프로세싱 체인
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { rng } from './util.js';
import { towerSection, sectionPoint, H } from './tower.js';

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- 용접 불꽃 (CPU 파티클)
export function createSparks() {
  const N = 260;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N); // 남은 수명. 0 = 비활성
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 5, map: glowTexture(), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  const rand = rng(777);
  let emitters = [0, 2.2, 4.1];
  let emitTimer = 0;
  let cursor = 0;

  function update(dt, t, rate, buildH) {
    emitTimer -= dt;
    if (emitTimer < 0) { emitters = [rand() * 6.283, rand() * 6.283, rand() * 6.283]; emitTimer = 1.3; }
    if (rate > 0.01 && buildH > 20 && buildH < H - 8) {
      const spawnN = Math.floor(rate * 8 + rand() * 3);
      const tSec = towerSection(Math.min(buildH / H, 0.95));
      for (let s = 0; s < spawnN; s++) {
        const em = emitters[Math.floor(rand() * emitters.length)];
        const th = em + (rand() - 0.5) * 0.25;
        const [x, z] = sectionPoint(th, tSec);
        const i = cursor; cursor = (cursor + 1) % N;
        pos[i * 3] = x * 1.02; pos[i * 3 + 1] = buildH - 2 - rand() * 5; pos[i * 3 + 2] = z * 1.02;
        const sp = 6 + rand() * 22;
        vel[i * 3] = (x / 40) * sp * (0.4 + rand());
        vel[i * 3 + 1] = 4 + rand() * 14;
        vel[i * 3 + 2] = (z / 40) * sp * (0.4 + rand());
        life[i] = 0.5 + rand() * 0.9;
      }
    }
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt;
      vel[i * 3 + 1] -= 42 * dt; // 중력
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const l = Math.max(life[i], 0);
      const heat = Math.min(1, l * 1.6);
      col[i * 3] = 2.2 * heat;
      col[i * 3 + 1] = (0.9 + 0.6 * heat) * heat;
      col[i * 3 + 2] = 0.35 * heat * heat;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return { mesh: pts, update };
}

// ---------------------------------------------------------------- 배당 골드 스트림 (GPU 루프 파티클)
export function createDividends() {
  const N = 850;
  const rand = rng(4242);
  const spawn = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = 0.08 + rand() * 0.84;
    const sec = towerSection(t);
    const th = rand() * Math.PI * 2;
    const [x, z] = sectionPoint(th, sec);
    spawn[i * 3] = x * 1.03; spawn[i * 3 + 1] = t * H; spawn[i * 3 + 2] = z * 1.03;
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(spawn, 3)); // = 스폰 위치
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const u = {
    uTime: { value: 0 },
    uStr: { value: 0 },
    uWalletPos: { value: new THREE.Vector3(0, 40, 400) },
    uMap: { value: glowTexture() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime, uStr;
      uniform vec3 uWalletPos;
      varying float vA;
      void main(){
        float p = fract(uTime * (0.10 + aSeed * 0.06) + aSeed * 7.13);
        vec3 s = position;
        vec3 ctrl = mix(s, uWalletPos, 0.35) + vec3(0.0, 120.0 + aSeed * 80.0, 0.0);
        vec3 b1 = mix(s, ctrl, p);
        vec3 b2 = mix(ctrl, uWalletPos, p);
        vec3 w = mix(b1, b2, p);
        vA = uStr * smoothstep(0.0, 0.12, p) * smoothstep(1.0, 0.86, p);
        vec4 mv = viewMatrix * vec4(w, 1.0);
        float sz = (3.0 + aSeed * 4.0) * (0.7 + 0.6 * sin(3.14159 * p));
        gl_PointSize = sz * (700.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      varying float vA;
      void main(){
        if (vA < 0.01) discard;
        vec4 tex = texture2D(uMap, gl_PointCoord);
        vec3 gold = vec3(1.15, 0.82, 0.38);
        gl_FragColor = vec4(gold * tex.a * vA * 1.8, tex.a * vA);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 6;
  return { mesh: pts, u };
}

// ---------------------------------------------------------------- 포스트프로세싱
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVig: { value: 0.4 },
    uGrain: { value: 0.026 },
    uCA: { value: 0.0006 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uVig, uGrain, uCA;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec2 r = vUv - 0.5;
      float rl = length(r);
      // 색수차
      vec2 off = r * uCA * rl * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // 비네트
      float vig = smoothstep(0.92, 0.28, rl);
      col *= mix(1.0 - uVig, 1.0, vig);
      // 필름 그레인
      float gn = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 13.7) * 91.0);
      col += (gn - 0.5) * uGrain;
      // 미세 S커브
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.5, 0.88);
  const output = new OutputPass();
  const grade = new ShaderPass(GradeShader);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(grade);
  return {
    composer, bloom, grade,
    setSize(w, h) { composer.setSize(w, h); bloom.setSize(w, h); },
  };
}

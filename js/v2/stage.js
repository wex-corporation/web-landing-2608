// v2 스테이지: 스튜디오 배경, IBL 환경, 거울 바닥, 부유 먼지, 헤일로
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLSL_COMMON } from '../util.js';

export const VIOLET = new THREE.Color(0x6d2ef5);
export const VIOLET_L = new THREE.Color(0x9d7bff);

// ---------------------------------------------------------------- 배경 돔
export function createBackdrop() {
  const u = {
    uZen: { value: new THREE.Color(0x020208) },
    uHor: { value: new THREE.Color(0x120b26) },
    uGlow: { value: new THREE.Color(0x2a1758) },
    uGlowI: { value: 0.5 },
    uStars: { value: 0.5 },
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
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uZen, uHor, uGlow;
      uniform float uGlowI, uStars, uTime;
      ${GLSL_COMMON}
      void main(){
        vec3 d = normalize(vDir);
        float el = d.y;
        vec3 col = mix(uHor, uZen, pow(clamp(el, 0.0, 1.0), 0.42));
        col = mix(col, uZen * 0.6, smoothstep(0.0, -0.3, el));
        // 지평 바이올렛 광층
        col += uGlow * exp(-abs(el + 0.05) * 8.5) * uGlowI;
        // 미세 결
        float n = vnoise(vec2(atan(d.z, d.x) * 5.0, el * 11.0) + uTime * 0.004);
        col *= 0.96 + 0.08 * n;
        // 절제된 별
        if (uStars > 0.001 && el > 0.03) {
          vec2 sp = vec2(atan(d.z, d.x) * 30.0, asin(clamp(d.y, -1.0, 1.0)) * 30.0);
          vec2 cell = floor(sp);
          float r = hash12(cell);
          vec2 pos = fract(sp) - vec2(hash12(cell + 7.1), hash12(cell + 3.7));
          float star = smoothstep(0.05, 0.0, length(pos)) * step(0.9, r);
          float tw = 0.55 + 0.45 * sin(uTime * (1.2 + r * 2.5) + r * 40.0);
          col += vec3(0.75, 0.8, 1.0) * star * tw * uStars * smoothstep(0.03, 0.3, el);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4200, 48, 32), mat);
  mesh.frustumCulled = false;
  return { mesh, u };
}

// ---------------------------------------------------------------- IBL 환경 (스튜디오 소프트박스)
export function buildEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04040a);
  const box = (w, h, color, intensity, pos, lookAtOrigin = true) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    if (lookAtOrigin) m.lookAt(0, 0, 0);
    scene.add(m);
  };
  // 키: 좌상단 거대한 쿨 화이트 스트립 (유리의 긴 하이라이트)
  box(220, 900, 0xcfe0ff, 6.5, [-700, 500, 500]);
  // 보조: 우측 낮은 은은한 스트립
  box(160, 700, 0x9db8e8, 2.6, [820, 260, -300]);
  // 림: 후면 바이올렛 광폭 스트립
  box(1000, 420, 0x6d2ef5, 2.2, [150, 320, -900]);
  // 지평 워머: 아래쪽 넓은 앰버-바이올렛
  box(1600, 260, 0x3a2a66, 1.5, [0, -320, 300]);
  // 천장 은은한 돔 라이트
  box(900, 900, 0x2a3450, 1.2, [0, 950, 0]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.038);
  pmrem.dispose();
  return rt.texture;
}

// ---------------------------------------------------------------- 거울 바닥
export function createFloor() {
  const group = new THREE.Group();
  const mirror = new Reflector(new THREE.CircleGeometry(3200, 72), {
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 1024,
    color: 0x151a26,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = 0;
  group.add(mirror);

  // 거울 위 감쇠 오버레이: 중심은 살짝 비치고 멀어질수록 어둠에 잠김
  const u = { uFade: { value: 0.62 }, uTint: { value: new THREE.Color(0x05060c) } };
  const overlay = new THREE.Mesh(
    new THREE.CircleGeometry(3200, 72),
    new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */`
        varying vec2 vP;
        void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */`
        varying vec2 vP;
        uniform float uFade; uniform vec3 uTint;
        void main(){
          float d = length(vP);
          float a = mix(uFade, 1.0, smoothstep(260.0, 2500.0, d));
          gl_FragColor = vec4(uTint, a);
        }
      `,
    })
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.5;
  overlay.renderOrder = 1;
  group.add(overlay);

  // 타워 발치 바이올렛 글로우 링
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x5b21d6, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(62, 84, 96), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.8;
  ring.renderOrder = 2;
  group.add(ring);

  return { group, mirror, overlayU: u, ringMat };
}

// ---------------------------------------------------------------- 부유 먼지
export function createDust() {
  const N = 320;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = 90 + Math.random() * 520;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 8 + Math.random() * 560;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const u = { uTime: { value: 0 }, uStr: { value: 0.5 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uTime * (0.08 + aSeed * 0.1) + aSeed * 20.0) * 14.0;
        p.y += sin(uTime * (0.05 + aSeed * 0.07) + aSeed * 31.0) * 10.0;
        p.z += cos(uTime * (0.07 + aSeed * 0.09) + aSeed * 11.0) * 14.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vA = 0.5 + 0.5 * sin(uTime * (0.4 + aSeed) + aSeed * 50.0);
        gl_PointSize = (1.4 + aSeed * 2.4) * (600.0 / max(-mv.z, 1.0));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vA;
      uniform float uStr;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.05, length(c)) * vA * uStr * 0.35;
        gl_FragColor = vec4(vec3(0.75, 0.72, 1.0) * a, a);
      }
    `,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { mesh: pts, u };
}

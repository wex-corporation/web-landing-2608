// 공용 수학/이징 유틸
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sat = (x) => clamp(x, 0, 1);

// 전역 타임라인 T의 [a,b] 구간을 0..1로 매핑
export const span = (T, a, b) => sat((T - a) / (b - a));

export const smoothstep = (a, b, x) => {
  const t = sat((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const easeOutCubic = (t) => 1 - Math.pow(1 - sat(t), 3);
export const easeInOutCubic = (t) => {
  t = sat(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeInOutSine = (t) => -(Math.cos(Math.PI * sat(t)) - 1) / 2;
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * sat(t)));

// mulberry32 시드 난수
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const fmtKR = (n) => Math.round(n).toLocaleString('ko-KR');

// 셰이더 공용 조각: 해시/노이즈/포그
export const GLSL_COMMON = /* glsl */`
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
    float a = hash12(i), b = hash12(i+vec2(1,0)), c = hash12(i+vec2(0,1)), d = hash12(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  vec3 applyFog(vec3 col, float viewZ, vec3 fogColor, float density){
    float f = 1.0 - exp(-density * density * viewZ * viewZ);
    return mix(col, fogColor, clamp(f, 0.0, 1.0));
  }
`;

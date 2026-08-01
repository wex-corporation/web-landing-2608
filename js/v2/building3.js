// WeBlock 플래그십 — 레퍼런스(가평설악IC DT) 매싱을 브릭으로 재현
// 레고 설명서 구성 참고: 봉지1 = 부지+1층 / 봉지2 = 2층 / 3 = 3층+지붕
import * as THREE from 'three';
import { BrickGrid, buildBrickMeshes, MAT, U, BH } from './bricks.js';

// 그리드 범위: x 0..33 (좌→우), z 0..23 (뒤→앞), y 0..20 (아래→위)
export const GX = 34, GZ = 24, GY = 21;
export const ORIGIN_X = GX / 2, ORIGIN_Z = GZ / 2;
export const W_WIDTH = GX * U, W_DEPTH = GZ * U, W_HEIGHT = GY * BH;

// 층 경계 (설명서 봉지 = 3단계)
export const STAGE_Y = [5, 12, 20]; // 1단계 y<=5, 2단계 y<=12, 3단계 나머지

export function buildGrid() {
  const g = new BrickGrid();

  // ══ 실제 레고 모델 사진 기준 매싱 ══
  //  · 슬래브·기둥·지붕은 밝은 화이트, 벽면은 따뜻한 크림 — 이 2톤이 이 건물의 얼굴이다
  //  · 2층은 전면 통유리 + 검은 멀리언, 3층은 우측으로 물러나고 좌측은 테라스
  //  · 지붕이 앞·좌로 크게 내밀어 깊은 그늘을 만든다

  // ── [봉지 1] 부지 + 1층 ─────────────────────────────
  // 잔디 매트 + 검은 테두리 프레임 (모델이 놓인 잔디판)
  g.fill(-9, 42, -8, 30, 0, 0, MAT.GREEN);
  g.fill(-9, 42, -8, -8, 0, 0, MAT.DARK);
  g.fill(-9, 42, 30, 30, 0, 0, MAT.DARK);
  g.fill(-9, -9, -8, 30, 0, 0, MAT.DARK);
  g.fill(42, 42, -8, 30, 0, 0, MAT.DARK);

  // 주차장 아스팔트 + 흰 주차선 (사진처럼 절제해서 몇 줄만)
  g.fill(-5, 38, -4, 28, 0, 0, MAT.ASPHALT);
  for (let x = 4; x <= 32; x += 7) g.fill(x, x, 25, 28, 0, 0, MAT.WHITE);
  // 건물 앞 보도 (밝은 화이트)
  g.fill(-6, 32, 22, 23, 0, 0, MAT.WHITE);
  // 정면 하단 네임 플레이트 (모델의 검은 각인 타일)
  g.fill(3, 17, 23, 23, 0, 0, MAT.DARK);
  // 입구 옆 화단
  g.fill(17, 21, 22, 23, 0, 0, MAT.GREEN);
  g.fill(1, 3, 20, 23, 0, 0, MAT.GREEN);

  // 1층 실내 볼륨 (좌측): 크림 벽 + 전면 통유리
  g.shell(3, 16, 3, 20, 1, 5, MAT.STONE);
  g.fill(3, 16, 20, 20, 1, 5, MAT.GLASS);      // 전면 전체 유리
  g.fill(3, 3, 6, 17, 1, 5, MAT.GLASS);        // 좌측면 유리 슬릿
  g.fill(8, 12, 20, 20, 1, 1, MAT.DARK);       // 출입구 프레임 하단
  g.fill(9, 11, 20, 20, 2, 4, MAT.GLASS);      // 자동문
  // 유리 사이 검은 멀리언
  for (let x = 5; x <= 15; x += 3) g.fill(x, x, 20, 20, 1, 5, MAT.DARK);

  // 1층 우측: 필로티 (드라이브스루) — 사진처럼 '흰 원형 기둥'
  const cols = [[20, 5], [20, 18], [26, 5], [26, 18], [31, 11]];
  cols.forEach(([cx, cz]) => g.fill(cx, cx + 1, cz, cz + 1, 1, 5, MAT.WHITE));
  g.fill(17, 19, 3, 4, 1, 5, MAT.DARK);        // 코어 벽
  g.fill(20, 31, 3, 19, 1, 1, MAT.ASPHALT);    // 필로티 바닥

  // 1층 실내 가구 — 유리 너머로 비친다
  for (let i = 0; i < 4; i++) {
    g.fill(5 + i * 3, 6 + i * 3, 12, 13, 1, 1, MAT.WOOD);
    g.fill(5 + i * 3, 5 + i * 3, 15, 15, 1, 2, MAT.GREEN);
    g.fill(6 + i * 3, 6 + i * 3, 10, 10, 1, 2, MAT.GREEN);
  }
  g.fill(4, 14, 6, 7, 1, 2, MAT.DARK);         // 카운터

  // 우드 타워 (전면 중앙-우측, 1층~지붕 관통) — 이 건물의 척추
  g.fill(16, 19, 17, 21, 1, 19, MAT.WOOD);

  // ── [봉지 2] 2층 ────────────────────────────────────
  // 캔틸레버 슬래브 — 앞·좌로 내밀어 1층에 그늘을 드리운다
  g.fill(0, 32, 1, 22, 6, 6, MAT.WHITE);
  // 전면 통유리 (좌우 끝단 벽만 크림)
  g.fill(2, 31, 21, 21, 7, 12, MAT.GLASS);
  g.fill(2, 3, 2, 21, 7, 12, MAT.STONE);       // 좌측 측벽
  g.fill(31, 31, 3, 20, 7, 12, MAT.GLASS);     // 우측 측면 통유리
  g.fill(31, 31, 3, 20, 7, 7, MAT.DARK);
  g.fill(31, 31, 3, 20, 12, 12, MAT.DARK);
  for (let z = 5; z <= 19; z += 3) g.fill(31, 31, z, z, 7, 12, MAT.DARK);
  g.fill(30, 30, 2, 21, 7, 12, MAT.STONE);     // 우측 내벽
  g.fill(2, 31, 2, 2, 7, 12, MAT.STONE);       // 후면
  g.fill(4, 29, 2, 21, 12, 12, MAT.STONE);     // 천장
  g.fill(4, 29, 3, 3, 7, 12, MAT.GLASS);       // 후면 안쪽 유리(빛 통과)
  // 검은 멀리언 리듬
  for (let x = 5; x <= 29; x += 3) g.fill(x, x, 21, 21, 7, 12, MAT.DARK);
  g.fill(2, 31, 21, 21, 7, 7, MAT.DARK);       // 하단 프레임
  g.fill(2, 31, 21, 21, 12, 12, MAT.DARK);     // 상단 프레임
  // 2층 오피스 가구
  for (let i = 0; i < 6; i++) {
    g.fill(4 + i * 4, 6 + i * 4, 8, 10, 7, 7, MAT.WHITE);
    g.fill(4 + i * 4, 4 + i * 4, 12, 12, 7, 8, MAT.DARK);
  }

  // ── [봉지 3] 3층 + 지붕 ─────────────────────────────
  // 3층 슬래브 = 2층 지붕. 좌측은 그대로 열린 테라스가 된다
  g.fill(0, 32, 1, 22, 13, 13, MAT.WHITE);
  // 3층 볼륨은 우측으로 물러나 앉는다 (사진의 가장 큰 특징)
  g.shell(13, 31, 4, 21, 14, 19, MAT.GLASS);
  g.fill(13, 15, 4, 21, 14, 19, MAT.STONE);    // 좌측 측벽
  g.fill(31, 31, 5, 20, 14, 18, MAT.GLASS);    // 우측 측면 유리 띠
  g.fill(31, 31, 5, 20, 14, 14, MAT.DARK);
  g.fill(31, 31, 5, 20, 19, 19, MAT.STONE);
  g.fill(30, 30, 4, 21, 14, 19, MAT.STONE);
  g.fill(13, 31, 4, 4, 14, 19, MAT.STONE);     // 후면
  for (let x = 21; x <= 29; x += 3) g.fill(x, x, 21, 21, 14, 19, MAT.DARK);
  g.fill(13, 31, 21, 21, 14, 14, MAT.DARK);
  // 3층 라운지 가구
  for (let i = 0; i < 4; i++) g.fill(18 + i * 3, 19 + i * 3, 8, 10, 14, 14, MAT.WOOD);

  // 좌측 테라스: 투명 난간 (모델의 클리어 브릭)
  g.fill(1, 12, 21, 21, 14, 15, MAT.GLASS);
  g.fill(1, 1, 4, 21, 14, 15, MAT.GLASS);
  g.fill(1, 12, 4, 4, 14, 15, MAT.GLASS);
  g.fill(1, 12, 4, 21, 13, 13, MAT.WHITE);     // 테라스 바닥

  // 지붕 — 앞·좌로 크게 내밀어 깊은 그늘 (사진의 시그니처)
  g.fill(11, 34, 2, 24, 20, 20, MAT.WHITE);
  g.fill(22, 26, 8, 12, 21, 21, MAT.DARK);     // 옥상 설비

  // 우드 타워가 지붕을 뚫고 살짝 올라온다
  g.fill(16, 19, 17, 21, 20, 20, MAT.WOOD);

  return g;
}

// ---------------------------------------------------------------- 로고 마크 (단일 사양)
// 업로드 로고 사양: 5열 × 세로 1:2 블록. 윗줄 0·2·4, 아랫줄 1·3 → 지그재그 W.
// 비율은 여기서만 정의하고 모든 렌더 지점이 이 값을 따른다 (찌그러짐 방지).
const MARK_COLS = 5;
const MARK_BH = 2;        // 블록 높이 ÷ 블록 폭
const MARK_DROP = 0.88;   // 아랫줄 내림폭 ÷ 블록 높이
const MARK_CELLS = [[0, 0], [2, 0], [4, 0], [1, 1], [3, 1]];
export const MARK_ASPECT = MARK_COLS / (MARK_BH * (1 + MARK_DROP)); // ≈ 1.33 : 1

// (cx, cy) 중심에 폭 markW로 그린다. 높이는 비율에서 파생되므로 절대 찌그러지지 않는다.
function drawMark(g, cx, cy, markW, color) {
  const u = markW / MARK_COLS;
  const bh = u * MARK_BH;
  const gap = u * 0.11;                       // 블록이 각각 하나의 브릭으로 읽히도록
  const x0 = cx - markW / 2;
  const y0 = cy - (bh * (1 + MARK_DROP)) / 2;
  g.fillStyle = color;
  MARK_CELLS.forEach(([bx, by]) =>
    g.fillRect(x0 + bx * u + gap / 2, y0 + by * bh * MARK_DROP + gap / 2, u - gap, bh - gap));
}
const MARK_VIOLET = '#5B16EE';   // 업로드 로고 원색
const MARK_LIGHT = '#F6F4FF';

// 원형 메달리온 (스타벅스 사인 위치 → WeBlock)
export function createMedallion() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = '#1a1030';
    g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    g.lineWidth = 16; g.strokeStyle = '#8A5CFF';
    g.beginPath(); g.arc(256, 256, 238, 0, 7); g.stroke();
    drawMark(g, 256, 208, 268, MARK_LIGHT);
    g.fillStyle = MARK_LIGHT;
    g.font = '800 62px Pretendard, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('WeBlock', 256, 400);
    tex.needsUpdate = true;
  };
  draw();
  const group = new THREE.Group();
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(26, 48), faceMat);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x2a1c4a, roughness: 0.5, metalness: 0.3 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 3, 48), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = -2;
  group.add(rim, face);
  // 우드 타워 전면(z+) 3층 높이에 부착
  group.position.set((17.5 - 17) * U, 16.2 * BH, (21 - 12) * U + 2);
  return { group, redraw: draw, mats: [faceMat, rimMat] };
}

// 파사드 워드마크 (사진의 'STARBUCKS' 자리)
// 캔버스를 글자 실측폭에 맞춰 만들고, 메시는 그 종횡비대로 스케일 → 늘어남 없음
export function createWordmark() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 220;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const H_WORLD = 16;
  const FONT = '800 120px Pretendard, sans-serif';
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  const draw = () => {
    const H = 220, markW = 148, gap = 46, pad = 6;
    let g = c.getContext('2d');
    g.font = FONT;
    const W = Math.ceil(pad * 2 + markW + gap + g.measureText('WeBlock').width);
    if (c.width !== W) c.width = W;      // 캔버스 리사이즈 시 컨텍스트가 초기화된다
    if (c.height !== H) c.height = H;
    g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    drawMark(g, pad + markW / 2, H / 2, markW, MARK_VIOLET);
    g.fillStyle = '#20242e';
    g.font = FONT;
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('WeBlock', pad + markW + gap, H / 2 + 4);
    tex.needsUpdate = true;
    mesh.scale.set(H_WORLD * (W / H), H_WORLD, 1);
  };
  draw();
  mesh.position.set((10.5 - 17) * U, 6.55 * BH, (22 - 12) * U + 6.2);
  return { mesh, redraw: draw, mats: [mesh.material] };
}

// 폴 사인 (레퍼런스의 드라이브스루 기둥) — 브릭 폴 + 메달리온
export function createPoleSign() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.7, metalness: 0.3 });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(7, 210, 7), poleMat);
  pole.position.y = 105;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#1a1030';
    g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
    g.lineWidth = 9; g.strokeStyle = '#8A5CFF';
    g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    drawMark(g, 128, 104, 134, MARK_LIGHT);
    g.fillStyle = MARK_LIGHT;
    g.font = '800 30px Pretendard, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText('WeBlock', 128, 200);
    tex.needsUpdate = true;
  };
  draw();
  const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const s1 = new THREE.Mesh(new THREE.CircleGeometry(26, 40), signMat);
  s1.position.set(0, 200, 4.2);
  const s2 = s1.clone(); s2.rotation.y = Math.PI; s2.position.z = -4.2;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(27, 27, 8, 40), poleMat);
  disc.rotation.x = Math.PI / 2; disc.position.y = 200;
  // 하단 안내 플레이트
  const plate = new THREE.Mesh(new THREE.BoxGeometry(44, 26, 5), poleMat);
  plate.position.set(0, 156, 2.2);
  const pc = document.createElement('canvas');
  pc.width = 256; pc.height = 128;
  const ptex = new THREE.CanvasTexture(pc);
  ptex.colorSpace = THREE.SRGBColorSpace;
  const drawP = () => {
    const g = pc.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = '#F2F0FA';
    g.font = '800 44px Pretendard, sans-serif';
    g.textAlign = 'center';
    g.fillText('FRACTION', 128, 58);
    g.font = '600 34px Pretendard, sans-serif';
    g.fillStyle = '#9d7bff';
    g.fillText('1 / 100,000', 128, 104);
    ptex.needsUpdate = true;
  };
  drawP();
  const plateMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, toneMapped: false });
  const pf = new THREE.Mesh(new THREE.PlaneGeometry(42, 21), plateMat);
  pf.position.set(0, 156, 5.0);
  group.add(pole, disc, s1, s2, plate, pf);
  // 실제 레고 모델처럼 좌측에 드라이브스루 폴 사인. 서막에서 카메라가 가까우니 살짝 작게
  group.scale.setScalar(0.82);
  group.position.set((-9 - 17) * U, 0, (13 - 12) * U);
  return { group, redraw: () => { draw(); drawP(); }, mats: [poleMat, signMat, plateMat] };
}

// ---------------------------------------------------------------- 브릭 자동차 (주차 라인)
export function createCars(envMap) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe9e9ec, roughness: 0.45, metalness: 0.25, envMap, envMapIntensity: 1.0 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3446, roughness: 0.15, metalness: 0, envMap, envMapIntensity: 1.4, transparent: true, opacity: 0.75 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x191b1f, roughness: 0.9 });
  const mk = (x, z, rotY) => {
    const car = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(40, 11, 19), bodyMat);
    body.position.y = 9;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(20, 9, 17), glassMat);
    cabin.position.set(-2, 18, 0);
    [[-13, 9.5], [13, 9.5], [-13, -9.5], [13, -9.5]].forEach(([tx, tz]) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 4, 12), tireMat);
      t.rotation.x = Math.PI / 2;
      t.position.set(tx, 5, tz);
      car.add(t);
    });
    car.add(body, cabin);
    car.position.set(x, 0, z);
    car.rotation.y = rotY;
    group.add(car);
  };
  mk((23 - 17) * U, (21.5 - 12) * U, 0);
  mk((28 - 17) * U, (21.5 - 12) * U, 0);
  mk((33 - 17) * U, (21.5 - 12) * U, 0);
  return { group, mats: [bodyMat, glassMat, tireMat] };
}

// ---------------------------------------------------------------- 토큰 코인 (업로드한 원형 심벌)
function drawTokenFace(c) {
  const S = 512, R = S / 2;
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  // 바이올렛 원판 = 업로드 심벌
  g.fillStyle = MARK_VIOLET;
  g.beginPath(); g.arc(R, R, R, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 5;
  g.beginPath(); g.arc(R, R, R - 24, 0, 7); g.stroke();
  drawMark(g, R, R - 30, 244, '#E4DCFF');   // 순백은 블룸에 뭉개져 형태가 사라진다
  g.fillStyle = 'rgba(228,220,255,0.92)';
  g.font = '700 38px Pretendard, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('1 / 100,000', R, R + 148);
}
export function createToken(envMap) {
  const group = new THREE.Group();
  const R = 46, D = 7;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const redraw = () => { drawTokenFace(c); tex.needsUpdate = true; };
  redraw();
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d10a8, metalness: 0.85, roughness: 0.24, envMap, envMapIntensity: 1.2, transparent: true,
  });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R, R, D, 72), rimMat);
  rim.rotation.x = Math.PI / 2;
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
  const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.995, 72), faceMat);
  face.position.z = D / 2 + 0.12;
  const face2 = face.clone(); face2.rotation.y = Math.PI; face2.position.z = -D / 2 - 0.12;
  group.add(rim, face, face2);
  group.visible = false;
  return { group, mats: [rimMat, faceMat], redraw };
}

// ---------------------------------------------------------------- 배당 코인 흐름 (수익 챕터)
// 텍스처는 하나만 만들어 N개 메시가 공유한다.
export function createCoins(envMap, n = 9) {
  const group = new THREE.Group();
  const R = 15, D = 3.4;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => {
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = MARK_VIOLET;
    g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
    drawMark(g, 128, 128, 150, '#E4DCFF');
    tex.needsUpdate = true;
  };
  redraw();
  const rimMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d10a8, metalness: 0.85, roughness: 0.26, envMap, envMapIntensity: 1.2, transparent: true, opacity: 0,
  });
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, opacity: 0 });
  const rimGeo = new THREE.CylinderGeometry(R, R, D, 28);
  const faceGeo = new THREE.CircleGeometry(R * 0.99, 28);
  const items = [];
  for (let i = 0; i < n; i++) {
    const g0 = new THREE.Group();
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    const f1 = new THREE.Mesh(faceGeo, faceMat); f1.position.z = D / 2 + 0.08;
    const f2 = f1.clone(); f2.rotation.y = Math.PI; f2.position.z = -D / 2 - 0.08;
    g0.add(rim, f1, f2);
    group.add(g0);
    items.push(g0);
  }
  group.visible = false;
  return {
    group, redraw, mats: [rimMat, faceMat],
    update(t, amount) {
      group.visible = amount > 0.02;
      if (!group.visible) return;
      for (let i = 0; i < items.length; i++) {
        const ph = ((t * 0.13 + i / items.length) % 1);
        const a = i * 2.39 + ph * 1.9;
        const rad = 215 + ph * 125;
        const g0 = items[i];
        g0.position.set(Math.cos(a) * rad, -10 + ph * 430, Math.sin(a) * rad);
        g0.rotation.y = t * 1.1 + i;
        g0.rotation.x = Math.sin(t * 0.8 + i) * 0.22;
        const fade = Math.sin(Math.PI * Math.min(ph / 0.16, 1) * 0.5) * (1 - Math.max(0, (ph - 0.72) / 0.28));
        g0.scale.setScalar(0.55 + fade * 0.6);
      }
      rimMat.opacity = amount;
      faceMat.opacity = amount;
    },
  };
}

// ---------------------------------------------------------------- 전체 조립
export function createBuilding(envMap) {
  const grid = buildGrid();
  const bricks = grid.toBricks();
  const brickSys = buildBrickMeshes(bricks, envMap, { originX: ORIGIN_X, originZ: ORIGIN_Z });
  const group = new THREE.Group();
  brickSys.meshes.forEach((m) => group.add(m));

  // 건물 본체(부지판 y=0 제외)의 실루엣 상자.
  // 서막에서 실사 사진을 이 상자에 정확히 맞춰 앉히므로, 매싱을 고치면 사진도 따라온다.
  const mass = { x0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const b of bricks) {
    if (b.y < 1) continue;                     // 잔디·아스팔트 판은 건물이 아니다
    mass.x0 = Math.min(mass.x0, (b.x - ORIGIN_X) * U);
    mass.x1 = Math.max(mass.x1, (b.x + b.len - ORIGIN_X) * U);
    mass.y1 = Math.max(mass.y1, (b.y + 1) * BH);
    mass.z1 = Math.max(mass.z1, (b.z + 1 - ORIGIN_Z) * U);
  }
  mass.y0 = 0;                                 // 사진의 기준선과 같은 '땅에 닿는 선'

  const pole = createPoleSign();
  const cars = createCars(envMap);
  group.add(pole.group, cars.group);

  // 실내 웜 라이트 (유리 너머 밝기)
  const lampC = document.createElement('canvas'); lampC.width = lampC.height = 64;
  {
    const g = lampC.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,222,175,1)');
    gr.addColorStop(1, 'rgba(255,190,120,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  const lampTex = new THREE.CanvasTexture(lampC);
  const lamps = new THREE.Group();
  const lampMats = [];
  const put = (gx, gy, gz, s) => {
    const m = new THREE.SpriteMaterial({ map: lampTex, color: 0xffd9a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    lampMats.push(m);
    const sp = new THREE.Sprite(m);
    sp.scale.setScalar(s);
    sp.position.set((gx - ORIGIN_X) * U, gy * BH, (gz - ORIGIN_Z) * U);
    lamps.add(sp);
  };
  for (let i = 0; i < 14; i++) put(4.5 + i * 0.9, 3.2, 14 + (i % 3) * 2.5, 17);   // 1F (유리 가까이)
  for (let i = 0; i < 22; i++) put(3.5 + i * 1.3, 9.6, 15 + (i % 4) * 2.2, 19);   // 2F
  for (let i = 0; i < 16; i++) put(14 + i * 1.15, 16.4, 14 + (i % 4) * 2.2, 17);  // 3F
  // 지붕·슬래브 아래 웜 LED 스트립이 우드 타워를 씻어 내린다 (모델의 시그니처)
  for (let i = 0; i < 5; i++) put(16 + i * 0.8, 19.4, 21.4, 9);
  for (let i = 0; i < 5; i++) put(16 + i * 0.8, 12.4, 21.4, 9);
  for (let i = 0; i < 5; i++) put(16 + i * 0.8, 5.4, 21.4, 9);
  for (let i = 0; i < 7; i++) put(19 + i * 2.4, 4.8, 11 + (i % 2) * 6, 13);       // 필로티 다운라이트
  for (let i = 0; i < 4; i++) put(22 + i * 3.5, 1.6, 21, 11);                     // 주차 바닥 워시
  group.add(lamps);

  return {
    group, brickSys, pole, cars, lamps, lampMats, mass,
    redrawAll() { pole.redraw(); },
    update(state, t) {
      const bu = brickSys.u;
      bu.uTime.value = t;
      bu.uProg.value = state.prog;
      bu.uShatter.value = state.shatter;
      bu.uRingRot.value = state.ringRot;
      bu.uGhostB.value = state.holo;
      bu.uSweepY.value = state.sweepY;
      bu.uSweepI.value = state.sweepI;
      const litFade = state.interiorI;
      lampMats.forEach((m, i) => (m.opacity = litFade * (0.5 + 0.5 * Math.sin(t * 0.7 + i))));
      lamps.visible = litFade > 0.02;
      const pf = state.poleFade ?? 1;
      pole.group.visible = state.prog > 0.02 && state.shatter < 0.85 && pf > 0.02;
      pole.mats.forEach((m) => { m.transparent = true; m.opacity = Math.min(state.prog * 2.2, 1) * (1 - state.shatter) * pf; });
      cars.group.visible = state.cars > 0.02 && state.shatter < 0.5;
      cars.mats.forEach((m) => { m.transparent = true; m.opacity = state.cars * (1 - state.shatter * 2); });
    },
  };
}

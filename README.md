# 위블록 WEBLOCK — 3D 스토리텔링 랜딩 페이지

스크롤 한 번으로 555m 랜드마크가 **지어지고 → 조각나고 → 투자되고 → 수익이 되어 돌아오는**
8챕터 시네마틱 랜딩. Three.js 기반, 빌드 스텝 없음(정적 호스팅만으로 동작), 외부 CDN 무의존(전부 로컬 번들).

기획·연출 상세는 [PLAN.md](./PLAN.md) 참고.

## 실행

```bash
# 저장소 루트에서
cd weblock-landing
python3 -m http.server 8123
# → http://localhost:8123 접속 후 스크롤
```

(ES 모듈을 쓰므로 `file://` 직접 열기는 안 되고, 아무 정적 서버면 됩니다. `npx serve`도 OK)

## 구조

```
weblock-landing/
├── index.html          # 8챕터 마크업 + 카피
├── css/style.css       # 타이포/오버레이/지갑 카드/반응형
├── js/
│   ├── main.js         # 디렉터: 스크롤→타임라인, 카메라 트랙, 시간대(룩), UI 동기화
│   ├── world.js        # 하늘 돔, 절차적 도시(1,400+동), 지면/광장, 석촌호수, 교통 광류
│   ├── tower.js        # 타워 쉘(슈퍼일립스 로프트)+유리 셰이더, 코어/크레인, 조각 패널, 히어로 토큰
│   ├── fx.js           # 용접 불꽃, 배당 골드 스트림, 블룸/그레인 포스트체인
│   └── util.js         # 수학/이징/셰이더 공용
├── vendor/three/       # three.js r0.185 (로컬 번들)
└── assets/fonts/       # Pretendard Variable (로컬 번들)
```

## 연출 타임라인 (스크롤 = T 0→8)

| T | 챕터 | 핵심 연출 |
|---|------|-----------|
| 0–1 | 서막 | 실사 사진 → 바이올렛 스캔 → 레고 전환 → 위에서부터 해체 |
| 1–2 | 구조 | 해체된 블록이 층별로 재조립되며 자산의 구조를 드러낸다 |
| 2–3 | 자산 | 실내 점등 + 사인 + 자동차 — 운영 중인 건물의 얼굴 |
| 3–4 | 조각화 | 스캔라인 → 파사드 4,000+조각 분리 → 3중 토큰 링 + WBL 히어로 토큰 |
| 4–5 | 투자 | 토큰이 지갑 카드로 스트림(골드), 내 지분 층 골드 밴드 |
| 5–6 | 실적 | 낮으로 전환, 누적 순매출 차트, 지표 카운터 |
| 6–7 | 수익 | 일출 + 배당 골드 파티클이 지갑으로, 수익 그래프 |
| 7–8 | CTA | 아침, 로고 락업 + 사전 등록 |

## 커스터마이즈 포인트

- **카피/수치**: `index.html` (지갑·배당 수치는 `js/main.js`의 `uiUpdate()` 매핑)
- **색/무드**: `js/main.js`의 `LOOKS` 테이블(챕터 경계별 하늘/안개/노출) + `css/style.css`의 CSS 변수
- **카메라**: `js/main.js`의 `CAM_KEYS` (T별 위치/타깃/FOV 키프레임)
- **타워 형태**: `js/tower.js`의 `towerSection()` (테이퍼/단면 모핑 프로파일)

## 품질/접근성

- ACES 톤매핑 + MSAA + 블룸/그레인/비네트, DPR≤2
- `prefers-reduced-motion` 대응(즉시 시킹), 시맨틱 섹션, OG 메타
- 모바일 레이아웃 대응(≤820px)

## 배포 (Vercel)

저장소 루트에 `vercel.json`이 있어 별도 빌드 설정 없이 이 폴더가 그대로 서빙된다.

1. [vercel.com/new](https://vercel.com/new) → GitHub로 로그인 → `felix-seoul/forclaude` Import
2. 설정은 전부 기본값 그대로 **Deploy** (Framework: Other)
3. 최초 배포는 기본 브랜치(main) 기준이라 비어 보일 수 있음 →
   **Settings → Git → Production Branch**를 `claude/web-landing-37lbds`로 변경 후
   **Deployments 탭 → ⋯ → Redeploy** 하면 프로덕션 URL에 랜딩이 뜬다.
4. 이후 이 브랜치에 푸시할 때마다 자동 재배포.

## 디버그

- `?snap` : 스크롤 스무딩 없이 즉시 시킹 + `window.__seek(T)`, `window.__info()`

// 단일 HTML 빌드 — 텔레그램·메일로 파일 하나만 보내도 그대로 열리도록 전부 내장한다.
// 사용:  node tools/build-single.mjs           →  dist/weblock-landing.html
// ES 모듈은 blob URL 로더로 로드한다 (모듈 스코프가 유지돼 이름 충돌이 없고 file:// 에서도 동작).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'js/v2/main2.js';
const OUT = path.join(ROOT, 'dist', 'weblock-landing.html');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// ── 모듈 그래프 수집 ────────────────────────────────────────────
// 'three' → vendor/three/three.module.min.js, 'three/addons/x' → vendor/three/addons/x
function resolveSpec(spec, fromRel) {
  if (spec === 'three') return 'vendor/three/three.module.min.js';
  if (spec.startsWith('three/addons/')) return 'vendor/three/addons/' + spec.slice('three/addons/'.length);
  if (spec.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  throw new Error(`알 수 없는 임포트: ${spec} (${fromRel})`);
}

// from '...' / import '...' / import('...') 의 문자열 리터럴만 잡는다
const SPEC_RE = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\2/g;

const modules = new Map(); // rel -> { src, deps: [rel] }
function collect(rel) {
  if (modules.has(rel)) return;
  const src = read(rel);
  const deps = [];
  const rewritten = src.replace(SPEC_RE, (m, head, q, spec) => {
    if (!spec.startsWith('.') && spec !== 'three' && !spec.startsWith('three/')) return m;
    const dep = resolveSpec(spec, rel);
    deps.push(dep);
    return `${head}${q}@@MOD:${dep}@@${q}`;
  });
  modules.set(rel, { src: rewritten, deps });
  deps.forEach(collect);
}
collect(ENTRY);

// 위상 정렬 (의존이 먼저)
const order = [];
const seen = new Set();
(function visit(rel, stack = new Set()) {
  if (seen.has(rel)) return;
  if (stack.has(rel)) { seen.add(rel); order.push(rel); return; } // 순환은 그대로 통과
  stack.add(rel);
  modules.get(rel).deps.forEach((d) => visit(d, stack));
  stack.delete(rel);
  if (!seen.has(rel)) { seen.add(rel); order.push(rel); }
})(ENTRY);

// ── 에셋 인라인 ────────────────────────────────────────────────
const dataUri = (rel, mime) => `data:${mime};base64,${fs.readFileSync(path.join(ROOT, rel)).toString('base64')}`;

let css = read('css/style.css');
const FONT = 'assets/fonts/PretendardVariable.woff2';
if (exists(FONT)) {
  const fontUri = dataUri(FONT, 'font/woff2');
  css = css.replace(/url\(['"]?\.\.\/assets\/fonts\/PretendardVariable\.woff2['"]?\)/,
    () => `url("${fontUri}")`);
}

// 실사 히어로 사진이 있으면 같이 내장한다
for (const [rel, mime] of [['assets/hero.jpg', 'image/jpeg'], ['assets/hero.png', 'image/png']]) {
  if (exists(rel)) {
    const uri = dataUri(rel, mime);
    const m = modules.get(ENTRY);
    m.src = m.src.replace(/const PHOTO_SRC = '[^']*';/, () => `const PHOTO_SRC = ${JSON.stringify(uri)};`);
    break;
  }
}

// ── HTML 조립 ──────────────────────────────────────────────────
let html = read('index.html');
html = html
  .replace(/\s*<link rel="stylesheet"[^>]*>/, () => `\n<style>\n${css}\n</style>`)
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/\s*<script type="module"[^>]*><\/script>/, '');

const payload = JSON.stringify(order.map((rel) => modules.get(rel).src))
  .replace(/<\/script/gi, '<\\/script');

const loader = `
<script>
// 인라인 ES 모듈 로더: 의존 순서대로 blob URL 을 만들어 서로 연결한다
(function () {
  var ids = ${JSON.stringify(order)};
  var srcs = ${payload};
  var urls = {};
  for (var i = 0; i < ids.length; i++) {
    var s = srcs[i].replace(/@@MOD:([^@]+)@@/g, function (_, id) { return urls[id] || id; });
    urls[ids[i]] = URL.createObjectURL(new Blob([s], { type: 'text/javascript' }));
  }
  import(urls[${JSON.stringify(ENTRY)}]).catch(function (e) {
    document.body.insertAdjacentHTML('beforeend',
      '<pre style="position:fixed;left:0;bottom:0;z-index:999;color:#f88;padding:12px;font:12px monospace">' + e + '</pre>');
  });
})();
</script>
`;
html = html.replace('</body>', () => loader + '</body>');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`${path.relative(ROOT, OUT)}  ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB  (모듈 ${order.length}개)`);

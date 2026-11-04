import React, { useMemo, useState } from "react";

/* ============================================================================
 * AItopia — 포트폴리오 하위 페이지
 * Polytopia 대상 비공식 팬 연구 프로젝트 (비영리·학술 목적)
 *
 * 이 파일의 모든 도식·차트·로고·색은 직접 그린 것입니다.
 * 게임 아트/스크린샷/수치표/규칙 엔진/실행 가능한 데모는 포함하지 않습니다.
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 설정 플래그 — 섹션을 켜고 끄는 곳
 *   true  : 섹션을 보여줌 (현재는 "허가 확인 후 공개 예정" 자리표시, 비활성)
 *   false : 섹션 자체를 숨김
 * 실제 링크/영상은 허가 확인 후, 이 파일에서 직접 연결하세요. (지금은 링크 없음)
 * ------------------------------------------------------------------------- */
export const CONFIG = {
  showCode: true,
  showVideo: true,
};

/* 허가 확인 후 공개할 예정 항목 (자리표시용 텍스트일 뿐, 링크·실행 기능 없음) */
export const PLANNED_RELEASES = [
  { name: "실전용 다음 수 계산기", desc: "실제 대국에서 쓸 수 있는 next move calculator" },
  { name: "봇 대 봇 관전 기능", desc: "봇끼리 대국하는 모습을 지켜보는 관전 모드" },
];

export const NOTICE = "Polytopia 대상 비공식 연구 프로젝트이며 Midjiwan과 무관합니다.";

/* ---------------------------------------------------------------------------
 * 결과 데이터 — 실측값만 넣고, 실측이 없는 곳은 비워 두거나 '예시'로 표시
 * ------------------------------------------------------------------------- */
const RESULTS = {
  // 학습 곡선: 실제 로그가 아직 연결되지 않아 모양만 보여주는 예시 곡선.
  // 실측 로그로 교체할 때 isDemo를 false로 바꾸고 points를 채우세요.
  learningCurve: {
    isDemo: true,
    points: undefined as { x: number; y: number }[] | undefined,
    gates: [18, 40, 63, 84] as number[], // 평가 하니스 통과(승격) 시점(예시)
  },
  // 승률: 초기 소표본 실측 (6판, 25턴 점수 판정)
  winRate: [
    { label: "vs 엔진 내장 Crazy 봇", win: 1, loss: 5, note: "25턴 점수 판정 · n=6 · 소표본" },
    { label: "vs 규칙 기반 계열 (기준선)", win: 0, loss: 0, note: "측정 예정" },
  ],
  // 레이팅: 게임 내 표시값 기준 "추정" (봇 간 대전 원값 − 900). 공식 레이팅 아님.
  // Solaris는 측정 전.
  rating: [
    { label: "엔진 내장 Easy", value: -400 },
    { label: "엔진 내장 Normal", value: -140 },
    { label: "엔진 내장 Hard", value: 30 },
    { label: "엔진 내장 Crazy", value: 290 },
    { label: "엔진 내장 Hyper", value: 470 },
    { label: "규칙 기반 초기형 (Lunaris)", value: 550 },
    { label: "Solaris (자기 대국 RL)", value: null as number | null },
  ],
};

/* ---------------------------------------------------------------------------
 * 팔레트 — 직접 정한 색 (Dark / Aqua / Light)
 * ------------------------------------------------------------------------- */
type ThemeName = "dark" | "aqua" | "light";

const CSS = `
.ait{--bg:#0e1020;--bg2:#141733;--panel:#181c3a;--line:#2a2f5a;--text:#e9ebf8;--mute:#9aa0c8;
  --a1:#ffb454;--a2:#8b7bff;--a3:#4fd1c5;--warn:#ff7a90;--ok:#6ee7a8;--shadow:0 10px 30px rgba(0,0,0,.35)}
.ait[data-theme=aqua]{--bg:#06222b;--bg2:#0a2f3a;--panel:#0d3744;--line:#1b5565;--text:#e6fbff;--mute:#8fc3cf;
  --a1:#ffc766;--a2:#7aa2ff;--a3:#5eead4;--warn:#ff8fa0;--ok:#7bf0b4}
.ait[data-theme=light]{--bg:#f6f5fc;--bg2:#ecebf8;--panel:#ffffff;--line:#d8d6ee;--text:#1b1d3a;--mute:#5d6290;
  --a1:#d9820b;--a2:#5b4be0;--a3:#0f9d92;--warn:#d6335a;--ok:#198a5a;--shadow:0 10px 30px rgba(60,55,120,.12)}
.ait{background:var(--bg);color:var(--text);font-family:"Pretendard","Noto Sans KR",system-ui,-apple-system,sans-serif;
  line-height:1.7;min-height:100vh;word-break:keep-all}
.ait *{box-sizing:border-box}
.ait .wrap{max-width:980px;margin:0 auto;padding:0 20px}
.ait .notice{background:linear-gradient(90deg,var(--a2),var(--a3));color:#0b0d20;text-align:center;
  font-weight:700;font-size:13.5px;padding:9px 14px;letter-spacing:.01em}
.ait[data-theme=light] .notice{color:#fff}
.ait header.top{display:flex;align-items:center;gap:14px;padding:22px 0 8px;flex-wrap:wrap}
.ait .brand{display:flex;align-items:center;gap:12px;flex:1;min-width:220px}
.ait .brand h1{font-size:28px;margin:0;letter-spacing:.02em;line-height:1.1}
.ait .brand small{display:block;color:var(--mute);font-size:12.5px;margin-top:3px;letter-spacing:.04em}
.ait nav{display:flex;gap:6px;flex-wrap:wrap;order:3;flex-basis:100%;padding-top:4px}
.ait .themeSeg{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px;background:var(--bg2)}
.ait .themeSeg button{border:0;background:transparent;color:var(--mute);font:inherit;font-size:12px;padding:4px 12px;border-radius:999px;cursor:pointer}
.ait .themeSeg button.on{background:var(--a2);color:#fff}
.ait nav a,.ait .back{color:var(--mute);text-decoration:none;font-size:13px;padding:6px 11px;
  border:1px solid var(--line);border-radius:999px;background:transparent;cursor:pointer;font-family:inherit}
.ait nav a:hover,.ait .back:hover{color:var(--text);border-color:var(--a2)}
.ait section{padding:34px 0 6px}
.ait h2{font-size:22px;margin:0 0 6px;display:flex;align-items:center;gap:10px}
.ait h2::before{content:"";width:8px;height:22px;border-radius:4px;background:linear-gradient(var(--a1),var(--a2))}
.ait .lead{color:var(--mute);margin:0 0 18px;font-size:15px}
.ait .hero{padding:26px 0 8px}
.ait .hero p.big{font-size:19px;max-width:720px;margin:10px 0 0}
.ait .hero em{font-style:normal;color:var(--a1)}
.ait .grid{display:grid;gap:14px}
.ait .g3{grid-template-columns:repeat(3,1fr)}
.ait .g2{grid-template-columns:repeat(2,1fr)}
@media(max-width:760px){.ait .g3,.ait .g2{grid-template-columns:1fr}.ait .brand h1{font-size:24px}}
.ait .card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:18px 18px 16px;box-shadow:var(--shadow)}
.ait .card h3{margin:0 0 6px;font-size:16px}
.ait .card p{margin:0;color:var(--mute);font-size:14.5px}
.ait .tag{display:inline-block;font-size:11.5px;padding:2px 9px;border-radius:999px;border:1px solid var(--line);
  color:var(--mute);margin-bottom:8px;letter-spacing:.04em}
.ait .tag.a{color:var(--a1);border-color:var(--a1)} .ait .tag.b{color:var(--a3);border-color:var(--a3)}
.ait .tl{position:relative;margin:6px 0 0;padding-left:26px}
.ait .tl::before{content:"";position:absolute;left:8px;top:6px;bottom:6px;width:2px;background:var(--line)}
.ait .tl .it{position:relative;margin:0 0 16px}
.ait .tl .it::before{content:"";position:absolute;left:-24px;top:7px;width:12px;height:12px;border-radius:50%;
  background:var(--bg);border:3px solid var(--a2)}
.ait .tl .it.now::before{border-color:var(--a1);background:var(--a1)}
.ait .tl h4{margin:0;font-size:15.5px} .ait .tl p{margin:2px 0 0;color:var(--mute);font-size:14.5px}
.ait figure{margin:0}
.ait figcaption{color:var(--mute);font-size:13px;margin-top:8px}
.ait svg{width:100%;height:auto;display:block}
.ait .chart-title{font-weight:700;font-size:15px;margin:0 0 2px}
.ait .chart-sub{color:var(--mute);font-size:12.5px;margin:0 0 10px}
.ait .badge-demo{display:inline-block;background:rgba(255,122,144,.14);color:var(--warn);border:1px dashed var(--warn);
  font-size:11.5px;padding:1px 8px;border-radius:6px;margin-left:8px;vertical-align:middle}
.ait .ph{border:2px dashed var(--line);border-radius:16px;padding:26px;text-align:center;color:var(--mute);
  background:repeating-linear-gradient(135deg,transparent 0 12px,rgba(139,123,255,.05) 12px 24px);user-select:none}
.ait .ph strong{display:block;color:var(--text);font-size:16px;margin-bottom:4px}
.ait .ph button{margin-top:12px;padding:8px 16px;border-radius:999px;border:1px solid var(--line);background:transparent;
  color:var(--mute);font-family:inherit;font-size:13px;cursor:not-allowed;opacity:.65}
.ait .vid{aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ait footer{margin:44px 0 0;border-top:1px solid var(--line);padding:22px 0 40px;color:var(--mute);font-size:13px}
.ait footer .notice-b{display:block;color:var(--text);font-weight:700;font-size:14px;margin-bottom:6px}
.ait ul.plain{margin:6px 0 0;padding-left:18px;color:var(--mute);font-size:14.5px}
.ait ul.plain li{margin:3px 0}
`;

/* ---------------------------------------------------------------------------
 * 로고 — 자기 대국 루프(고리)와 세 노드. 게임 로고와 무관한 직접 그린 마크
 * ------------------------------------------------------------------------- */
function Logo({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="AItopia 로고" style={{ width: size, height: size, flex: "none" }}>
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--a1)" />
          <stop offset="1" stopColor="var(--a2)" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="25" fill="none" stroke="url(#lg1)" strokeWidth="5" strokeLinecap="round" strokeDasharray="128 30" transform="rotate(-70 32 32)" />
      <path d="M52 20 L58 26 L49 28 Z" fill="var(--a1)" />
      <g stroke="var(--a3)" strokeWidth="2.4" strokeLinecap="round">
        <line x1="32" y1="19" x2="21" y2="40" />
        <line x1="32" y1="19" x2="43" y2="40" />
        <line x1="21" y1="40" x2="43" y2="40" />
      </g>
      <circle cx="32" cy="19" r="5" fill="var(--a1)" />
      <circle cx="21" cy="40" r="5" fill="var(--a2)" />
      <circle cx="43" cy="40" r="5" fill="var(--a3)" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * 도식 공통 부품
 * ------------------------------------------------------------------------- */
const FONT = '"Pretendard","Noto Sans KR",system-ui,sans-serif';

function Box(p: { x: number; y: number; w: number; h: number; t: string; s?: string; c?: string }) {
  const c = p.c ?? "var(--a2)";
  return (
    <g>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={12} fill="var(--panel)" stroke={c} strokeWidth={2} />
      <text x={p.x + p.w / 2} y={p.y + (p.s ? p.h / 2 - 3 : p.h / 2 + 5)} textAnchor="middle" fontSize={14.5} fontWeight={700} fill="var(--text)" fontFamily={FONT}>{p.t}</text>
      {p.s && <text x={p.x + p.w / 2} y={p.y + p.h / 2 + 15} textAnchor="middle" fontSize={11.5} fill="var(--mute)" fontFamily={FONT}>{p.s}</text>}
    </g>
  );
}
function Arrow(p: { d: string; c?: string; dash?: boolean; label?: string; lx?: number; ly?: number }) {
  return (
    <g>
      <path d={p.d} fill="none" stroke={p.c ?? "var(--mute)"} strokeWidth={2} strokeDasharray={p.dash ? "6 5" : undefined} markerEnd="url(#ar)" />
      {p.label && <text x={p.lx} y={p.ly} fontSize={11} fill="var(--mute)" textAnchor="middle" fontFamily={FONT}>{p.label}</text>}
    </g>
  );
}
function Defs() {
  return (
    <defs>
      <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="var(--mute)" />
      </marker>
    </defs>
  );
}

/* 도식 1 — 자기 대국 학습 루프 */
function LoopDiagram() {
  return (
    <svg viewBox="0 0 760 330" role="img" aria-label="자기 대국 학습 루프 도식">
      <Defs />
      <Box x={30} y={30} w={190} h={64} t="자기 대국 생성" s="현재 망 + 탐색 · 헤드리스" c="var(--a1)" />
      <Box x={285} y={30} w={190} h={64} t="경험 버퍼" s="상태 · 탐색 분포 · 결과" />
      <Box x={540} y={30} w={190} h={64} t="학습기" s="정책 손실 + 가치 손실" />
      <Box x={540} y={170} w={190} h={64} t="새 체크포인트" s="정책·가치 망 갱신" c="var(--a3)" />
      <Box x={285} y={170} w={190} h={64} t="평가 하니스" s="고정 상대·기준선과 대결" c="var(--a3)" />
      <Box x={30} y={170} w={190} h={64} t="승격 게이트" s="통과 시에만 생성기 교체" c="var(--a1)" />
      <Arrow d="M220 62 H285" />
      <Arrow d="M475 62 H540" />
      <Arrow d="M635 94 V170" />
      <Arrow d="M540 202 H475" />
      <Arrow d="M285 202 H220" />
      <Arrow d="M125 170 V94" c="var(--a1)" label="승격" lx={150} ly={138} />
      <Arrow d="M285 230 C 250 290, 120 290, 125 240" dash c="var(--warn)" label="미통과: 기존 유지" lx={205} ly={296} />
      <text x={380} y={140} textAnchor="middle" fontSize={11.5} fill="var(--mute)" fontFamily={FONT}>보조 보상은 경제 지표 차이 정도로 최소화</text>
    </svg>
  );
}

/* 도식 2 — 탐색 (정책 사전확률 + 가치 평가) */
function SearchDiagram() {
  const n = (x: number, y: number, r: number, c: string, f = false) => <circle cx={x} cy={y} r={r} fill={f ? c : "var(--panel)"} stroke={c} strokeWidth={2.2} />;
  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="탐색 도식">
      <Defs />
      <text x={20} y={26} fontSize={13} fontWeight={700} fill="var(--text)" fontFamily={FONT}>관측(안개 반영)</text>
      <rect x={20} y={36} width={150} height={52} rx={10} fill="var(--panel)" stroke="var(--line)" />
      <text x={95} y={67} textAnchor="middle" fontSize={12} fill="var(--mute)" fontFamily={FONT}>보이는 정보만 입력</text>
      <Arrow d="M170 62 H215" />
      <Box x={215} y={30} w={150} h={64} t="정책·가치 망" s="p(a|s), v(s)" c="var(--a2)" />
      <Arrow d="M365 62 H420" label="사전확률 p" lx={392} ly={52} />
      {/* tree */}
      <g stroke="var(--line)" strokeWidth={2}>
        <line x1="520" y1="60" x2="460" y2="140" /><line x1="520" y1="60" x2="520" y2="140" /><line x1="520" y1="60" x2="590" y2="140" />
        <line x1="460" y1="140" x2="430" y2="215" /><line x1="460" y1="140" x2="485" y2="215" />
        <line x1="590" y1="140" x2="570" y2="215" /><line x1="590" y1="140" x2="625" y2="215" />
      </g>
      {n(520, 60, 13, "var(--a1)", true)}
      {n(460, 140, 10, "var(--a2)")}{n(520, 140, 10, "var(--a2)")}{n(590, 140, 10, "var(--a2)")}
      {n(430, 215, 8, "var(--a3)", true)}{n(485, 215, 8, "var(--a3)", true)}{n(570, 215, 8, "var(--a3)", true)}{n(625, 215, 8, "var(--a3)", true)}
      <text x={655} y={219} fontSize={11.5} fill="var(--a3)" fontFamily={FONT}>잎: v(s)로 평가</text>
      <text x={612} y={64} fontSize={11.5} fill="var(--mute)" fontFamily={FONT}>루트: 현재 상태</text>
      <Arrow d="M520 245 V272 H300" dash c="var(--a1)" />
      <text x={300} y={266} fontSize={12} fill="var(--a1)" textAnchor="end" fontFamily={FONT}>방문 횟수 → 행동 선택 · 학습 타깃</text>
      <rect x={20} y={110} width={330} height={92} rx={12} fill="none" stroke="var(--line)" strokeDasharray="5 5" />
      <text x={34} y={134} fontSize={12.5} fontWeight={700} fill="var(--text)" fontFamily={FONT}>손으로 넣는 규칙은 최소화</text>
      <text x={34} y={156} fontSize={12} fill="var(--mute)" fontFamily={FONT}>합법 행동 마스크 외의 휴리스틱은 소수만 허용</text>
      <text x={34} y={176} fontSize={12} fill="var(--mute)" fontFamily={FONT}>우선순위·임계값 체계를 정책 경로에 넣지 않음</text>
    </svg>
  );
}

/* 도식 3 — 평가 하니스 */
function HarnessDiagram() {
  return (
    <svg viewBox="0 0 760 300" role="img" aria-label="평가 하니스 도식">
      <Defs />
      <Box x={20} y={30} w={170} h={60} t="체크포인트" s="평가 대상" c="var(--a1)" />
      <Box x={20} y={150} w={170} h={74} t="상대 풀" s="자기 과거본 · 기준선(평가 전용)" c="var(--a2)" />
      <Arrow d="M190 60 H255" />
      <Arrow d="M190 187 C 225 187, 225 110, 255 100" />
      <Box x={255} y={45} w={200} h={80} t="헤드리스 환경" s="고정 시드 · 좌석 교대 · 안개" c="var(--a3)" />
      <Arrow d="M455 85 H515" />
      <Box x={515} y={30} w={200} h={64} t="결과 집계" s="승률 · 점수 · 레이팅" />
      <Arrow d="M615 94 V150" />
      <Box x={515} y={150} w={200} h={74} t="게이트 판정" s="신뢰구간 하한 > 기준" c="var(--a1)" />
      <Arrow d="M515 187 H400" dash c="var(--ok)" label="통과 → 승격" lx={458} ly={177} />
      <text x={330} y={192} fontSize={12} fill="var(--ok)" textAnchor="middle" fontFamily={FONT}>다음 루프</text>
      <text x={20} y={262} fontSize={12} fill="var(--mute)" fontFamily={FONT}>※ 규칙 기반 계열 봇은 학습 상대 풀에 넣지 않고, 평가 기준선으로만 사용</text>
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * 차트 (직접 만든 SVG)
 * ------------------------------------------------------------------------- */
function demoCurve(): { x: number; y: number }[] {
  // 결정적(고정) 예시 곡선 — 실측 아님
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 100; i += 2) {
    const base = 1 - Math.exp(-i / 34);
    const wob = Math.sin(i * 1.3) * 0.025 + Math.sin(i * 0.37) * 0.02;
    pts.push({ x: i, y: Math.max(0, base * 0.85 + wob) });
  }
  return pts;
}

function LearningCurve() {
  const { isDemo, points, gates } = RESULTS.learningCurve;
  const data = useMemo(() => points ?? demoCurve(), [points]);
  const W = 720, H = 300, L = 54, R = 16, T = 18, B = 44;
  const xs = (x: number) => L + (x / 100) * (W - L - R);
  const ys = (y: number) => H - B - y * (H - T - B);
  const path = data.map((p, i) => `${i ? "L" : "M"}${xs(p.x).toFixed(1)} ${ys(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L${xs(100)} ${ys(0)} L${xs(0)} ${ys(0)} Z`;
  return (
    <figure>
      <p className="chart-title">학습 곡선{isDemo && <span className="badge-demo">예시 곡선 · 실측 아님</span>}</p>
      <p className="chart-sub">반복 횟수(정규화)별 고정 기준선 대비 평가 점수. 점은 승격 게이트 통과 시점.</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="학습 곡선 차트">
        <defs>
          <linearGradient id="lcA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--a2)" stopOpacity=".35" /><stop offset="1" stopColor="var(--a2)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={ys(g)} y2={ys(g)} stroke="var(--line)" strokeDasharray={g ? "3 5" : undefined} />
            <text x={L - 8} y={ys(g) + 4} fontSize={11} fill="var(--mute)" textAnchor="end" fontFamily={FONT}>{g.toFixed(2)}</text>
          </g>
        ))}
        {[0, 25, 50, 75, 100].map((t) => (
          <text key={t} x={xs(t)} y={H - B + 18} fontSize={11} fill="var(--mute)" textAnchor="middle" fontFamily={FONT}>{t}%</text>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} fontSize={11.5} fill="var(--mute)" textAnchor="middle" fontFamily={FONT}>학습 진행도</text>
        <text transform={`translate(14 ${(T + H - B) / 2}) rotate(-90)`} fontSize={11.5} fill="var(--mute)" textAnchor="middle" fontFamily={FONT}>평가 점수 (0~1)</text>
        <path d={area} fill="url(#lcA)" />
        <path d={path} fill="none" stroke="var(--a2)" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        {gates.map((g) => {
          const p = data.reduce((a, b) => (Math.abs(b.x - g) < Math.abs(a.x - g) ? b : a));
          return <circle key={g} cx={xs(p.x)} cy={ys(p.y)} r={5.5} fill="var(--a1)" stroke="var(--bg)" strokeWidth={2} />;
        })}
      </svg>
    </figure>
  );
}

function WinRateChart() {
  const rows = RESULTS.winRate;
  const W = 720, rowH = 74, H = rows.length * rowH + 20, L = 24, bw = W - L * 2;
  return (
    <figure>
      <p className="chart-title">승률</p>
      <p className="chart-sub">초기 소표본 결과입니다. 실력 주장이 아니라 측정 파이프라인 점검용 기록입니다.</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="승률 차트">
        {rows.map((r, i) => {
          const y = 10 + i * rowH, tot = r.win + r.loss;
          const ww = tot ? (r.win / tot) * bw : 0;
          return (
            <g key={r.label}>
              <text x={L} y={y + 14} fontSize={13.5} fontWeight={700} fill="var(--text)" fontFamily={FONT}>{r.label}</text>
              <text x={W - L} y={y + 14} fontSize={12} fill="var(--mute)" textAnchor="end" fontFamily={FONT}>{r.note}</text>
              {tot ? (
                <>
                  <rect x={L} y={y + 26} width={bw} height={26} rx={7} fill="var(--warn)" opacity={0.28} />
                  <rect x={L} y={y + 26} width={Math.max(ww, 0)} height={26} rx={7} fill="var(--ok)" />
                  <text x={L + 10} y={y + 44} fontSize={12.5} fontWeight={700} fill="#0b0d20" fontFamily={FONT}>{r.win}승</text>
                  <text x={W - L - 10} y={y + 44} fontSize={12.5} fontWeight={700} fill="var(--text)" textAnchor="end" fontFamily={FONT}>{r.loss}패</text>
                </>
              ) : (
                <rect x={L} y={y + 26} width={bw} height={26} rx={7} fill="none" stroke="var(--line)" strokeDasharray="6 5" />
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function RatingChart() {
  const rows = RESULTS.rating;
  const W = 720, rowH = 40, H = rows.length * rowH + 36, L = 200, R = 70, min = -700, max = 600;
  const xs = (v: number) => L + ((v - min) / (max - min)) * (W - L - R);
  const sg = (v: number) => (v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0");
  return (
    <figure>
      <p className="chart-title">레이팅 비교 <span className="badge-demo" style={{ color: "var(--a1)", borderColor: "var(--a1)", background: "transparent" }}>추정</span></p>
      <p className="chart-sub">게임 내 표시값 기준의 추정 레이팅입니다(봇 간 대전 값에서 환산한 잠정값). 공식 레이팅이 아니며, Solaris는 측정 전입니다.</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="레이팅 비교 차트 (추정)">
        {[-600, -400, -200, 0, 200, 400, 600].map((t) => (
          <g key={t}>
            <line x1={xs(t)} x2={xs(t)} y1={6} y2={H - 26} stroke={t === 0 ? "var(--mute)" : "var(--line)"} strokeDasharray={t ? "3 5" : undefined} />
            <text x={xs(t)} y={H - 8} fontSize={11} fill="var(--mute)" textAnchor="middle" fontFamily={FONT}>{sg(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = 10 + i * rowH;
          const sol = r.value === null;
          const lun = r.label.includes("Lunaris");
          return (
            <g key={r.label}>
              <text x={L - 12} y={y + 20} fontSize={12.5} textAnchor="end" fill={sol ? "var(--a1)" : "var(--text)"} fontWeight={sol ? 700 : 400} fontFamily={FONT}>{r.label}</text>
              {sol ? (
                <>
                  <rect x={xs(0)} y={y + 6} width={W - R - xs(0)} height={22} rx={6} fill="none" stroke="var(--a1)" strokeDasharray="6 5" />
                  <text x={xs(0) + 12} y={y + 22} fontSize={12} fill="var(--a1)" fontFamily={FONT}>측정 예정</text>
                </>
              ) : (
                <>
                  <rect x={Math.min(xs(0), xs(r.value as number))} y={y + 6} width={Math.abs(xs(r.value as number) - xs(0))} height={22} rx={6} fill={lun ? "var(--a3)" : "var(--a2)"} opacity={0.88} />
                  <text x={(r.value as number) >= 0 ? xs(r.value as number) + 7 : xs(r.value as number) - 7} y={y + 22} fontSize={12} textAnchor={(r.value as number) >= 0 ? "start" : "end"} fill="var(--mute)" fontFamily={FONT}>{sg(r.value as number)} 추정</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/* ---------------------------------------------------------------------------
 * 페이지
 * ------------------------------------------------------------------------- */
export default function AItopia({ theme, onBack }: { theme?: ThemeName; onBack?: () => void }) {
  const [local, setLocal] = useState<ThemeName>("dark");
  const t = theme ?? local;

  return (
    <div className="ait" data-theme={t}>
      <style>{CSS}</style>

      <div className="notice" role="note">{NOTICE}</div>

      <div className="wrap">
        <header className="top">
          <div className="brand">
            <Logo />
            <div>
              <h1><span style={{ color: "var(--a1)" }}>AI</span>topia</h1>
              <small>SELF-PLAY RESEARCH NOTES · 비영리 학술 연구</small>
            </div>
          </div>
          <nav aria-label="페이지 내 이동">
            <a href="#overview">개요</a>
            <a href="#structure">구조</a>
            <a href="#results">결과</a>
            {CONFIG.showCode && <a href="#code">코드</a>}
            {CONFIG.showVideo && <a href="#video">영상</a>}
            {onBack && <button className="back" onClick={onBack}>← 포트폴리오</button>}
          </nav>
          {!theme && (
            <div className="themeSeg" role="radiogroup" aria-label="테마 선택">
              {(["dark", "aqua", "light"] as ThemeName[]).map((n) => (
                <button key={n} role="radio" aria-checked={n === t} className={n === t ? "on" : ""} onClick={() => setLocal(n)}>
                  {n === "dark" ? "Dark" : n === "aqua" ? "Aqua" : "Light"}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="hero">
          <p className="big">
            턴제 전략 게임을 대상으로, <em>손으로 짠 규칙</em>의 한계를 넘어 <em>자기 대국 강화학습</em>으로
            스스로 강해지는 에이전트를 만드는 비공식 팬 연구 프로젝트입니다.
          </p>
        </div>

        {/* ───────────── 개요 ───────────── */}
        <section id="overview">
          <h2>프로젝트 개요</h2>
          <p className="lead">목표와 접근 방식, 그리고 방식을 바꾼 이유를 정리했습니다.</p>

          <div className="grid g3">
            <div className="card">
              <span className="tag a">목표</span>
              <h3>실전에서 쓸 수 있는 강한 에이전트</h3>
              <p>사람과 같은 규칙·같은 정보(안개 포함) 아래에서 둘 수 있고, 고점이 높은 에이전트를 만드는 것.</p>
            </div>
            <div className="card">
              <span className="tag b">원칙</span>
              <h3>규칙은 줄이고 학습은 늘리기</h3>
              <p>합법 행동 마스크 같은 최소한의 틀만 두고, 판단은 정책·가치 망과 탐색이 맡도록 설계.</p>
            </div>
            <div className="card">
              <span className="tag">성격</span>
              <h3>비영리 · 학술 · 비공식</h3>
              <p>게임사와 무관한 개인 연구이며, 게임 자산과 실행 가능한 산출물은 이 페이지에 싣지 않습니다.</p>
            </div>
          </div>

          <h3 style={{ margin: "26px 0 8px", fontSize: 17 }}>접근 방식의 전환</h3>
          <div className="tl">
            <div className="it">
              <h4>1단계 · 규칙 기반 + 탐색</h4>
              <p>평가 함수와 우선순위 규칙을 직접 짜고 탐색을 얹은 계열. 단계적으로 개선하며 실전 투입을 목표로 함.</p>
            </div>
            <div className="it">
              <h4>2단계 · 한계 확인</h4>
              <p>규칙을 추가할수록 상호작용을 점검하는 비용이 커지고, 작은 개선만 누적되는 정체를 확인. 측정 소음을 줄이는 방법도 정비.</p>
            </div>
            <div className="it">
              <h4>3단계 · 자기 대국 강화학습으로 전환</h4>
              <p>정책·가치 망 + 탐색 구조로 재설계. 기존 규칙 체계는 학습 경로에 넣지 않고, 평가 기준선으로만 사용해 오염을 차단.</p>
            </div>
            <div className="it now">
              <h4>현재 · 인프라 구축과 학습 루프 가동</h4>
              <p>헤드리스 환경, 합법 행동 마스크, 안개 관측, 평가 하니스를 만들고 게이트를 통과한 뒤 CPU 위주의 소형 망부터 장시간 학습.</p>
            </div>
          </div>
        </section>

        {/* ───────────── 구조 ───────────── */}
        <section id="structure">
          <h2>구조 다이어그램</h2>
          <p className="lead">직접 그린 도식입니다. 게임 화면이나 아이콘은 사용하지 않았습니다.</p>

          <div className="card" style={{ marginBottom: 14 }}>
            <figure>
              <p className="chart-title">① 학습 루프</p>
              <LoopDiagram />
              <figcaption>생성 → 버퍼 → 학습 → 체크포인트 → 평가 → 승격 게이트의 순환. 게이트를 못 넘으면 기존 생성기를 유지합니다.</figcaption>
            </figure>
          </div>
          <div className="grid">
            <div className="card">
              <figure>
                <p className="chart-title">② 탐색</p>
                <SearchDiagram />
                <figcaption>망의 사전확률로 가지를 고르고, 잎은 가치 추정으로 평가합니다.</figcaption>
              </figure>
            </div>
            <div className="card">
              <figure>
                <p className="chart-title">③ 평가 하니스</p>
                <HarnessDiagram />
                <figcaption>고정 시드와 좌석 교대로 소음을 줄이고, 통과 여부를 게이트로 판정합니다.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        {/* ───────────── 결과 ───────────── */}
        <section id="results">
          <h2>결과</h2>
          <p className="lead">진행 중인 연구라서 수치는 잠정값입니다. 실측이 없는 항목은 비워 두거나 ‘예시’로 표시했습니다.</p>
          <div className="card" style={{ marginBottom: 14 }}><LearningCurve /></div>
          <div className="grid g2">
            <div className="card"><WinRateChart /></div>
            <div className="card"><RatingChart /></div>
          </div>
        </section>

        {/* ───────────── 코드 (자리표시) ───────────── */}
        {CONFIG.showCode && (
          <section id="code">
            <h2>코드</h2>
            <div className="ph" aria-disabled="true">
              <strong>허가 확인 후 공개 예정</strong>
              게임사 허가 여부를 확인하기 전까지 코드는 공개하지 않습니다.
              <ul className="plain" style={{ listStyle: "none", padding: 0, margin: "14px auto 0", maxWidth: 440, textAlign: "left" }}>
                {PLANNED_RELEASES.map((r) => (
                  <li key={r.name} style={{ display: "flex", gap: 10, alignItems: "baseline", margin: "6px 0" }}>
                    <span className="tag" style={{ margin: 0, flex: "none" }}>허가 후</span>
                    <span><b style={{ color: "var(--text)" }}>{r.name}</b> — {r.desc}</span>
                  </li>
                ))}
              </ul>
              <div><button type="button" disabled aria-disabled="true">공개 전</button></div>
            </div>
          </section>
        )}

        {/* ───────────── 영상 (자리표시) ───────────── */}
        {CONFIG.showVideo && (
          <section id="video">
            <h2>게임 영상</h2>
            <div className="ph vid" aria-disabled="true">
              <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true" style={{ width: 54, opacity: 0.5, marginBottom: 8 }}>
                <circle cx="27" cy="27" r="24" fill="none" stroke="var(--mute)" strokeWidth="2.5" strokeDasharray="5 5" />
                <path d="M22 18 L38 27 L22 36 Z" fill="var(--mute)" />
              </svg>
              <strong>허가 확인 후 공개 예정</strong>
              영상은 비활성 상태입니다.
            </div>
          </section>
        )}

        <footer>
          <span className="notice-b">{NOTICE}</span>
          이 페이지의 도식·차트·로고·색 구성은 모두 직접 제작했으며, 게임 아트·스크린샷·게임 수치 데이터·실행 가능한 코드나 데모는 포함하지 않습니다.
        </footer>
      </div>
    </div>
  );
}

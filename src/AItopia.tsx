import React, { useState } from "react";

/* ============================================================================
 * AItopia — 포트폴리오 하위 페이지
 * Polytopia 대상 비공식 팬 연구 프로젝트 (비영리·학술 목적)
 *
 * 이 파일의 모든 도식·차트·로고·색은 직접 그린 것입니다.
 * 게임 아트/스크린샷/수치표/규칙 엔진/실행 가능한 데모는 포함하지 않습니다.
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * 설정 플래그 — 섹션을 켜고 끄는 곳
 *   true  : 섹션을 보여줌 (showCode = 데모 섹션, showVideo = 영상 자리표시)
 *   false : 섹션 자체를 숨김
 *   영상은 허가·준비가 끝나면 이 파일에서 직접 연결하세요.
 * ------------------------------------------------------------------------- */
export const CONFIG = {
  showCode: true,
  showVideo: true,
};

/* 데모 파일은 레포의 play/ 폴더에 있습니다 */
const DEMOS = [
  { name: "봇 대 봇 관전", desc: "봇끼리 대국하는 모습을 지켜보는 관전 모드. 봇 수·부족·난이도·맵을 정할 수 있습니다.", ko: "play/spectator_ko.html", en: "play/spectator_en.html" },
  { name: "실전 분석 (다음 수 계산기)", desc: "실제 대국의 판을 옮겨 넣으면 봇이 이번 턴의 최선의 수를 계산합니다.", ko: "play/analysis_ko.html", en: "play/analysis_en.html" },
];

export const NOTICE_EN = "NOT AN OFFICIAL Polytopia PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MIDJIWAN.";
export const NOTICE = `${NOTICE_EN} · 폴리토피아(Polytopia)를 대상으로 한 비영리 개인 연구 프로젝트이며, 게임사 Midjiwan과 무관합니다.`;

/* ---------------------------------------------------------------------------
 * 결과 데이터 — 실측값만 넣고, 실측이 없는 곳은 비워 두거나 '예시'로 표시
 * ------------------------------------------------------------------------- */
const RESULTS = {
  // 기준 모델 V1 (파라미터 32,322). 점수 = 승 1 / 무 0.5 / 패 0, 같은 시드에서 자리를 바꾼 쌍으로 평가, greedy.
  // 30쌍 기준 오차 약 ±7~11%p. 출처: Solaris 1차 결과 보고(2026-11-07)
  score: [
    { label: "vs 엔진 내장 hard · 12x12 · 80턴 · 30쌍", score: 66.7, ci: 10.6, w: 29, d: 22, l: 9 },
    { label: "vs 엔진 내장 hard · 80턴 · 60쌍", score: 58.8, ci: null as number | null, w: 43, d: 55, l: 22 },
    { label: "vs 엔진 내장 max · 80턴", score: 58.3, ci: 11.3, w: 21, d: 28, l: 11 },
    { label: "vs 외부 비교 봇 terranion@1 · 80턴", score: 15.8, ci: 6.8, w: 4, d: 11, l: 45 },
    { label: "vs 외부 비교 봇 terranion@3 · 80턴", score: 10.8, ci: 6.1, w: 1, d: 11, l: 48 },
    { label: "vs 외부 비교 봇 terranion@10 · 80턴", score: 17.5, ci: 5.8, w: 1, d: 19, l: 40 },
  ],
};


/* 시험한 것과 결과 (출처: Solaris 1차 결과 보고 및 이후 진단). 합격 기준은 결과를 보기 전에 정한 것 */
const EXPERIMENTS = [
  { k: "학습률 · 크기", what: "lr 5e-5~2e-4, 확장망(87,682 파라미터)", res: "hard 기준선과 동등(57~62%). 150~600회차 이후 하락이 재현됨" },
  { k: "장시간 · 턴", what: "80턴 학습, 8x8 학습 후 12x12 이전", res: "53.3%→32.5%로 하락 / 8x8의 이득은 12x12 60쌍에서 사라짐(58.3 대 58.8)" },
  { k: "연구·별 가중치", what: "연구 가중치 3·15·40, 직접 연구 보상 +0.2", res: "greedy 연구 확률 0 유지 / 가중치를 키우면 확장이 나빠짐 / 직접 보상은 기술이 10.5→7.5로 하락" },
  { k: "시간 보상", what: "시간초과 보상, 샤프닝, win-time", res: "terranion@10 27.5~35%, 0~1승" },
  { k: "리그 · 풀", what: "성향 상대(연구 중심/무시), 과거 체크포인트 풀 0.3", res: "학습 중 hard 33→48%로 상승했으나 terranion@10 27.5~32.5%, 0승" },
  { k: "플레이 시점 탐색", what: "snet(턴 단위 후보 계획 선택)", res: "hard 2쌍 62.5%(표본 부족). terranion 평가 기록 없음" },
  { k: "RL 변형", what: "τ=0.5/0.3 + 분리 critic", res: "greedy 점수 변화 없음(66.7 / 65.0 / 65.0 / 64.2)" },
  { k: "전문가 반복 증류", what: "200판 생성, 776개 계획", res: "holdout CE 2.5961→2.6008, 60.0%(기준 66%) 불합격" },
  { k: "혼합 상대 학습", what: "200회차 약 2,400판", res: "20턴 기술 4.92(V1과 동일), 불합격. greedy self 대국은 짧은 턴에서 무승부가 많음" },
  { k: "타입 헤드", what: "행동 종류 점수 추가(영초기화)", res: "20턴 기술 4.92→6.7(기준 8 이상), 도시 1.83(V1 2.08)로 불합격. 학습 불안정" },
  { k: "PPO", what: "A2C를 PPO로 교체(클립 0.2, 에폭 4, KL 중단), V1에서 시작", res: "100회차 20턴 기술 3.83(V1 4.92), 도시 1.67, 수입 5.83 → 전 항목 V1보다 낮음, 불합격" },
  { k: "연구 강제 (진단)", what: "기술 12개 미만이면 합법 연구 중 무작위 선택 (평가 전용, 배포·학습 금지)", res: "20턴 기술 11.4 달성, 패배 아님 20%(기준선 35%), 수입 9.2, 유닛 5.7 → 불합격, 오히려 해로움" },
  { k: "별 소비 강제 (진단)", what: "별 6 이상이면 합법 연구·훈련·건설 중 무작위 (평가 전용, 배포·학습 금지)", res: "별 비축은 해소(20턴 11.5), 그러나 패배 아님 7%(기준 50%), 수입 10.4, 유닛 4.7 → 불합격, 더 해로움" },
  { k: "가치 헤드 점검", what: "V1 대 hard/자기 대국 600판으로 가치망 학습", res: "판별력 AUC 0~8턴 0.58~0.61(기준 0.65 미달), 연구 직후 가치 상승 40.8%(기준 70%) → 불합격, 탐색 학습 종료" },
];

/* ---------------------------------------------------------------------------
 * 팔레트 — 직접 정한 색 (Dark / Aqua / Light)
 * ------------------------------------------------------------------------- */
type ThemeName = "dark" | "aqua" | "light";

const CSS = `
.ait{--bg:#0d0f12;--bg2:#111827;--panel:rgba(15,23,42,.6);--line:#1e293b;--text:#f1f5f9;--mute:#94a3b8;
  --a1:#38bdf8;--a2:#0ea5e9;--a3:#2dd4bf;--warn:#fb7185;--ok:#4ade80;--shadow:none}
.ait[data-theme=aqua]{--bg:#011627;--bg2:#03304a;--panel:rgba(6,41,62,.9);--line:rgba(34,211,238,.25);--text:#e6fbff;--mute:#8fc3cf;
  --a1:#67e8f9;--a2:#22d3ee;--a3:#5eead4;--warn:#fb7185;--ok:#86efac;--shadow:0 10px 25px -8px rgba(8,51,68,.55)}
.ait[data-theme=aqua]{background-image:linear-gradient(180deg,#011627 0%,#03304a 55%,#04485e 100%)}
.ait[data-theme=light]{--bg:#f8fafc;--bg2:#f1f5f9;--panel:#ffffff;--line:#e2e8f0;--text:#0f172a;--mute:#475569;
  --a1:#0369a1;--a2:#0284c7;--a3:#0f766e;--warn:#e11d48;--ok:#15803d;--shadow:0 1px 2px rgba(15,23,42,.06)}
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
.ait table.exp{width:100%;border-collapse:collapse;font-size:13.5px}
.ait table.exp th,.ait table.exp td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.ait table.exp th{color:var(--mute);font-weight:600;font-size:12px;letter-spacing:.04em}
.ait .tbl{overflow-x:auto}
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
      <Box x={30} y={30} w={190} h={64} t="자기 대국 생성" s="현재 망(정책 샘플링) · 헤드리스" c="var(--a1)" />
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
function ScoreChart() {
  const rows = RESULTS.score;
  const W = 720, rowH = 64, H = rows.length * rowH + 40, L = 24, bw = W - L * 2;
  const x = (p: number) => L + (p / 100) * bw;
  return (
    <figure>
      <p className="chart-title">상대별 점수 <span className="badge-demo" style={{ color: "var(--a1)", borderColor: "var(--a1)", background: "transparent" }}>실측</span></p>
      <p className="chart-sub">V1(32,322 파라미터) 기준. 점수 = 승 1 · 무 0.5 · 패 0, 같은 시드에서 자리를 바꾼 쌍으로 평가했고 greedy입니다. 점선은 50%입니다. 오차는 약 ±6~11%p라서 작은 차이는 구분할 수 없습니다.</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="상대별 점수 차트">
        <line x1={x(50)} x2={x(50)} y1={4} y2={H - 28} stroke="var(--mute)" strokeDasharray="4 5" />
        {[0, 25, 50, 75, 100].map((tk) => (
          <text key={tk} x={x(tk)} y={H - 10} fontSize={11} fill="var(--mute)" textAnchor="middle" fontFamily={FONT}>{tk}%</text>
        ))}
        {rows.map((r, i) => {
          const y = 8 + i * rowH, ext = r.label.includes("terranion");
          return (
            <g key={r.label}>
              <text x={L} y={y + 14} fontSize={12.5} fontWeight={700} fill="var(--text)" fontFamily={FONT}>{r.label}</text>
              <text x={W - L} y={y + 14} fontSize={12} fill="var(--mute)" textAnchor="end" fontFamily={FONT}>{r.w}승 {r.d}무 {r.l}패</text>
              <rect x={L} y={y + 24} width={bw} height={22} rx={6} fill="var(--line)" opacity={0.5} />
              <rect x={L} y={y + 24} width={Math.max(x(r.score) - L, 2)} height={22} rx={6} fill={ext ? "var(--warn)" : "var(--a2)"} opacity={0.9} />
              <text x={x(r.score) + 8} y={y + 40} fontSize={12.5} fontWeight={700} fill="var(--text)" fontFamily={FONT}>{r.score.toFixed(1)}%{r.ci ? ` ±${r.ci}` : ""}</text>
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
            {CONFIG.showCode && <a href="#code">데모</a>}
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
            스스로 강해지는 에이전트를 만들어 보고, 그 결과를 있는 그대로 기록한 비공식 팬 연구 프로젝트입니다.
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
              <h4>현재 · 1차 정리 완료, 새 대안 탐색 중</h4>
              <p>헤드리스 환경, 합법 행동 마스크, 안개 관측, 평가 하니스를 만들었습니다. 사전 기준을 세운 시험(탐색 학습, PPO, 연구·별·유닛 강제, 규모 확대 등)은 모두 기준 미달로 접었습니다. 지금은 이 구조를 대체할 새 가설을 찾는 중이며, 실험은 사전 기준과 함께 정한 뒤에만 돌립니다.</p>
            </div>
          </div>
        </section>

        {/* ───────────── 구조 ───────────── */}
        <section id="structure">
          <h2>구조 다이어그램</h2>
          <p className="lead">직접 그린 도식입니다. 게임 화면이나 아이콘은 사용하지 않았습니다. 탐색(②)은 설계안이며, 가치 헤드 점검에서 기준 미달이라 학습에는 쓰지 못했습니다.</p>

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
                <p className="chart-title">② 탐색 (설계안 · 시험 후 종료)</p>
                <SearchDiagram />
                <figcaption>설계한 구조입니다. 망의 사전확률로 가지를 고르고 잎은 가치 추정으로 평가하는 방식이며, 가치망 판별력이 기준에 못 미쳐 접었습니다.</figcaption>
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
          <p className="lead">기준 모델 V1의 평가와, 개선하려고 시험한 것들의 결과를 있는 그대로 적었습니다. 사전에 정한 합격 기준을 넘지 못한 시험도 모두 포함합니다.</p>

          <div className="card" style={{ marginBottom: 14 }}><ScoreChart /></div>
          <div className="card" style={{ marginBottom: 14 }}>
            <p>엔진 내장 봇(hard·max)은 약 59~67%로 이기지만, 외부 비교 봇 terranion에는 40판 중 1~4승, 점수 11~18%로 크게 집니다. 같은 모델의 40턴 평가는 61.7%(15승 44무 1패)인데 80턴에서는 51.7%(18승 26무 16패)로 내려갑니다. 12x12 2인전에서는 봇 둘 다 끝내러 가지 않아 40턴 평가의 무승부가 60~70%이므로, 앞으로는 80턴을 기준으로 보고합니다.</p>
          </div>

          <h3 style={{ margin: "26px 0 8px", fontSize: 17 }}>왜 지는가 (진단)</h3>
          <div className="grid g2">
            <div className="card">
              <span className="tag a">관찰</span>
              <h3>기술이 5개에서 멈춤</h3>
              <p>38턴 vs hard에서 기술 5.1 대 22.0, 도시 3.8 대 2.2, 수입은 비슷(16.5 대 16.3). 12턴부터 연구 가능한 행동이 매 턴 10개 이상 열려 있고 별이 쌓여도 연구를 고르지 않습니다.</p>
            </div>
            <div className="card">
              <span className="tag b">확인</span>
              <h3>표현은 가능함</h3>
              <p>연구 행동 하나에 양의 이득을 주고 학습하면 확률이 0.33→0.997로 오릅니다. 망과 역전파는 연구를 표현하고 학습할 수 있는데, 지금까지의 학습·보상 설계가 그 선택을 끌어내지 못했습니다.</p>
            </div>
          </div>
          <p className="lead" style={{ marginTop: 12 }}>연구 정체는 greedy에서만 나타나고, 샘플링으로 두면 40턴까지 기술 12~21개를 연구합니다. 다만 샘플링 평가는 terranion@10에서 20.0%(0승)로 greedy보다 낮아 평가 방식 변경은 폐기했습니다.</p>

          <h3 style={{ margin: "26px 0 8px", fontSize: 17 }}>시험한 것과 결과</h3>
          <div className="card">
            <p className="chart-sub">합격 기준은 결과를 보기 전에 정했고, 불합격이면 접었습니다. 결과를 본 뒤 기준을 바꿔 다시 시도하지 않았습니다.</p>
            <div className="tbl">
              <table className="exp">
                <thead><tr><th>구분</th><th>내용</th><th>결과</th></tr></thead>
                <tbody>{EXPERIMENTS.map((r) => (<tr key={r.k}><td><b style={{ color: "var(--text)" }}>{r.k}</b></td><td>{r.what}</td><td>{r.res}</td></tr>))}</tbody>
              </table>
            </div>
          </div>

          <h3 style={{ margin: "26px 0 8px", fontSize: 17 }}>속도 개선</h3>
          <div className="card">
            <span className="tag b">병목</span>
            <h3>합성곱(conv)이 자체 대국 시간의 약 81%</h3>
            <p>희소 scatter conv로 바꿔 순전파를 약 7배, 역전파를 약 5.5~6배 빠르게 했습니다. 출력은 비트 단위로 같습니다.</p>
          </div>

          <h3 style={{ margin: "26px 0 8px", fontSize: 17 }}>알게 된 것과 한계</h3>
          <div className="grid g2">
            <div className="card">
              <span className="tag a">알게 된 것</span>
              <ul className="plain">
                <li>학습 중 지표(hard 점수, 경제 격차)가 올라도 강한 봇이나 사람 상대 실력으로 이어지지 않았습니다.</li>
                <li>greedy self 대국은 짧은 턴에서 무승부가 많아 학습 신호가 약합니다. 샘플링 self 대국은 승패가 납니다.</li>
                <li>연구·별 소비를 거칠게 강제하면 유닛이 줄고 패배가 늘었습니다. 패배와 함께 움직인 지표는 유닛 수였으나, 양성 표본이 작아 인과는 확인하지 못했습니다.</li>
                <li>오래 학습할수록 나빠지는 현상이 여러 설정에서 재현됩니다.</li>
                <li>평가 노이즈가 큽니다(30쌍 ±10%p).</li>
              </ul>
            </div>
            <div className="card">
              <span className="tag">한계</span>
              <ul className="plain">
                <li>terranion에는 사실상 이기지 못했고, 사람(22x22 4인전)에게도 2판 모두 졌습니다(참고용).</li>
                <li>규칙을 넣지 않는 방침은 지켰지만 결과는 비교 봇 아래입니다.</li>
                <li>표본이 작아 단정할 수 없는 항목이 많고, 일부 진단은 4판 규모입니다.</li>
                <li>누적 학습은 수만 판 규모이며 대량 학습이나 더 큰 구조는 시험하지 못했습니다.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ───────────── 데모 ───────────── */}
        {CONFIG.showCode && (
          <section id="code">
            <h2>데모</h2>
            <p style={{ color: "var(--mute)", margin: "0 0 14px" }}>
              브라우저에서 바로 실행되는 두 가지 도구입니다. 사람이 직접 플레이하는 모드(싱글·Pass &amp; Play)는 포함하지 않으며 공개 계획도 없습니다.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {DEMOS.map((d) => (
                <div key={d.name} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
                  <b style={{ color: "var(--text)" }}>{d.name}</b>
                  <div style={{ color: "var(--mute)", margin: "4px 0 10px" }}>{d.desc}</div>
                  <a href={d.ko} style={{ marginRight: 14 }}>한국어</a>
                  <a href={d.en}>English</a>
                </div>
              ))}
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
          이 페이지의 도식·차트·로고·색 구성은 모두 직접 제작했으며, 게임 아트·스크린샷은 포함하지 않습니다. 데모는 사람이 직접 플레이할 수 없는 관전·분석 도구입니다.
        </footer>
      </div>
    </div>
  );
}

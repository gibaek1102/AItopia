# AItopia — 연구 소개 페이지

> NOT AN OFFICIAL Polytopia PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MIDJIWAN.
> 폴리토피아(Polytopia)를 대상으로 한 비영리 개인 연구 프로젝트이며, 게임사 Midjiwan과 무관합니다.

자기 대국 강화학습 연구의 개요·구조 도식·결과 차트를 소개하는 정적 페이지입니다.
게임 아트, 게임 데이터, 규칙 엔진, 가중치, 실행 가능한 데모는 이 저장소에 포함하지 않습니다.

## 구조
```
index.html            ← 배포되는 결과물 (빌드로 생성, 직접 수정 금지)
src/AItopia.tsx       ← 페이지 본체 (설정 플래그·결과 데이터·도식·차트)
src/main.tsx          ← 진입점
scripts/build.mjs     ← 번들 → index.html 생성
scripts/template.html ← HTML 틀 (제목·설명·아이콘)
```

## 수정 방법
1. `src/AItopia.tsx` 맨 위에서 수정
   - `CONFIG.showCode` / `CONFIG.showVideo`: 코드·영상 섹션 켜기/끄기
   - `PLANNED_RELEASES`: 코드 섹션의 공개 예정 항목
   - `RESULTS.score`: 상대별 점수(승·무·패, 오차)
   - `EXPERIMENTS`: 시험한 것과 결과 표(합격 기준은 결과를 보기 전에 정한 것)
2. `npm install` (최초 1회) → `npm run build`
3. `index.html` 커밋·푸시

## 배포
GitHub Pages: Settings → Pages → Branch `main` / `(root)`

## 데모 (play/)

`play/` 폴더에 관전·실전 분석 데모(한/영)가 있고, Pages 워크플로가 `index.html`과 함께 배포합니다. 사람이 직접 플레이하는 모드(싱글·Pass & Play)는 포함하지 않습니다.

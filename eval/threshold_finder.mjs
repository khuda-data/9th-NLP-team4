// threshold_finder.mjs — D트랙 평가 도구
// "엔진 점수 + 사람 yes/no 라벨"을 받아서, 어디서 컷(threshold)을 끊는 게 가장 좋은지 자동으로 찾아준다.
//
// 사용법:
//   node eval/threshold_finder.mjs eval/labels.example.json
//   node eval/threshold_finder.mjs eval/labels.json
//
// 입력 JSON 형식 (배열):
//   [
//     { "trend_id": "t1", "repo_id": "r1", "engine_score": 95, "human_label": 1 },
//     { "trend_id": "t2", "repo_id": "r1", "engine_score": 70, "human_label": 0 },
//     ...
//   ]
//   - engine_score: 우리 엔진이 매긴 관련도 (0~100)
//   - human_label : 사람이 매긴 정답. 1 = 보여줄 만함(yes), 0 = 노이즈(no)
//
// 피드 제품이라 "노이즈가 끼는 것"을 "몇 개 놓치는 것"보다 더 싫어한다고 보고,
// 정밀도(precision) 목표를 우선으로 추천한다. 목표치는 아래 PRECISION_TARGET에서 조절.

import fs from "node:fs";

const PRECISION_TARGET = 0.9; // 피드 상단 신뢰를 위해 "보여준 것 중 90%는 진짜 관련 있어야 한다"

// ---- 1. 데이터 읽기 ----
const file = process.argv[2];
if (!file) {
  console.error("사용법: node eval/threshold_finder.mjs <labels.json>");
  process.exit(1);
}
let rows;
try {
  rows = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (e) {
  console.error(`파일을 읽을 수 없습니다: ${file}\n${e.message}`);
  process.exit(1);
}

// 라벨이 비어있거나 점수 없는 행 거르기
const clean = rows.filter(
  (r) => typeof r.engine_score === "number" && (r.human_label === 0 || r.human_label === 1)
);
const dropped = rows.length - clean.length;

if (clean.length === 0) {
  console.error("쓸 수 있는 데이터가 없습니다. engine_score(숫자)와 human_label(0/1)을 채우세요.");
  process.exit(1);
}

const totalYes = clean.filter((r) => r.human_label === 1).length;
const totalNo = clean.length - totalYes;

// ---- 2. 각 컷(threshold)마다 성적 계산 ----
// 의미 있는 컷 후보 = 데이터에 등장한 점수들 (그 값 이상이면 "보여줌")
const candidates = [...new Set(clean.map((r) => r.engine_score))].sort((a, b) => b - a);

function evaluate(threshold) {
  const shown = clean.filter((r) => r.engine_score >= threshold);
  const shownYes = shown.filter((r) => r.human_label === 1).length; // 보여줬는데 진짜 관련(정답)
  const noiseLeaked = shown.length - shownYes; // 보여줬는데 노이즈(틀림)
  const yesMissed = totalYes - shownYes; // 관련 있는데 안 보여줌(놓침)

  const precision = shown.length ? shownYes / shown.length : 1; // 보여준 것 중 정답 비율
  const recall = totalYes ? shownYes / totalYes : 1; // 관련 있는 것 중 잡아낸 비율
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  return { threshold, shownCount: shown.length, shownYes, noiseLeaked, yesMissed, precision, recall, f1 };
}

const results = candidates.map(evaluate);

// ---- 3. 추천 컷 고르기 ----
// (A) F1 최고: 정밀도와 재현율 균형이 가장 좋은 지점
const bestF1 = results.reduce((a, b) => (b.f1 > a.f1 ? b : a));

// (B) 피드 추천: precision >= 목표치를 만족하면서 가장 많이 잡아내는(=recall 최대) 컷
const meetTarget = results.filter((r) => r.precision >= PRECISION_TARGET);
const feedPick = meetTarget.length
  ? meetTarget.reduce((a, b) => (b.recall > a.recall ? b : a))
  : results.reduce((a, b) => (b.precision > a.precision ? b : a)); // 아무도 목표 못 채우면 그냥 정밀도 최고

// ---- 4. 출력 ----
const pct = (x) => (x * 100).toFixed(0) + "%";
const pad = (s, n) => String(s).padStart(n);

console.log(`\n=== Threshold Finder ===`);
console.log(`데이터: ${clean.length}쌍 (관련 yes=${totalYes}, 노이즈 no=${totalNo})${dropped ? `  / 미완성 ${dropped}행 제외` : ""}\n`);

console.log(`컷  | 보여줌 | 정답 | 노이즈 | 놓침 | 정밀도 | 재현율 |  F1`);
console.log(`----+--------+------+--------+------+--------+--------+------`);
for (const r of results) {
  const mark = r.threshold === feedPick.threshold ? " ★추천" : r.threshold === bestF1.threshold ? " (F1최고)" : "";
  console.log(
    `${pad(r.threshold, 3)} | ${pad(r.shownCount, 6)} | ${pad(r.shownYes, 4)} | ${pad(r.noiseLeaked, 6)} | ${pad(r.yesMissed, 4)} | ${pad(pct(r.precision), 6)} | ${pad(pct(r.recall), 6)} | ${r.f1.toFixed(2)}${mark}`
  );
}

console.log(`\n--- 해석 ---`);
console.log(`• 정밀도 = 보여준 것 중 진짜 관련 있는 비율 (높을수록 피드가 깔끔)`);
console.log(`• 재현율 = 관련 있는 것 중 놓치지 않은 비율 (높을수록 덜 놓침)`);
console.log(`• 노이즈 = 보여줬는데 사람이 'no'라 한 것(=피드에 낀 쓰레기)`);
console.log(`• 놓침   = 사람이 'yes'인데 컷에 걸려 안 보여준 것\n`);

console.log(`★ 피드 추천 컷 = ${feedPick.threshold}점`);
console.log(`   → 이 컷이면: 보여주는 것 중 ${pct(feedPick.precision)}가 진짜 관련(노이즈 ${feedPick.noiseLeaked}개), 관련 있는 것의 ${pct(feedPick.recall)}를 잡아냄(놓침 ${feedPick.yesMissed}개).`);
console.log(`   (기준: 정밀도 ${pct(PRECISION_TARGET)} 이상을 지키면서 최대한 많이 잡는 컷)\n`);

console.log(`발표용 한 줄:`);
console.log(`"라벨 데이터로 컷을 정했습니다. ${feedPick.threshold}점에서 끊으면 보여주는 항목의 ${pct(feedPick.precision)}가 실제 관련 있어, 피드 신뢰도를 지키면서 관련 항목의 ${pct(feedPick.recall)}를 포착합니다."\n`);

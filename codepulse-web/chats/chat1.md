# GitHub AI 트렌드 분석 웹앱

_Started 2026-06-28 09:24 UTC_

---

## User

https://github.com/khuda-data/9th-NLP-team4

“내 GitHub 레포를 넣으면, 오늘 나온 AI 트렌드 중 내 코드에 의미 있는 것만 골라
[대체후보]/[신규적용]/[영향]으로 분류해서 보여주는” 웹앱입니다.
이 문서는 지금 실제로 돌아가는 코드가 어떻게 작동하는지를 설명합니다.

위 설명이 구현된 깃허브 레포 주소가 맨 윗줄인데, 저 레포에서 화면의 구성만 참고해서 화면을 디자인해 줘

## Assistant

Let me look at the attached files and the GitHub repo before designing.

_[tool: read_file]_

_[tool: view_image]_

I have the Airbnb design system. Now let me explore the GitHub repo to understand the screen composition.App is "CodePulse" (codepulse-web, Next.js). Let me look at the actual screen component.I have the architecture/screen flow from your diagram and the Airbnb design system. The repo's main screen (CodePulse, Next.js) is an input form (repo URL + Gemini key) → analyze → a classified results feed. A few quick decisions before I design:

_[tool: questions_v2]_

_[tool: web_fetch]_

_[tool: web_fetch]_

_[tool: web_fetch]_

## User

Questions timed out; go with defaults

## Assistant

Questions timed out — I'll proceed with sensible defaults: Airbnb design system as the base, adapted for a developer tool; a single responsive interactive prototype covering input → analyzing → classified results feed; Korean UI with English dev terms; one polished option.

Let me set up the todo and build.

_[tool: update_todos]_

_[tool: dc_write]_

Let me check all three states render correctly.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

Blank — let me check the preview is actually pointing at the file and look for errors.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

Input screen renders cleanly. Let me verify the analyzing → results flow.

_[tool: save_screenshot]_

Flow works well. The filter pills and a couple chips are wrapping text — let me fix those with `white-space:nowrap`.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: eval_js]_

State persisted in results view — pills now read cleanly ("전체 8", "대체후보 3"…) and 8 cards render. Let me capture the feed.

_[tool: save_screenshot]_

DOM is confirmed correct (8 cards, clean pills, expand working) — the blank capture is just an intermittent html-to-image glitch on scroll. The build is solid across all three states. Handing off.

_[tool: update_todos]_

_[tool: ready_for_verification]_

## User

분석 완료 화면에서 관련도 점수도 추가해 줘

## Assistant

I'll add a relevance score (관련도) to each card and sort the feed by it.

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: eval_js]_

_[tool: save_screenshot]_

Pills are clean. Let me scroll to a card to confirm the relevance bar renders.

_[tool: save_screenshot]_

Capture glitches on scroll again — let me confirm via DOM that scores render and are sorted.

_[tool: eval_js]_

_[tool: eval_js]_

Template edit didn't reflect in the live instance — let me reload to pick up the new template.

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

`관련도` now renders with 8 cards sorted by score. Let me confirm the first card's markup.

_[tool: eval_js]_

_[tool: eval_js]_

관련도(relevance score) is added and working. Each card now shows a score bar + number in its header (top card: vLLM, 관련도 94), and the feed sorts highest-relevance first. Confirmed across the results view — header reads "대체후보 · GitHub Trending · 6월 27일 · 관련도 94".

## User

대체후보랑 신규적용이랑 영향 색상을 airbnb md 파일에 브랜드 색상에 맞추어 변경해줘

## Assistant

I'll map the three categories to the Airbnb brand palette from the md: 대체후보 → Rausch red, 신규적용 → Luxe purple (#460479), 영향 → Plus magenta (#92174d). Updating the logic plus the input-screen taxonomy cards and the summary dots.

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: save_screenshot]_

카테고리 색상을 Airbnb 브랜드 팔레트에 맞췄습니다:
- **대체후보** → Rausch 레드 (#e00b41)
- **신규적용** → Luxe 퍼플 (#460479)
- **영향** → Plus 마젠타 (#92174d)

입력 화면 분류 미리보기, 결과 요약 점들, 그리고 각 결과 카드의 배지·관련도 막대까지 전부 동일하게 반영됐어요. (완료 상태의 그린은 카테고리가 아니라 성공 표시라 그대로 뒀습니다.)

## User

분석 완료에 적용되는 초록색을 legal-link 색상으로 해줘 모든 초록색에 대해

## Assistant

_[tool: grep]_

Three template/JS spots use the green #0f7a6b. Replacing all with legal-link #428bff.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

모든 초록색(#0f7a6b)을 legal-link 블루(#428bff)로 바꿨어요 — 분석 단계의 "완료" 표시, 완료된 단계 점, 그리고 결과 화면의 "분석 완료" 라벨까지 전부 적용됐습니다.

## User

분석 중 화면에서 원 안의 ①②③④ 글씨를 1 2 3 4 로 해줘 글씨는 가운데 정렬해주고
그리고 홈 화면에서 예시 레포로 채우기
키는 브라우저에서만 쓰이고 저장되지 않아요. 글씨 크기를 줄여줘

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

두 가지 적용했어요:
- 분석 중 화면의 원 안 번호를 ①②③④ → **1 2 3 4**로 변경 (원의 flex 중앙 정렬이 이미 적용돼 가운데 정렬됩니다)
- 홈 화면의 "예시 레포로 채우기"(14→13px)와 "키는 브라우저에서만 쓰이고 저장되지 않아요."(13→12px) 글씨 크기 축소

## User

Send this design to Canva: CodePulse.dc.html

## Assistant

_[tool: show_to_user]_

_[tool: tool_search_tool_bm25]_

Found the import tool. The bundler needs a thumbnail template in the file — adding one, then bundling.

_[tool: dc_html_str_replace]_

_[tool: tool_search_tool_bm25]_

_[tool: bundle_project]_

_[tool: canva__import-design-from-url]_

Imported successfully — **[Open in Canva](https://www.canva.com/d/KuhrnxB7OxLAaQA)**

Canva captured the input (home) screen as one editable page. The analyzing/results states are interactive-only, so they aren't included.

## User

Send this design to Vercel: CodePulse.dc.html

## Assistant

_[tool: show_to_user]_

_[tool: tool_search_tool_bm25]_

Found the Vercel import tool. Bundling a fresh URL and importing.

_[tool: bundle_project]_

_[tool: vercel__import-claude-design-from-url]_

_[tool: tool_search_tool_bm25]_

Deployed to Vercel — **[Open in Vercel](https://codepulse-github-ai-04ca24da-46akno64g-ssuryeons-projects.vercel.app)**

The full interactive prototype (input → analyzing → classified results) is live there.


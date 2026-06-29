# demo/ — 데모용 샘플 데이터

스파이크/데모 단계에서 실제로 생성한 JSON. 라이브 API 키 없이도 피드 UI를 보여주기 위한 번들 데이터.

| 파일 | 내용 | 사용처 |
| --- | --- | --- |
| `matches.json` | Gemini 매칭 결과(데모 레포 = lkh3409/Gram) | `app/page.tsx` 데모 버튼이 import |
| `feed-meta.json` | 데모 피드 메타(레포명/날짜/수집건수 등) | `app/page.tsx` 데모 버튼이 import |
| `trends-cache.json` | 트렌드 6시간 디스크 캐시 | `lib/trends.ts`가 런타임에 읽고/씀 |

> `trends-cache.json`은 캐시라서 6시간 지나면 `lib/trends.ts`가 자동 갱신한다.
> 데모 버튼은 이 폴더의 `matches.json`/`feed-meta.json`을 그대로 렌더한다.

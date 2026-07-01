from __future__ import annotations

import json
import ssl
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any


UA = "khuda-codepulse-data-pipeline"


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def fetch_url(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20, context=ssl_context()) as response:
        return response.read()


def collect_arxiv(limit: int = 20) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "search_query": "cat:cs.AI OR cat:cs.CL OR cat:cs.LG",
            "sortBy": "submittedDate",
            "sortOrder": "descending",
            "start": 0,
            "max_results": limit,
        }
    )
    xml = fetch_url(f"https://export.arxiv.org/api/query?{query}")
    root = ET.fromstring(xml)
    ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
    rows: list[dict[str, Any]] = []
    for entry in root.findall("atom:entry", ns):
        url = (entry.findtext("atom:id", default="", namespaces=ns) or "").strip()
        categories = [c.attrib.get("term", "") for c in entry.findall("atom:category", ns)]
        rows.append(
            {
                "source": "arxiv",
                "arxiv_id": url.split("/abs/")[-1].replace("v1", ""),
                "title": entry.findtext("atom:title", default="", namespaces=ns),
                "summary": entry.findtext("atom:summary", default="", namespaces=ns),
                "url": url,
                "published_at": entry.findtext("atom:published", default="", namespaces=ns),
                "authors": [a.findtext("atom:name", default="", namespaces=ns) for a in entry.findall("atom:author", ns)],
                "metadata": {"categories": categories},
            }
        )
    return rows


def collect_hackernews(limit: int = 20) -> list[dict[str, Any]]:
    since = int((datetime.now(timezone.utc) - timedelta(days=7)).timestamp())
    params = urllib.parse.urlencode(
        {
            "tags": "story",
            "query": "AI",
            "hitsPerPage": 60,
            "numericFilters": f"created_at_i>{since},points>20",
        }
    )
    data = json.loads(fetch_url(f"https://hn.algolia.com/api/v1/search_by_date?{params}"))
    hits = sorted(data.get("hits", []), key=lambda x: x.get("points") or 0, reverse=True)[:limit]
    return [
        {
            "source": "hackernews",
            "object_id": h.get("objectID"),
            "title": h.get("title") or "",
            "summary": h.get("title") or "",
            "url": h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}",
            "published_at": h.get("created_at") or "",
            "authors": [h["author"]] if h.get("author") else [],
            "metadata": {"source_score": h.get("points"), "comments": h.get("num_comments")},
        }
        for h in hits
    ]


def collect_github(limit: int = 20) -> list[dict[str, Any]]:
    pushed_after = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    query = urllib.parse.urlencode({"q": f"LLM pushed:>{pushed_after} stars:>50", "sort": "stars", "order": "desc", "per_page": limit})
    data = json.loads(fetch_url(f"https://api.github.com/search/repositories?{query}"))
    return [
        {
            "source": "github",
            "repo": r.get("full_name"),
            "title": r.get("full_name") or "",
            "summary": r.get("description") or r.get("full_name") or "",
            "url": r.get("html_url") or "",
            "published_at": r.get("created_at") or "",
            "authors": [r.get("owner", {}).get("login")] if r.get("owner", {}).get("login") else [],
            "metadata": {
                "source_score": r.get("stargazers_count"),
                "stars": r.get("stargazers_count"),
                "forks": r.get("forks_count"),
                "language": r.get("language"),
            },
        }
        for r in data.get("items", [])[:limit]
    ]


def collect_all(limit_per_source: int = 20) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for collector in [collect_arxiv, collect_hackernews, collect_github]:
        try:
            rows.extend(collector(limit_per_source))
        except Exception as exc:
            rows.append({"source": "error", "title": collector.__name__, "error": str(exc)})
    return rows

#!/usr/bin/env python3
"""检查 Markdown 中的相对链接指向的文件是否存在。

CI 与本地检查共用。只验证文件部分；锚点做宽松匹配，命中标题行即通过，
不匹配仅告警——GitHub 的锚点生成规则（中文、标点、重复标题）无法在本地
完全复现，硬断言会制造误报。
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
SKIP_SCHEMES = ("http://", "https://", "mailto:", "tel:", "#")


def iter_markdown(root: Path):
    for path in root.rglob("*.md"):
        if any(part in {".git", "node_modules", ".local", "dist", "build"} for part in path.parts):
            continue
        yield path


def anchor_present(target: Path, anchor: str) -> bool:
    needle = anchor.replace("-", " ").replace("_", " ").strip().lower()
    if not needle:
        return True
    try:
        text = target.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return True
    for line in text.splitlines():
        stripped = line.lstrip("#").strip()
        normalized = (
            re.sub(r"[^\w\u4e00-\u9fff]+", " ", stripped).strip().lower()
        )
        if needle in normalized or needle.replace(" ", "") in normalized.replace(" ", ""):
            return True
    return False


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors: list[str] = []
    warnings: list[str] = []
    checked = 0

    for md in iter_markdown(root):
        text = md.read_text(encoding="utf-8")
        for raw in LINK_RE.findall(text):
            link = raw.strip()
            if link.startswith(SKIP_SCHEMES):
                continue
            path_part, _, anchor = link.partition("#")
            if not path_part:
                continue
            checked += 1
            if path_part.startswith("/"):
                target = root / path_part.lstrip("/")
            else:
                target = (md.parent / path_part).resolve()
            if not target.exists():
                errors.append(f"{md.relative_to(root)}: 链接目标不存在 -> {link}")
                continue
            if anchor and target.is_file():
                if not anchor_present(target, anchor):
                    warnings.append(f"{md.relative_to(root)}: 锚点未在标题中命中 -> {link}")

    for line in warnings:
        print(f"WARN  {line}")
    for line in errors:
        print(f"ERROR {line}")
    print(f"检查相对链接 {checked} 条，错误 {len(errors)}，告警 {len(warnings)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

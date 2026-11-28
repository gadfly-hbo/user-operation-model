#!/usr/bin/env python3
"""业务数据不出网守卫：检查 git 索引中是否混入了业务数据或大文件。

依据工程规范 §7。CI 与本地检查共用，退出码非零即阻断。
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# 允许进仓库的数据文件扩展名（仅限脱敏 fixture 目录）
ALLOWED_DATA_SUFFIXES = {".csv", ".xlsx", ".xls"}

# 业务数据常见落点，出现在索引中即视为违规
FORBIDDEN_DIRS = {"data", "raw", "mlruns", "mlflow-artifacts", ".local"}

# 业务数据目录内允许入库的说明文件（不含任何数据）
ALLOWED_IN_DATA = {("data", "README.md")}

# 显式白名单（data-templates DT4）：数据模板包是 tracked 交付物，内容由
# scripts/build-data-templates.mjs 从代码契约（packages/core/src/normalize/catalog/）
# 全合成生成（款号 SYN-…、演示店铺／品牌、通用枚举值），无任何真实业务数据。
# 只放行下面这一个路径，不放宽其它任何规则。
ALLOWED_TRACKED_FILES = {"templates/数据模板.xlsx"}

# 单文件大小上限（字节）
MAX_FILE_BYTES = 5 * 1024 * 1024


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files", "-z"], capture_output=True, text=True, check=True
    )
    return [p for p in out.stdout.split("\0") if p]


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors: list[str] = []

    for path in tracked_files():
        parts = Path(path).parts
        suffix = Path(path).suffix.lower()

        if parts[:2] in ALLOWED_IN_DATA or parts in ALLOWED_IN_DATA:
            continue

        if path in ALLOWED_TRACKED_FILES:
            continue

        for forbidden in FORBIDDEN_DIRS:
            if forbidden in parts:
                errors.append(f"业务数据目录被跟踪: {path}")
                break

        if suffix in ALLOWED_DATA_SUFFIXES and not parts[:1] == ("fixtures",):
            errors.append(f"数据文件被跟踪（仅 fixtures/ 允许）: {path}")

        full = root / path
        if full.is_file():
            size = full.stat().st_size
            if size > MAX_FILE_BYTES:
                errors.append(f"文件超过 {MAX_FILE_BYTES // 1024 // 1024} MiB: {path} ({size} bytes)")

    for line in errors:
        print(f"ERROR {line}")
    if not errors:
        print("数据守卫通过：索引中无业务数据目录、数据文件或超大文件")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

/**
 * MCP 工具的统一返回封装。
 *
 * 约定：
 * - 成功返回 `{ ok: true, data }`
 * - 失败返回 `{ ok: false, error: { kind, message, hint? } }`
 *
 * **数据未就位必须返回明确错误，不能返回空结果**——
 * 空结果与「数据缺失」必须可区分（对应工程规范 DM13）。
 */

export type ToolErrorKind =
  | 'not-found'
  | 'month-mismatch'
  | 'ambiguous'
  | 'data-not-ready'
  | 'invalid-argument';

export interface ToolOk<T> {
  ok: true;
  data: T;
}

export interface ToolErr {
  ok: false;
  error: {
    kind: ToolErrorKind;
    message: string;
    hint?: string;
  };
}

export type ToolResult<T> = ToolOk<T> | ToolErr;

export function ok<T>(data: T): ToolOk<T> {
  return { ok: true, data };
}

export function err(
  kind: ToolErrorKind,
  message: string,
  hint?: string,
): ToolErr {
  return { ok: false, error: { kind, message, ...(hint ? { hint } : {}) } };
}

/** 转成 MCP 的 content 结构。失败时带 `isError`，让客户端能识别。 */
export function toMcp(result: ToolResult<unknown>): {
  content: { type: 'text'; text: string }[];
  isError: boolean;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    isError: !result.ok,
  };
}

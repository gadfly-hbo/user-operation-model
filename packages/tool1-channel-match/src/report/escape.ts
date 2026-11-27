/** HTML 转义。业务字符串一律经过这里，避免注入。 */
export function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

/**
 * 把 JSON 内嵌进 `<script type="application/json">`。
 *
 * 关闭标签与行分隔符必须转义，否则内容会提前结束脚本块。
 */
export function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

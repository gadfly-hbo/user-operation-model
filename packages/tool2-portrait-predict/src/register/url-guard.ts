/**
 * model-mlflow 登记地址守卫（复核修单 S5）。
 *
 * 复核发现（review-p2.md S5）：登记脚本此前接受任意 `--url`／`MPS_MLFLOW_URL`，
 * `--url http://<远端>` 会把模型包 artifact POST 到非本机——违反「业务数据不出网」的边界精神。
 *
 * 本守卫 fail-closed：URL 只允许**本机回环**地址（`127.0.0.1`／`localhost`／`::1`，端口任意），
 * 其它主机一律拒绝；登记入口（`scripts/register-model-mlflow.mjs`）在发起任何请求前调用。
 */

/** 本机回环主机名白名单（含 IPv6 回环的方括号形式，URL 解析后 `hostname` 已去括号）。 */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '::1']);

/** 判定 URL 是否指向本机回环地址；不合法或非回环即抛错。 */
export function assertLoopbackMlflowUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`MLflow 账本地址不是合法 URL：${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`MLflow 账本地址必须是 http(s) 协议：${url}`);
  }
  // IPv6 的 hostname 带方括号（如 `[::1]`），先去掉再比对
  const hostname = parsed.hostname.startsWith('[') ? parsed.hostname.slice(1, -1) : parsed.hostname;
  if (!LOOPBACK_HOSTNAMES.has(hostname)) {
    throw new Error(
      `MLflow 账本地址必须是本机回环（loopback：127.0.0.1／localhost／::1），拒绝：${url}` +
        `——登记会把模型包 artifact POST 到该地址，业务数据不出网（工程规范 §7）`,
    );
  }
}

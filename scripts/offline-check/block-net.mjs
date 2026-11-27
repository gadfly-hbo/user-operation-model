/**
 * 断网守卫（preload 模块）。
 *
 * 拦截常见出网入口，调用即抛错并计数。用于验证「本地 MCP server 在
 * 无网络条件下仍可完整运行」。
 *
 * 覆盖面（复核要求逐项确认）：
 * - net：connect / createConnection / request / **Socket.prototype.connect**
 * - http / https：request / get
 * - dns：lookup / resolve（回调版）· **promises.lookup / resolve / resolve4 / resolve6** · **Resolver 实例方法**
 * - tls：connect
 *
 * 用法：`node --import ./scripts/offline-check/block-net.mjs <脚本>`
 * 退出时向 stderr 打印出网尝试次数。
 */
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import tls from 'node:tls';

const attempts = new Set();

function block(name) {
  return (...args) => {
    attempts.add(name);
    const error = new Error(`[断网守卫] 尝试出网被拦截: ${name}`);
    error.code = 'EBLOCKEDNET';
    throw error;
  };
}

// ── net ────────────────────────────────────────────────────
net.connect = block('net.connect');
net.createConnection = block('net.createConnection');
net.request = block('net.request');
const OriginalSocket = net.Socket;
OriginalSocket.prototype.connect = block('net.Socket.prototype.connect');

// ── http / https ────────────────────────────────────────────
http.request = block('http.request');
http.get = block('http.get');
https.request = block('https.request');
https.get = block('https.get');

// ── dns（回调版） ───────────────────────────────────────────
dns.lookup = block('dns.lookup');
dns.resolve = block('dns.resolve');
dns.resolve4 = block('dns.resolve4');
dns.resolve6 = block('dns.resolve6');

// ── dns（Promise 版） ───────────────────────────────────────
if (dns.promises) {
  dns.promises.lookup = block('dns.promises.lookup');
  dns.promises.resolve = block('dns.promises.resolve');
  dns.promises.resolve4 = block('dns.promises.resolve4');
  dns.promises.resolve6 = block('dns.promises.resolve6');
}

// ── dns.Resolver 实例方法 ───────────────────────────────────
const OriginalResolver = dns.Resolver;
class GuardedResolver extends OriginalResolver {
  resolve(...args) {
    return block('dns.Resolver.resolve').apply(this, args);
  }
  resolve4(...args) {
    return block('dns.Resolver.resolve4').apply(this, args);
  }
  resolve6(...args) {
    return block('dns.Resolver.resolve6').apply(this, args);
  }
  lookup(...args) {
    return block('dns.Resolver.lookup').apply(this, args);
  }
}
dns.Resolver = GuardedResolver;

// ── tls ─────────────────────────────────────────────────────
tls.connect = block('tls.connect');

process.on('exit', () => {
  process.stderr.write(
    `[断网守卫] 出网尝试次数: ${attempts.size}${attempts.size ? ` (${[...attempts].join(', ')})` : ''}\n`,
  );
});

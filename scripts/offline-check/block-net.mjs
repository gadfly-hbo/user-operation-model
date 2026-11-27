/**
 * 断网守卫（preload 模块）。
 *
 * 拦截出网入口，调用即抛错并记录。用于验证「本地 MCP server 在无网络条件下
 * 仍可完整运行」。
 *
 * 覆盖面按 Node 实际导出的入口逐项列出（复核要求逐项确认）：
 * - net：connect / createConnection / request / Socket.prototype.connect
 * - http / https：request / get
 * - dns（模块级）：lookup / lookupService / resolve / resolve4 / resolve6 /
 *   resolveAny / resolveCaa / resolveCname / resolveMx / resolveNaptr /
 *   resolveNs / resolvePtr / resolveSoa / resolveSrv / resolveTlsa / resolveTxt / reverse
 * - dns（Promise 版）：同上 + Resolver 实例方法
 * - dns.Resolver / dns.promises.Resolver：实例方法逐个覆盖
 * - tls：connect
 *
 * 用法：`node --import ./scripts/offline-check/block-net.mjs <脚本>`
 * 退出时向 stderr 打印出网尝试次数（**按尝试次数计，不去重**）。
 */
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import tls from 'node:tls';

/** 出网尝试记录（按次数，不去重）。 */
const attempts = [];

function block(name) {
  return (...args) => {
    attempts.push(name);
    const error = new Error(`[断网守卫] 尝试出网被拦截: ${name}`);
    error.code = 'EBLOCKEDNET';
    error.blockedEntry = name;
    throw error;
  };
}

// ── net ────────────────────────────────────────────────────
net.connect = block('net.connect');
net.createConnection = block('net.createConnection');
net.request = block('net.request');
net.Socket.prototype.connect = block('net.Socket.prototype.connect');

// ── http / https ────────────────────────────────────────────
http.request = block('http.request');
http.get = block('http.get');
https.request = block('https.request');
https.get = block('https.get');

// ── tls ─────────────────────────────────────────────────────
tls.connect = block('tls.connect');

/** dns 模块级与 Promise 版的同名方法。 */
const DNS_METHODS = [
  'lookup',
  'lookupService',
  'resolve',
  'resolve4',
  'resolve6',
  'resolveAny',
  'resolveCaa',
  'resolveCname',
  'resolveMx',
  'resolveNaptr',
  'resolveNs',
  'resolvePtr',
  'resolveSoa',
  'resolveSrv',
  'resolveTlsa',
  'resolveTxt',
  'reverse',
];

/** Resolver 实例方法（按 Node 实际原型上的方法，不自造）。 */
const RESOLVER_METHODS = [
  'resolve',
  'resolve4',
  'resolve6',
  'resolveAny',
  'resolveCaa',
  'resolveCname',
  'resolveMx',
  'resolveNaptr',
  'resolveNs',
  'resolvePtr',
  'resolveSoa',
  'resolveSrv',
  'resolveTlsa',
  'resolveTxt',
  'reverse',
];

for (const name of DNS_METHODS) {
  if (typeof dns[name] === 'function') dns[name] = block(`dns.${name}`);
  if (dns.promises && typeof dns.promises[name] === 'function') {
    dns.promises[name] = block(`dns.promises.${name}`);
  }
}

/** 用子类覆盖 Resolver 实例方法（模块属性可写）。 */
function guardResolver(Original, prefix) {
  class GuardedResolver extends Original {
    resolve(...args) {
      return block(`${prefix}.resolve`).apply(this, args);
    }
    resolve4(...args) {
      return block(`${prefix}.resolve4`).apply(this, args);
    }
    resolve6(...args) {
      return block(`${prefix}.resolve6`).apply(this, args);
    }
    resolveAny(...args) {
      return block(`${prefix}.resolveAny`).apply(this, args);
    }
    resolveCaa(...args) {
      return block(`${prefix}.resolveCaa`).apply(this, args);
    }
    resolveCname(...args) {
      return block(`${prefix}.resolveCname`).apply(this, args);
    }
    resolveMx(...args) {
      return block(`${prefix}.resolveMx`).apply(this, args);
    }
    resolveNaptr(...args) {
      return block(`${prefix}.resolveNaptr`).apply(this, args);
    }
    resolveNs(...args) {
      return block(`${prefix}.resolveNs`).apply(this, args);
    }
    resolvePtr(...args) {
      return block(`${prefix}.resolvePtr`).apply(this, args);
    }
    resolveSoa(...args) {
      return block(`${prefix}.resolveSoa`).apply(this, args);
    }
    resolveSrv(...args) {
      return block(`${prefix}.resolveSrv`).apply(this, args);
    }
    resolveTlsa(...args) {
      return block(`${prefix}.resolveTlsa`).apply(this, args);
    }
    resolveTxt(...args) {
      return block(`${prefix}.resolveTxt`).apply(this, args);
    }
    reverse(...args) {
      return block(`${prefix}.reverse`).apply(this, args);
    }
  }
  return GuardedResolver;
}

dns.Resolver = guardResolver(dns.Resolver, 'dns.Resolver');
if (dns.promises?.Resolver) {
  dns.promises.Resolver = guardResolver(dns.promises.Resolver, 'dns.promises.Resolver');
}

process.on('exit', () => {
  const unique = [...new Set(attempts)];
  process.stderr.write(
    `[断网守卫] 出网尝试次数: ${attempts.length}` +
      `${unique.length ? ` (入口: ${unique.join(', ')})` : ''}\n`,
  );
});

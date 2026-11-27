/**
 * 断网守卫自检。
 *
 * 目的：**证明守卫本身有效**，而不是空跑。
 *
 * 判据（每条都必须满足，缺一即失败）：
 * 1. 触发的错误 `code === 'EBLOCKEDNET'`；
 * 2. 错误的 `blockedEntry` **等于期望的入口名** —— 防止「被别的入口顺带拦下」
 *    也算通过（上一版的缺陷）；
 * 3. **任何其它错误一律算失败** —— 防止守卫没生效时原始调用抛出的
 *    网络错误被当成「已拦截」（上一版的另一个缺陷）。
 *
 * 用法：`node --import ./scripts/offline-check/block-net.mjs scripts/offline-check/guard-selftest.mjs`
 */
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import dns from 'node:dns';

/** 每个用例：期望被拦截的入口名 + 触发动作。 */
const CASES = [
  ['net.connect', () => net.connect(80, '203.0.113.1')],
  ['net.createConnection', () => net.createConnection(80, '203.0.113.1')],
  ['net.Socket.prototype.connect', () => new net.Socket().connect(80, '203.0.113.1')],
  ['http.request', () => http.request('http://203.0.113.1/')],
  ['http.get', () => http.get('http://203.0.113.1/')],
  ['dns.lookup', () => new Promise((res, rej) => dns.lookup('example.invalid', (e, a) => (e ? rej(e) : res(a))))],
  ['dns.resolve', () => new Promise((res, rej) => dns.resolve('example.invalid', (e, a) => (e ? rej(e) : res(a))))],
  ['dns.reverse', () => new Promise((res, rej) => dns.reverse('203.0.113.1', (e, a) => (e ? rej(e) : res(a))))],
  ['dns.promises.lookup', () => dns.promises.lookup('example.invalid')],
  ['dns.promises.resolve', () => dns.promises.resolve('example.invalid')],
  ['dns.promises.reverse', () => dns.promises.reverse('203.0.113.1')],
  ['dns.Resolver.resolve', () => new dns.Resolver().resolve('example.invalid', 'A')],
  ['dns.promises.Resolver.resolve', () => new dns.promises.Resolver().resolve('example.invalid', 'A')],
];

const failures = [];

for (const [expectedEntry, trigger] of CASES) {
  try {
    await trigger();
    failures.push(`${expectedEntry}: 未被拦截（调用竟然成功了）`);
  } catch (error) {
    if (error?.code !== 'EBLOCKEDNET') {
      failures.push(`${expectedEntry}: 抛的是其它错误，未被守卫拦截 —— ${error?.code ?? error?.message}`);
    } else if (error.blockedEntry !== expectedEntry) {
      failures.push(`${expectedEntry}: 被「${error.blockedEntry}」拦下，归因不符`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
  process.stderr.write(`守卫自检失败：${failures.length}/${CASES.length} 项未通过\n`);
  process.exit(1);
}

assert.equal(failures.length, 0);
process.stderr.write(`守卫自检通过：${CASES.length} 个出网入口全部被正确拦截并归因\n`);

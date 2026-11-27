// 守卫自检：故意走各种出网入口，必须全部被拦截
import net from 'node:net';
import dns from 'node:dns';
import http from 'node:http';

const attempts = [];
const check = async (name, fn) => {
  try { await fn(); attempts.push(`${name}: 未被拦截!`); }
  catch (e) { if (e?.code === 'EBLOCKEDNET') attempts.push(`${name}: 已拦截`); else attempts.push(`${name}: 其它错误 ${e.message?.slice(0,40)}`); }
};

await check('net.connect', () => net.connect(80, 'example.com'));
await check('net.createConnection', () => net.createConnection(80, 'example.com'));
await check('net.Socket().connect', () => new net.Socket().connect(80, 'example.com'));
await check('http.request', () => http.request('http://example.com'));
await check('http.get', () => http.get('http://example.com'));
await check('dns.lookup', () => new Promise((res, rej) => dns.lookup('example.com', (e, a) => e ? rej(e) : res(a))));
await check('dns.promises.lookup', () => dns.promises.lookup('example.com'));
await check('dns.promises.resolve', () => dns.promises.resolve('example.com'));
await check('dns.Resolver.resolve', () => new dns.Resolver().resolve('example.com'));
await check('dns.Resolver.lookup', () => new dns.Resolver().lookup('example.com'));

console.log(attempts.join('\n'));
const bad = attempts.filter(a => a.includes('未被拦截'));
process.exit(bad.length ? 1 : 0);

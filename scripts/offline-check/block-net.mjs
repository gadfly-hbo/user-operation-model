// 断网守卫：拦截所有出网入口，调用即抛错并计数
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import tls from 'node:tls';

const attempts = [];
const block = (name) => (...args) => {
  attempts.push(name);
  throw new Error(`[断网守卫] 尝试出网被拦截: ${name}`);
};
net.connect = block('net.connect');
net.createConnection = block('net.createConnection');
net.request = block('net.request');
http.request = block('http.request');
http.get = block('http.get');
https.request = block('https.request');
https.get = block('https.get');
dns.lookup = block('dns.lookup');
dns.resolve = block('dns.resolve');
tls.connect = block('tls.connect');

process.on('exit', () => {
  process.stderr.write(`[断网守卫] 出网尝试次数: ${attempts.length}\n`);
});

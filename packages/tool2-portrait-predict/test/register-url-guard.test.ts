/**
 * S5（复核修单）：model-mlflow 登记地址必须只允许本机回环。
 *
 * 复核发现：`scripts/register-model-mlflow.mjs` 的 `--url`／`MPS_MLFLOW_URL`
 * 此前接受任意主机，会把模型包 artifact POST 到远端——数据边界风险。
 * 修正后登记入口在发起任何请求前调用 `assertLoopbackMlflowUrl`，非回环即 fail-closed。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assertLoopbackMlflowUrl } from '../src/register/url-guard.js';

describe('登记地址守卫（S5）', () => {
  test('回环地址放行：127.0.0.1／localhost／::1，端口任意', () => {
    assert.doesNotThrow(() => assertLoopbackMlflowUrl('http://127.0.0.1:5021'));
    assert.doesNotThrow(() => assertLoopbackMlflowUrl('http://127.0.0.1'));
    assert.doesNotThrow(() => assertLoopbackMlflowUrl('http://localhost:5021'));
    assert.doesNotThrow(() => assertLoopbackMlflowUrl('http://localhost'));
    assert.doesNotThrow(() => assertLoopbackMlflowUrl('http://[::1]:5021'));
    assert.doesNotThrow(() => assertLoopbackMlflowUrl('http://[::1]'));
  });

  test('非回环主机一律拒绝（含内网地址与域名）', () => {
    assert.throws(() => assertLoopbackMlflowUrl('http://example.com:8080'), /回环|loopback/i);
    assert.throws(() => assertLoopbackMlflowUrl('http://192.168.1.10:5021'), /回环|loopback/i);
    assert.throws(() => assertLoopbackMlflowUrl('http://0.0.0.0:5021'), /回环|loopback/i);
    assert.throws(() => assertLoopbackMlflowUrl('https://mlflow.internal.example'), /回环|loopback/i);
  });

  test('非 http(s) 协议与非法 URL 拒绝', () => {
    assert.throws(() => assertLoopbackMlflowUrl('ftp://127.0.0.1:5021'), /http|协议/i);
    assert.throws(() => assertLoopbackMlflowUrl('not-a-url'), /URL/i);
    assert.throws(() => assertLoopbackMlflowUrl(''), /URL/i);
  });
});

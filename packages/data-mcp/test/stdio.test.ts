import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createFixtureDataRoot } from './helpers/fixtures.js';

/**
 * 真实 stdio 路径验证。
 *
 * 与 mcp.test.ts 的进程内连接不同，这里**真的 spawn 一个子进程**，
 * 验证 `bin.js` 能被 MCP 客户端拉起并完成 initialize 握手与工具调用。
 */

const here = dirname(fileURLToPath(import.meta.url));
const binPath = join(here, '..', 'src', 'bin.js');

let dataRoot = '';
let client: Client;

before(async () => {
  dataRoot = await createFixtureDataRoot();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [binPath],
    env: { ...process.env, UOM_DATA_ROOT: dataRoot } as Record<string, string>,
  });
  client = new Client({ name: 'uom-stdio-test', version: '1.0.0' });
  await client.connect(transport);
});

after(async () => {
  await client?.close();
});

describe('真实 stdio 路径', () => {
  test('server 能被拉起并列出工具', async () => {
    const { tools } = await client.listTools();
    assert.equal(tools.length, 17);
  });

  test('通过 stdio 调用工具能拿到数据', async () => {
    const result = (await client.callTool({
      name: 'list_channels',
      arguments: {},
    })) as { content: { type: string; text: string }[] };
    const payload = JSON.parse(result.content[0]?.text ?? '{}') as {
      ok: boolean;
      data?: { total: number };
    };
    assert.equal(payload.ok, true);
    assert.ok((payload.data?.total ?? 0) > 0);
  });

  test('数据未就位的工具在真实路径上同样返回明确错误', async () => {
    const result = (await client.callTool({
      name: 'get_funnel',
      arguments: { spu: 'SPU-001', phase: 'launch' },
    })) as { isError?: boolean; content: { type: string; text: string }[] };
    assert.equal(result.isError, true);
    const payload = JSON.parse(result.content[0]?.text ?? '{}') as {
      ok: boolean;
      error?: { kind: string };
    };
    assert.equal(payload.ok, false);
    assert.equal(payload.error?.kind, 'data-not-ready');
  });
});

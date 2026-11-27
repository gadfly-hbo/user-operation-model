/**
 * 断网端到端验证。
 *
 * 启动本地 MCP server（子进程内已加载断网守卫），经 MCP client 调用全部工具，
 * 并断言：
 * 1. 工具数为 17
 * 2. 9 个返回真实数据、8 个返回 data-not-ready、0 个意外
 * 3. **子进程的出网尝试次数为 0**
 * 4. 守卫本身有效（自检：故意发起的网络请求必须被拦截）
 *
 * 任一断言不成立即以非零退出码结束，可直接用作 CI 门禁。
 *
 * 用法：`npm run build && npm run offline-check`
 */
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const EXPECTED_TOOLS = 17;
const EXPECTED_READY = 9;
const EXPECTED_NOT_READY = 8;

const binPath = new URL('../../packages/data-mcp/dist/src/bin.js', import.meta.url).pathname;
const guardPath = new URL('./block-net.mjs', import.meta.url).pathname;
const dataRoot = new URL('../../data', import.meta.url).pathname;

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', guardPath, binPath],
  env: { ...process.env, UOM_DATA_ROOT: dataRoot },
  stderr: 'pipe',
});

let stderr = '';
transport.stderr?.on('data', (chunk) => {
  stderr += String(chunk);
});

const client = new Client({ name: 'offline-check', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
assert.equal(tools.length, EXPECTED_TOOLS, `工具数应为 ${EXPECTED_TOOLS}，实际 ${tools.length}`);

const argumentsByTool = {
  list_channels: {},
  get_channel_portrait: { channelId: '1OCD7S0011' },
  get_brand_portrait: { scope: 'all' },
  get_competitor_portrait: { brand: 'X' },
  list_products: { keyword: 'T恤' },
  get_product_dossier: { spu: '101526100201' },
  get_product_portrait: { spu: '101526100201' },
  get_portrait_aggregate: { level: 'category', key: '短袖T恤' },
  get_funnel: { spu: '101526100201', phase: 'launch' },
  compare_product_channel: { spu: '101526100201', channelId: '1OCD7S0011' },
  search_by_tag: { dimension: 'strategy_segment', label: '银发族' },
  search_similar_products: { spu: '101526100201' },
  list_member_features: {},
  get_retention_cohort: { cohortMonth: '2026-01', metric: 'day30' },
  get_recency_distribution: { month: '2026-01' },
  get_channel_flow_matrix: { month: '2026-01' },
  get_diagnosis: { month: '2026-01', type: 'all' },
};

let ready = 0;
let notReady = 0;
const unexpected = [];
for (const tool of tools) {
  const result = await client.callTool({
    name: tool.name,
    arguments: argumentsByTool[tool.name] ?? {},
  });
  const payload = JSON.parse(result.content[0].text);
  if (payload.ok) ready += 1;
  else if (payload.error?.kind === 'data-not-ready') notReady += 1;
  else unexpected.push(`${tool.name}: ${payload.error?.kind}`);
}

await client.close();

// 子进程退出后守卫会打印出网尝试次数
const attemptMatch = stderr.match(/出网尝试次数: (\d+)/);
const attempts = attemptMatch ? Number(attemptMatch[1]) : null;

console.log(
  `工具 ${tools.length} | 数据就绪 ${ready} | data-not-ready ${notReady} | 意外 ${unexpected.length} | 出网尝试 ${attempts ?? '未读到'}`,
);

assert.deepEqual(unexpected, [], `存在非预期的错误：${unexpected.join('; ')}`);
assert.equal(ready, EXPECTED_READY, `数据就绪工具应为 ${EXPECTED_READY}，实际 ${ready}`);
assert.equal(notReady, EXPECTED_NOT_READY, `data-not-ready 工具应为 ${EXPECTED_NOT_READY}，实际 ${notReady}`);
assert.notEqual(attempts, null, '未读到子进程的出网守卫计数');
assert.equal(attempts, 0, `出网尝试次数应为 0，实际 ${attempts}`);

console.log('断网端到端验证通过：17 个工具在无网络条件下全部可调用，无任何出网尝试。');

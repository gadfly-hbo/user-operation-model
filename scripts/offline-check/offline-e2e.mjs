import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const bin = { pathname: new URL('../../packages/data-mcp/dist/src/bin.js', import.meta.url).pathname };
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', new URL('./block-net.mjs', import.meta.url).pathname, bin.pathname],
  env: { ...process.env, UOM_DATA_ROOT: new URL('../../data', import.meta.url).pathname },
});
const client = new Client({ name: 'offline-check', version: '1.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
const call = async (n, a = {}) => {
  const r = await client.callTool({ name: n, arguments: a });
  const p = JSON.parse(r.content[0].text);
  return { ok: p.ok, kind: p.error?.kind };
};

const args = {
  list_channels: {}, get_channel_portrait: { channelId: '1OCD7S0011' },
  get_brand_portrait: { scope: 'all' }, get_competitor_portrait: { brand: 'X' },
  list_products: { keyword: 'T恤' }, get_product_dossier: { spu: '101526100201' },
  get_product_portrait: { spu: '101526100201' }, get_portrait_aggregate: { level: 'category', key: '短袖T恤' },
  get_funnel: { spu: '101526100201', phase: 'launch' },
  compare_product_channel: { spu: '101526100201', channelId: '1OCD7S0011' },
  search_by_tag: { dimension: 'strategy_segment', label: '银发族' },
  search_similar_products: { spu: '101526100201' },
  list_member_features: {}, get_retention_cohort: { cohortMonth: '2026-01', metric: 'day30' },
  get_recency_distribution: { month: '2026-01' }, get_channel_flow_matrix: { month: '2026-01' },
  get_diagnosis: { month: '2026-01', type: 'all' },
};

let ok = 0, notReady = 0, other = 0;
for (const name of tools.map(t => t.name)) {
  const r = await call(name, args[name] ?? {});
  if (r.ok) { ok++; }
  else if (r.kind === 'data-not-ready') { notReady++; }
  else { other++; console.log('  意外:', name, r.kind); }
}
console.log(`工具数 ${tools.length} | 可用 ${ok} | data-not-ready ${notReady} | 其他 ${other}`);
await client.close();

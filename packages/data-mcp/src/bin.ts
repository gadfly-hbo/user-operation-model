import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { buildIndex } from '@uom/core';
import { createServer } from './server.js';

/**
 * 可执行入口：以 stdio 传输启动数据 MCP server。
 *
 * 数据根目录由 `UOM_DATA_ROOT` 指定，默认 `data`。
 * 运行期不发起任何网络请求，只读本地数据。
 */
async function main(): Promise<void> {
  const dataRoot = process.env.UOM_DATA_ROOT ?? 'data';
  const index = await buildIndex({ dataRoot });
  const server = createServer(index);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(`uom-data-mcp 启动失败：${String(error)}\n`);
  process.exitCode = 1;
});

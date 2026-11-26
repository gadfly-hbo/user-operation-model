import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import {
  douyinPortraitCsv,
  jdPortraitXlsx,
  makeTempDir,
  tmallPortraitXlsx,
  writeCsv,
  writeXlsx,
} from './helpers/fixtures.js';
import {
  normalizeDouyinPortrait,
  normalizeJdPortrait,
  normalizeTmallPortrait,
  parseCsvRows,
  parseMonthLabel,
  parsePortraitEntityId,
  normalizeProductTable,
  normalizeChannelTable,
  type NormalizationIssue,
} from '../src/normalize/index.js';

const dir = makeTempDir();

describe('CSV 解析', () => {
  test('跳过 BOM 与空行', () => {
    const path = writeCsv(join(dir, 'a.csv'), [
      ['标签类型', '标签'],
      ['', ''],
      ['预测性别', '女'],
    ]);
    const rows = parseCsvRows(path);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['标签类型', '标签']);
  });

  test('引号内的逗号与转义引号被正确解析', () => {
    const path = writeCsv(join(dir, 'b.csv'), [
      ['A', 'B'],
      ['含,逗号', '含"引号"'],
    ]);
    const rows = parseCsvRows(path);
    assert.deepEqual(rows[1], ['含,逗号', '含"引号"']);
  });
});

describe('月份与实体标识解析', () => {
  test('解析 YYYY-MM', () => {
    assert.equal(parseMonthLabel('2026-10'), '2026-10');
  });

  test('解析 YYM 形式', () => {
    assert.equal(parseMonthLabel('2610'), '2026-10');
  });

  test('解析区间形式', () => {
    assert.equal(parseMonthLabel('2507-2606'), '2025-07~2026-06');
  });

  test('无法识别的月份返回 null', () => {
    assert.equal(parseMonthLabel('不是月份'), null);
  });

  test('从抖音列名拆出实体标识', () => {
    const parsed = parsePortraitEntityId('2507-2606森马广州越秀区北京路店-占比');
    assert.equal(parsed?.entityId, '森马广州越秀区北京路店');
    assert.equal(parsed?.month, '2025-07~2026-06');
  });

  test('从款号文件名拆出实体标识', () => {
    assert.equal(parsePortraitEntityId('101526100201')?.entityId, '101526100201');
  });

  test('从款号前缀文件名拆出实体标识', () => {
    assert.equal(parsePortraitEntityId('款号101526100201_天猫')?.entityId, '101526100201');
  });
});

describe('抖音画像归一化', () => {
  const path = douyinPortraitCsv(
    join(dir, 'douyin.csv'),
    '演示门店',
    '2507-2606',
    [
      ['预测性别', '男', '39.26%', '90.62089851674344'],
      ['预测性别', '女', '60.74%', '144.1153984073459'],
      ['预测年龄段', '18-19', '2.79%', '93.73368817435292'],
      ['预测年龄段', '20-23', '9.74%', '151.2182799322709'],
      ['预测年龄段', '24-30', '26.14%', '196.92730904578247'],
      ['八大消费群体', '都市银发', '3.10%', '120.5'],
      ['八大消费群体', 'genz', '8.20%', '133.3'],
      ['预测消费能力', '高消费', '10.00%', '110.0'],
      ['城市等级', '新一线城市', '5.00%', '105.0'],
      ['预测人生阶段', '单身一族', '20.00%', '95.0'],
      ['预测用户星座', '天秤座', '4.00%', '88.0'],
    ],
  );

  const portrait = normalizeDouyinPortrait(path, { entityType: 'channel' });

  test('平台原生标签被完整保留', () => {
    const raw = portrait.platformLabels.douyin;
    assert.ok(raw, '缺少抖音原生标签');
    assert.equal(raw['预测性别']?.['男']?.share, 0.3926);
    assert.equal(raw['八大消费群体']?.['都市银发']?.share, 0.031);
    assert.equal(raw['预测性别']?.['男']?.tgi, 90.62089851674344);
  });

  test('性别投影到统一维度', () => {
    assert.ok(Math.abs((portrait.projections.gender?.labels['男']?.share ?? 0) - 0.3926) < 1e-9);
    assert.ok(Math.abs((portrait.projections.gender?.labels['女']?.share ?? 0) - 0.6074) < 1e-9);
  });

  test('年龄段按统一档位合并占比', () => {
    const age = portrait.projections.age;
    assert.ok(age, '缺少年龄投影');
    const total = age.labels['18-23']?.share ?? 0;
    assert.ok(Math.abs(total - 0.1253) < 1e-9, `18-23 档应为 0.1253，实际 ${total}`);
    assert.ok(
      Math.abs((age.labels['24-30']?.share ?? 0) - 0.2614) < 1e-9,
      '24-30 档应直接等于源档占比',
    );
  });

  test('策略人群按统一词表投影', () => {
    const seg = portrait.projections.strategy_segment;
    assert.ok(Math.abs((seg?.labels['银发族']?.share ?? 0) - 0.031) < 1e-9);
    assert.ok(Math.abs((seg?.labels['Z世代']?.share ?? 0) - 0.082) < 1e-9);
    assert.equal(seg?.labels['都市银发'], undefined, '不应保留平台原值作为统一标签');
  });

  test('未映射的原生维度不投影但保留在原生标签中', () => {
    assert.equal(portrait.projections.user_constellation, undefined);
    assert.ok(portrait.platformLabels.douyin?.['预测用户星座']);
  });

  test('未映射标签被记为归一化问题', () => {
    const issues: NormalizationIssue[] = portrait.issues ?? [];
    assert.ok(
      issues.some((i) => i.kind === 'unmapped-dimension' && i.sourceDimension === '预测用户星座'),
      '缺少未映射维度的问题记录',
    );
  });
});

const tmallPath = await tmallPortraitXlsx(join(dir, 'tmall.xlsx'), [
  ['预测性别', '女', '71.20%'],
  ['预测性别', '男', '28.68%'],
  ['预测年龄', '[18,24]', '30.00%'],
  ['预测年龄', '[25,29]', '20.00%'],
  ['预测年龄', '[30,34]', '10.00%'],
  ['大快消策略人群', '都市银发族', '5.00%'],
  ['大服饰策略人群', '潮流人群', '7.00%'],
  ['预测城市等级', '1', '12.00%'],
]);

const tmallPortrait = await normalizeTmallPortrait(tmallPath, { entityType: 'channel' });

describe('天猫画像归一化', () => {
  const portrait = tmallPortrait;

  test('天猫无 TGI，不补零', () => {
    const raw = portrait.platformLabels.tmall;
    assert.ok(raw);
    assert.equal(raw['预测性别']?.['女']?.tgi, undefined);
  });

  test('跨边界的年龄档标记精度损失', () => {
    const age = portrait.projections.age;
    assert.equal(age?.precisionLoss, true);
    assert.ok(age?.lossySources?.includes('[18,24]'));
    assert.ok(age?.lossySources?.includes('[30,34]'));
  });

  test('服饰体系独立投影，不与泛人群混同', () => {
    assert.ok(
      Math.abs((portrait.projections.apparel_segment?.labels['潮流人群']?.share ?? 0) - 0.07) < 1e-9,
    );
    assert.equal(portrait.projections.strategy_segment?.labels['潮流人群'], undefined);
    assert.equal(portrait.projections.strategy_segment?.labels['银发族']?.share, 0.05);
  });
});

const jdPath = await jdPortraitXlsx(join(dir, 'jd.xlsx'), [
  ['性别', '女', '0.6', '120'],
  ['性别', '男', '0.4', '85'],
  ['年龄', '0~15岁', '0.02', '30'],
  ['年龄', '21~25岁', '0.08', '110'],
  ['年龄', '26~30岁', '0.15', '130'],
  ['十大靶群', '都市Z世代', '0.09', '140'],
  ['购买力', '极高', '0.11', '125'],
  ['城市线级', '一线', '0.2', '160'],
]);

const jdPortrait = await normalizeJdPortrait(jdPath, { entityType: 'channel' });

describe('京东画像归一化', () => {
  const portrait = jdPortrait;

  test('占比已是小数时不做二次换算', () => {
    assert.equal(portrait.projections.gender?.labels['女']?.share, 0.6);
  });

  test('无对应的年龄档不并入任何目标档', () => {
    const age = portrait.projections.age;
    // 21~25 岁横跨 18-23 与 24-30，按区间重叠拆分：3/5 与 2/5
    assert.ok(Math.abs((age?.labels['18-23']?.share ?? 0) - 0.08 * 3 / 5) < 1e-9);
    assert.ok(Math.abs((age?.labels['24-30']?.share ?? 0) - (0.08 * 2 / 5 + 0.15)) < 1e-9);
    // 0~15 岁无对应目标档，不并入任何档位
    assert.ok((age?.labels['18-23']?.share ?? 0) < 0.05, '0~15 岁不应被并入 18-23');
    const unmapped = portrait.issues?.find((i) => i.kind === 'unmapped-value');
    assert.ok(unmapped, '缺少未映射取值的问题记录');
  });

  test('京东策略人群投影到统一词表', () => {
    assert.ok(
      Math.abs((portrait.projections.strategy_segment?.labels['Z世代']?.share ?? 0) - 0.09) < 1e-9,
    );
  });
});

const productPath = await writeXlsx(join(dir, 'products.xlsx'), 'Sheet1', [
  ['款号', '商品品牌', '新老品', '年份', '中类', '小类', '吊牌价', '天猫id', '年龄段', '商品定位', '推广群组', '未知新列'],
  ['SPU-TEST-001', '演示品牌', '新品', '2026', '短袖T恤', 'T恤', '199', '123456', '18-24岁', 'ACCESS', 'A组', 'xx'],
  ['SPU-TEST-001', '演示品牌', '新品', '2026', '短袖T恤', 'T恤', '199', '123456', '18-24岁', 'ACCESS', 'A组', 'yy'],
  ['SPU-TEST-002', '演示品牌', '新品', '2026', '羽绒服', '短羽绒服', '599', '789012', '25-30岁', 'CORE', 'B组', 'zz'],
]);

const productResult = await normalizeProductTable(productPath);

describe('商品宽表归一化', () => {
  const result = productResult;

  test('SKU 级数据去重到款号级', () => {
    assert.equal(result.products.length, 2);
  });

  test('字段目录驱动的字段被正确落位', () => {
    const tshirt = result.products.find((p) => p.attributes?.['category_l3']?.includes('T恤'));
    assert.ok(tshirt);
    assert.equal(tshirt.price?.tagPrice, 199);
    assert.ok(tshirt.attributes?.['platform_product_id']?.includes('123456'));
  });

  test('人工定位字段不进入预测可见的属性集', () => {
    const tshirt = result.products[0];
    assert.ok(tshirt);
    assert.equal(
      tshirt.predictionAttributes?.['target_age'],
      undefined,
      '人工字段不应出现在预测可见属性中',
    );
    assert.deepEqual(tshirt.comparisonOnly?.['target_age'], ['18-24岁']);
    assert.deepEqual(tshirt.comparisonOnly?.['product_positioning'], ['ACCESS']);
  });

  test('未知列不丢失，进入 extra', () => {
    const tshirt = result.products[0];
    assert.ok(tshirt);
    assert.ok('未知新列' in (tshirt.extra ?? {}), '未知列应进入 extra');
  });

  test('预测属性集合不含人工字段', () => {
    for (const product of result.products) {
      for (const key of Object.keys(product.predictionAttributes ?? {})) {
        assert.ok(
          !['target_age', 'product_positioning', 'promo_group', 'product_group', 'scene'].includes(key),
          `${key} 不应出现在预测属性中`,
        );
      }
    }
  });
});

const channelPath = await writeXlsx(join(dir, 'channels.xlsx'), 'Sheet1', [
  ['渠道品牌', '一级渠道', '店铺编码', '店铺', '平台', '渠道类型', '渠道等级', '城市', '门店状态', '开店时间'],
  ['演示品牌', '搜索渠道', 'D10001', '演示天猫旗舰店', '天猫', '天猫', '旗舰店', '上海', '营业', '2020-01-01'],
  ['演示品牌', '内容渠道', 'D20001', '演示抖音账号', '抖音', '抖音', '核心店', '广州', '营业', '2021-06-01'],
]);

const channelResult = await normalizeChannelTable(channelPath);

describe('渠道宽表归一化', () => {
  const result = channelResult;

  test('解析出渠道记录', () => {
    assert.equal(result.channels.length, 2);
    const tmall = result.channels.find((c) => c.platform === '天猫');
    assert.equal(tmall?.channelId, 'D10001');
    assert.equal(tmall?.channelType, '天猫');
    assert.equal(tmall?.channelGrade, '旗舰店');
    assert.equal(tmall?.city, '上海');
  });
});

describe('复核补强：spill 按区间重叠拆分', () => {
  test('天猫 [18,24] 按 6/7 与 1/7 拆入两个目标档', async () => {
    const path = await tmallPortraitXlsx(join(dir, 'spill.xlsx'), [
      ['预测年龄', '[18,24]', '30.00%'],
      ['预测年龄', '[30,34]', '10.00%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, { entityType: 'channel' });
    const age = portrait.projections.age;
    // [18,24]：18-23 重叠 6 岁、24-30 重叠 1 岁
    assert.ok(Math.abs((age?.labels['18-23']?.share ?? 0) - 0.3 * 6 / 7) < 1e-9);
    assert.ok(Math.abs((age?.labels['24-30']?.share ?? 0) - (0.3 * 1 / 7 + 0.1 * 1 / 5)) < 1e-9);
    // [30,34]：31-40 重叠 4 岁、24-30 重叠 1 岁
    assert.ok(Math.abs((age?.labels['31-40']?.share ?? 0) - 0.1 * 4 / 5) < 1e-9);
    assert.ok(Math.abs((age?.labels['24-30']?.share ?? 0) - (0.3 * 1 / 7 + 0.1 * 1 / 5)) < 1e-9);
  });

  test('抖音完整落在单档的源档不被拆分', () => {
    const path = douyinPortraitCsv(join(dir, 'nospill.csv'), '演示门店', '2026-10', [
      ['预测年龄段', '24-30', '26.14%', '196.9'],
    ]);
    const portrait = normalizeDouyinPortrait(path, { entityType: 'channel' });
    assert.ok(
      Math.abs((portrait.projections.age?.labels['24-30']?.share ?? 0) - 0.2614) < 1e-9,
    );
  });
});

describe('复核补强：TGI 加权平均', () => {
  test('两个源档合并到同一目标档时，TGI 按占比加权平均', () => {
    const path = douyinPortraitCsv(join(dir, 'tgi.csv'), '演示门店', '2026-10', [
      ['预测年龄段', '18-19', '2.79%', '93.73368817435292'],
      ['预测年龄段', '20-23', '9.74%', '151.2182799322709'],
    ]);
    const portrait = normalizeDouyinPortrait(path, { entityType: 'channel' });
    const merged = portrait.projections.age?.labels['18-23'];
    assert.ok(merged);
    const expected =
      (93.73368817435292 * 0.0279 + 151.2182799322709 * 0.0974) / 0.1253;
    assert.ok(Math.abs((merged.tgi ?? 0) - expected) < 1e-9, `TGI 加权平均不符: ${merged.tgi}`);
  });

  test('缺 TGI 的源项不参与加权平均', () => {
    const path = douyinPortraitCsv(join(dir, 'tgi2.csv'), '演示门店', '2026-10', [
      ['预测性别', '男', '10.00%', '90'],
      ['预测性别', '女', '90.00%', ''],
    ]);
    const portrait = normalizeDouyinPortrait(path, { entityType: 'channel' });
    const male = portrait.projections.gender?.labels['男'];
    assert.equal(male?.tgi, 90);
  });
});

describe('复核补强：标签命名空间前缀', () => {
  test('通配模式匹配的维度带原生维度名前缀，避免同名覆盖', async () => {
    const path = await tmallPortraitXlsx(join(dir, 'ns.xlsx'), [
      ['奶粉价格段偏好', '0-49元', '10.00%'],
      ['彩妆价格段偏好', '0-29元', '20.00%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, { entityType: 'channel' });
    const band = portrait.projections.category_price_band;
    assert.ok(band?.labels['奶粉价格段偏好·0-49元']);
    assert.ok(band?.labels['彩妆价格段偏好·0-29元']);
  });
});

describe('复核补强：SKU 去重保留首行', () => {
  test('同款号多行时保留首行取值并记录冲突', async () => {
    const path = await writeXlsx(join(dir, 'sku.xlsx'), 'Sheet1', [
      ['款号', '吊牌价', '商品定位'],
      ['SPU-1', '199', 'FIRST'],
      ['SPU-1', '299', 'SECOND'],
    ]);
    const result = await normalizeProductTable(path);
    assert.equal(result.products.length, 1);
    assert.equal(result.products[0]?.price?.tagPrice, 199);
    assert.deepEqual(result.products[0]?.comparisonOnly?.['product_positioning'], ['FIRST']);
    assert.ok(result.issues.some((i) => i.kind === 'conflict' && i.sourceLabel === 'SPU-1'));
  });
});

describe('复核补强：归一化入口的 entityId 与 month', () => {
  test('抖音从表头列名解析实体与月份区间', () => {
    const path = douyinPortraitCsv(
      join(dir, 'entity.csv'),
      '演示门店',
      '2507-2606',
      [['预测性别', '男', '50%', '100']],
    );
    const portrait = normalizeDouyinPortrait(path, { entityType: 'channel' });
    assert.equal(portrait.entityId, '演示门店');
    assert.equal(portrait.month, '2025-07~2026-06');
  });

  test('显式传入的 entityId 优先于文件名解析', async () => {
    const path = await tmallPortraitXlsx(join(dir, 'override.xlsx'), [
      ['预测性别', '女', '60%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, {
      entityType: 'channel',
      entityId: '显式实体',
      month: '2026-03',
    });
    assert.equal(portrait.entityId, '显式实体');
    assert.equal(portrait.month, '2026-03');
  });
});

describe('复核补强：错误路径必须明确报错', () => {
  test('空文件抛 parse-error', async () => {
    const path = join(dir, 'empty.csv');
    writeFileSync(path, '', 'utf8');
    assert.throws(() => normalizeDouyinPortrait(path, {}), /为空或无法解析/);
  });

  test('只有表头没有数据行时抛错', async () => {
    const path = writeCsv(join(dir, 'headeronly.csv'), [['标签类型', '标签', 'X-占比']]);
    assert.throws(() => normalizeDouyinPortrait(path, {}), /只有表头/);
  });

  test('缺少占比列时抛 missing-field', () => {
    const path = writeCsv(join(dir, 'noshare.csv'), [
      ['标签类型', '标签'],
      ['预测性别', '男'],
    ]);
    assert.throws(() => normalizeDouyinPortrait(path, {}), /占比/);
  });

  test('天猫 sheet 名不符时抛错', async () => {
    const path = await writeXlsx(join(dir, 'wrongsheet.xlsx'), '其它', [['a', 'b']]);
    await assert.rejects(
      () => normalizeTmallPortrait(path, {}),
      (error: unknown) => (error as { name?: string }).name === 'NormalizationError',
    );
  });

  test('京东缺少必要列时抛错', async () => {
    const path = await writeXlsx(join(dir, 'wrongcols.xlsx'), 'Sheet0', [['无关列', 'x']]);
    await assert.rejects(() => normalizeJdPortrait(path, {}), /缺少必要列/);
  });
});

describe('复核补强：错误路径覆盖矩阵补全', () => {
  test('天猫只有表头时抛错', async () => {
    const path = await writeXlsx(join(dir, 'tmall-headeronly.xlsx'), '明细', [
      ['标签类型', '一级标签(标签值)', '占比'],
    ]);
    await assert.rejects(() => normalizeTmallPortrait(path, {}), /只有表头/);
  });

  test('京东只有表头时抛错', async () => {
    const path = await writeXlsx(join(dir, 'jd-headeronly.xlsx'), 'Sheet0', [
      ['标签名', '枚举值', '占比', 'TGI'],
    ]);
    await assert.rejects(() => normalizeJdPortrait(path, {}), /只有表头/);
  });

  test('商品表只有表头时抛错', async () => {
    const path = await writeXlsx(join(dir, 'product-headeronly.xlsx'), 'Sheet1', [
      ['款号', '吊牌价'],
    ]);
    await assert.rejects(() => normalizeProductTable(path), /只有表头/);
  });

  test('渠道表只有表头时抛错', async () => {
    const path = await writeXlsx(join(dir, 'channel-headeronly.xlsx'), 'Sheet1', [
      ['店铺编码', '店铺'],
    ]);
    await assert.rejects(() => normalizeChannelTable(path), /只有表头/);
  });

  test('占比列全部无法解析时抛错，不静默返回空画像', () => {
    const path = writeCsv(join(dir, 'badtype.csv'), [
      ['标签类型', '标签', 'X-占比', 'X-tgi'],
      ['预测性别', '男', '不是数字', '不是数字'],
      ['预测性别', '女', '也不是', '也不是'],
    ]);
    assert.throws(() => normalizeDouyinPortrait(path, {}), /无法解析出任何数值/);
  });

  test('部分行类型不符时记 error 级问题并保留可解析的行', () => {
    const path = writeCsv(join(dir, 'partialbad.csv'), [
      ['标签类型', '标签', 'X-占比', 'X-tgi'],
      ['预测性别', '男', '不是数字', '不是数字'],
      ['预测性别', '女', '60%', '120'],
    ]);
    const portrait = normalizeDouyinPortrait(path, {});
    const issue = portrait.issues?.find((i) => i.kind === 'parse-error');
    assert.ok(issue, '应记录 parse-error 问题');
    assert.equal(issue.severity, 'error');
    assert.equal(portrait.projections.gender?.labels['男'], undefined, '坏行不应出现在投影中');
    assert.ok(
      Math.abs((portrait.projections.gender?.labels['女']?.share ?? 0) - 0.6) < 1e-9,
      '可解析的行应正常投影',
    );
  });

  test('零字节 XLSX 抛 NormalizationError 而非底层库的原始错误', async () => {
    const path = join(dir, 'zero.xlsx');
    writeFileSync(path, '');
    await assert.rejects(
      () => normalizeTmallPortrait(path, {}),
      (error: Error) => {
        assert.equal(error.name, 'NormalizationError');
        return true;
      },
    );
  });

  test('天猫消费能力在方向确认后正常投影', async () => {
    const path = await tmallPortraitXlsx(join(dir, 'spending.xlsx'), [
      ['预测购买力', 'L5', '10.00%'],
      ['预测购买力', 'L1', '5.00%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, { entityType: 'channel' });
    const power = portrait.projections.spending_power;
    assert.ok(Math.abs((power?.labels['极高']?.share ?? 0) - 0.1) < 1e-9);
    assert.ok(Math.abs((power?.labels['极低']?.share ?? 0) - 0.05) < 1e-9);
  });
});

describe('第四轮补强：错误类型与 kind 的完整断言', () => {
  const isNormalizationError = (error: unknown, kind: string): boolean => {
    const e = error as { name?: string; kind?: string };
    return e?.name === 'NormalizationError' && e?.kind === kind;
  };

  test('抖音：占比列损坏但 TGI 正常时仍抛错，不伪造 share=0', () => {
    const path = writeCsv(join(dir, 'dy-badshare.csv'), [
      ['标签类型', '标签', 'X-占比', 'X-tgi'],
      ['预测性别', '男', '不是数字', '90'],
      ['预测性别', '女', '也是坏的', '120'],
    ]);
    assert.throws(
      () => normalizeDouyinPortrait(path, {}),
      (error: unknown) => isNormalizationError(error, 'parse-error'),
    );
  });

  test('京东：占比列损坏但 TGI 正常时仍抛错', async () => {
    const path = await jdPortraitXlsx(join(dir, 'jd-badshare.xlsx'), [
      ['性别', '女', '不是数字', '120'],
      ['性别', '男', '也是坏的', '85'],
    ]);
    await assert.rejects(
      () => normalizeJdPortrait(path, {}),
      (error: unknown) => isNormalizationError(error, 'parse-error'),
    );
  });

  test('天猫：占比列全部不可解析时抛 parse-error', async () => {
    const path = await tmallPortraitXlsx(join(dir, 'tmall-badshare.xlsx'), [
      ['预测性别', '女', '不是数字'],
      ['预测性别', '男', '也是坏的'],
    ]);
    await assert.rejects(
      () => normalizeTmallPortrait(path, {}),
      (error: unknown) => isNormalizationError(error, 'parse-error'),
    );
  });

  test('天猫：部分行不可解析时记 error 级 parse-error', async () => {
    const path = await tmallPortraitXlsx(join(dir, 'tmall-partial.xlsx'), [
      ['预测性别', '女', '不是数字'],
      ['预测性别', '男', '60%'],
    ]);
    const portrait = await normalizeTmallPortrait(path, {});
    const issue = portrait.issues?.find((i) => i.kind === 'parse-error');
    assert.ok(issue);
    assert.equal(issue.severity, 'error');
    assert.equal(portrait.projections.gender?.labels['女'], undefined, '坏行不应出现在投影中');
  });

  test('京东：部分行不可解析时记 error 级 parse-error', async () => {
    const path = await jdPortraitXlsx(join(dir, 'jd-partial.xlsx'), [
      ['性别', '女', '不是数字', '120'],
      ['性别', '男', '0.4', '85'],
    ]);
    const portrait = await normalizeJdPortrait(path, {});
    const issue = portrait.issues?.find((i) => i.kind === 'parse-error');
    assert.ok(issue);
    assert.equal(issue.severity, 'error');
    assert.equal(portrait.projections.gender?.labels['女'], undefined, '坏行不应出现在投影中');
  });

  test('商品表：空表抛 parse-error', async () => {
    const path = await writeXlsx(join(dir, 'product-empty.xlsx'), 'Sheet1', []);
    await assert.rejects(
      () => normalizeProductTable(path),
      (error: unknown) => isNormalizationError(error, 'parse-error'),
    );
  });

  test('渠道表：空表抛 parse-error', async () => {
    const path = await writeXlsx(join(dir, 'channel-empty.xlsx'), 'Sheet1', []);
    await assert.rejects(
      () => normalizeChannelTable(path),
      (error: unknown) => isNormalizationError(error, 'parse-error'),
    );
  });

  test('商品表：缺主键列抛 missing-field', async () => {
    const path = await writeXlsx(join(dir, 'product-nokey.xlsx'), 'Sheet1', [
      ['吊牌价', '商品定位'],
      ['199', 'ACCESS'],
    ]);
    await assert.rejects(
      () => normalizeProductTable(path),
      (error: unknown) => isNormalizationError(error, 'missing-field'),
    );
  });

  test('渠道表：缺主键列抛 missing-field', async () => {
    const path = await writeXlsx(join(dir, 'channel-nokey.xlsx'), 'Sheet1', [
      ['店铺', '平台'],
      ['演示旗舰店', '天猫'],
    ]);
    await assert.rejects(
      () => normalizeChannelTable(path),
      (error: unknown) => isNormalizationError(error, 'missing-field'),
    );
  });

  test('商品表：行主键为空时记 error 级 missing-field', async () => {
    const path = await writeXlsx(join(dir, 'product-blankkey.xlsx'), 'Sheet1', [
      ['款号', '吊牌价'],
      ['', '199'],
      ['SPU-OK', '299'],
    ]);
    const result = await normalizeProductTable(path);
    assert.equal(result.products.length, 1);
    const issue = result.issues.find((i) => i.kind === 'missing-field');
    assert.ok(issue);
    assert.equal(issue.severity, 'error');
  });

  test('渠道表：行主键为空时记 error 级 missing-field', async () => {
    const path = await writeXlsx(join(dir, 'channel-blankkey.xlsx'), 'Sheet1', [
      ['店铺编码', '店铺'],
      ['', '演示店'],
      ['D10001', '演示旗舰店'],
    ]);
    const result = await normalizeChannelTable(path);
    assert.equal(result.channels.length, 1);
    const issue = result.issues.find((i) => i.kind === 'missing-field');
    assert.ok(issue);
    assert.equal(issue.severity, 'error');
  });

  test('文件不存在时保留 ENOENT 语义，不包装成 parse-error', async () => {
    const missing = join(dir, 'not-exists.xlsx');
    await assert.rejects(
      () => normalizeTmallPortrait(missing, {}),
      (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT',
    );
  });
});

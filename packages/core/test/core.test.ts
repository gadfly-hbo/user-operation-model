import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BandResolver,
  DimensionRegistry,
  FieldCatalog,
  MappingTable,
  AGE_BAND_RULES,
  CORE_DIMENSION_IDS,
  DIMENSIONS,
  TAG_MAPPINGS,
  UNIFIED_AGE_BANDS,
} from '../src/index.js';

describe('统一维度集', () => {
  const registry = new DimensionRegistry();

  test('目录自身通过结构校验', () => {
    assert.deepEqual(registry.validate(), []);
  });

  test('六维主干恰好是性别、年龄、策略人群、消费能力、城市等级、人生阶段', () => {
    assert.deepEqual(CORE_DIMENSION_IDS, [
      'gender',
      'age',
      'strategy_segment',
      'spending_power',
      'city_tier',
      'life_stage',
    ]);
  });

  test('主干维度都定义了统一词表', () => {
    for (const id of CORE_DIMENSION_IDS) {
      const spec = registry.get(id);
      assert.ok(spec, `主干维度缺失: ${id}`);
      assert.ok(spec.labels && spec.labels.length > 0, `主干维度缺词表: ${id}`);
    }
  });

  test('扩展维度不与主干维度重名', () => {
    const ids = registry.list().map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('跨平台标签映射', () => {
  const registry = new DimensionRegistry();
  const mappings = new MappingTable();

  test('映射表与维度目录交叉校验通过', () => {
    assert.deepEqual(mappings.validate(registry), []);
  });

  test('不存在同一源标签映射到多个目标的冲突', () => {
    assert.deepEqual(mappings.conflicts(), []);
  });

  test('泛人群体系与服饰体系禁止互转', () => {
    const general = registry.get('strategy_segment')?.labels ?? [];
    const apparel = registry.get('apparel_segment')?.labels ?? [];
    for (const mapping of mappings.list()) {
      if (mapping.targetDimension === 'apparel_segment') {
        assert.ok(
          !general.includes(mapping.targetLabel),
          `服饰体系标签 ${mapping.targetLabel} 不得出现在泛人群词表中`,
        );
      }
      if (mapping.targetDimension === 'strategy_segment') {
        assert.ok(
          !apparel.includes(mapping.targetLabel),
          `泛人群标签 ${mapping.targetLabel} 不得出现在服饰体系词表中`,
        );
      }
    }
  });

  test('三平台的策略人群都映射到同一统一词表', () => {
    for (const platform of ['douyin', 'tmall', 'jd']) {
      const resolved = TAG_MAPPINGS.filter(
        (m) => m.platform === platform && m.targetDimension === 'strategy_segment',
      );
      assert.ok(resolved.length > 0, `${platform} 缺少策略人群映射`);
      for (const mapping of resolved) {
        assert.ok(
          registry.get('strategy_segment')?.labels?.includes(mapping.targetLabel),
          `${platform} 目标标签不在统一词表: ${mapping.targetLabel}`,
        );
      }
    }
  });

  test('待确认的映射不参与解析', () => {
    const table = new MappingTable();
    assert.equal(table.resolve('tmall', '预测购买力', 'L3'), undefined);
    assert.equal(table.resolveAll('tmall', '预测购买力', 'L3').length, 1);
  });

  test('已确认的映射可被解析', () => {
    assert.equal(
      mappings.resolve('douyin', '八大消费群体', '都市银发')?.targetLabel,
      '银发族',
    );
    assert.equal(
      mappings.resolve('jd', '十大靶群', '都市Z世代')?.targetLabel,
      'Z世代',
    );
  });
});

describe('年龄段归并规则', () => {
  const bands = new BandResolver();

  test('规则自身合法：目标档位在统一词表内', () => {
    for (const rule of bands.list()) {
      if (rule.targetBand === null) continue;
      assert.ok(
        UNIFIED_AGE_BANDS.includes(rule.targetBand),
        `目标档位不在统一词表: ${rule.platform}/${rule.sourceBand} → ${rule.targetBand}`,
      );
    }
  });

  test('同一平台的源档位不重复', () => {
    const seen = new Set<string>();
    for (const rule of bands.list()) {
      const key = `${rule.platform}/${rule.sourceBand}`;
      assert.ok(!seen.has(key), `源档位重复: ${key}`);
      seen.add(key);
    }
  });

  test('精度受损的规则必须说明原因', () => {
    for (const rule of bands.list()) {
      if (rule.precision === 'exact') continue;
      assert.ok(
        rule.spill !== undefined || (rule.note !== undefined && rule.note.length > 0),
        `精度受损但未说明: ${rule.platform}/${rule.sourceBand}`,
      );
    }
  });

  test('跨目标边界的源档位被标记为 partial', () => {
    assert.equal(bands.resolve('tmall', '[18,24]')?.precision, 'partial');
    assert.equal(bands.resolve('tmall', '[18,24]')?.spill, '24-30');
    assert.equal(bands.resolve('jd', '21~25岁')?.precision, 'partial');
  });

  test('无对应的源档位标记为 unmapped 且不并入任何目标', () => {
    const rule = bands.resolve('jd', '0~15岁');
    assert.equal(rule?.precision, 'unmapped');
    assert.equal(rule?.targetBand, null);
  });

  test('三平台均有归并规则', () => {
    assert.deepEqual(bands.platforms().sort(), ['douyin', 'jd', 'tmall']);
  });
});

describe('商品字段目录与背对背隔离', () => {
  const catalog = new FieldCatalog();

  test('字段目录自身通过结构校验', () => {
    assert.deepEqual(catalog.validate(), []);
  });

  test('商品部人工定位字段被排除在预测路径之外', () => {
    const manual = [
      'target_age',
      'product_positioning',
      'promo_group',
      'product_group',
      'scene',
      'extension',
      'theme',
      'story_line',
    ];
    for (const key of manual) {
      assert.ok(catalog.has(key), `人工定位字段未登记: ${key}`);
      assert.equal(catalog.isExcludedFromPrediction(key), true, `${key} 不应进入预测路径`);
    }
  });

  test('客观属性可用于预测', () => {
    const objective = ['silhouette', 'fabric', 'fab', 'category_l2', 'category_l3', 'tag_price'];
    for (const key of objective) {
      assert.equal(catalog.isExcludedFromPrediction(key), false, `${key} 应可用于预测`);
    }
  });

  test('性别修正可用于预测但附带回算说明', () => {
    const field = catalog.get('gender_correction');
    assert.ok(field);
    assert.ok(field.usage.includes('prediction'));
    assert.ok(field.note?.includes('同类历史款'));
  });

  test('未知字段默认排除在预测路径之外', () => {
    assert.equal(catalog.isExcludedFromPrediction('not_registered_field'), true);
  });
});

describe('可扩展性', () => {
  test('可运行时追加维度', () => {
    const registry = new DimensionRegistry();
    const before = registry.list().length;
    registry.register({
      id: 'custom_dimension',
      label: '自定义维度',
      kind: 'nominal',
      core: false,
      platforms: ['douyin'],
      labels: ['A', 'B'],
    });
    assert.equal(registry.list().length, before + 1);
    assert.equal(registry.get('custom_dimension')?.labels?.length, 2);
  });

  test('重复维度 id 被拒绝', () => {
    const registry = new DimensionRegistry();
    assert.throws(
      () =>
        registry.register({
          id: 'gender',
          label: '重复',
          kind: 'nominal',
          core: false,
          platforms: [],
        }),
      /维度已存在/,
    );
  });

  test('可运行时追加映射并立即可解析', () => {
    const table = new MappingTable();
    table.add({
      id: 'custom.map',
      platform: 'douyin',
      sourceDimension: '自定义维度',
      sourceLabel: '甲',
      targetDimension: 'gender',
      targetLabel: '女',
      confidence: 'manual',
      status: 'confirmed',
    });
    assert.equal(table.resolve('douyin', '自定义维度', '甲')?.targetLabel, '女');
  });

  test('可运行时追加商品字段', () => {
    const catalog = new FieldCatalog();
    const before = catalog.predictionKeys().length;
    catalog.add({
      key: 'custom_attr',
      label: '自定义属性',
      type: 'string',
      required: false,
      usage: ['prediction', 'comparison'],
      sources: ['自定义列'],
    });
    assert.equal(catalog.predictionKeys().length, before + 1);
    assert.equal(catalog.findBySource('自定义列')[0]?.key, 'custom_attr');
  });

  test('可按源列名反查字段', () => {
    const catalog = new FieldCatalog();
    assert.equal(catalog.findBySource('款号')[0]?.key, 'spu');
    assert.equal(catalog.findBySource('面料')[0]?.key, 'fabric');
  });
});

describe('目录规模', () => {
  test('维度、映射、年龄规则、商品字段均有实质规模', () => {
    assert.ok(DIMENSIONS.length >= 30, `维度过少: ${DIMENSIONS.length}`);
    assert.ok(TAG_MAPPINGS.length >= 60, `映射过少: ${TAG_MAPPINGS.length}`);
    assert.ok(AGE_BAND_RULES.length >= 30, `年龄规则过少: ${AGE_BAND_RULES.length}`);
  });
});

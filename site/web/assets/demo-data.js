/**
 * 人群运营工作台 · 合成演示数据。
 *
 * 全部为虚构值：款号、渠道名、人群标签、金额、样本量、批次规模均为编造，
 * 不含任何真实业务数据，也不反映本机数据集的真实规模与目录结构。
 * 数据源缺失原因只描述「缺哪类文件」，不写出本地路径。
 */
window.DEMO = (() => {
  const dims = ['性别', '年龄段', '策略人群', '消费能力', '城市等级', '人生阶段'];

  /* ── 选品评审台 ─────────────────────────────────────────── */
  const reviewBatch = {
    name: '2026 秋冬选品评审 · 第 3 轮',
    month: '2026-10',
    candidates: [
      {
        spu: 'SPU-2601',
        name: '重磅圆领短袖 T 恤',
        category: '短袖 T 恤',
        price: '¥199',
        status: '共识款',
        statusTone: 'consensus',
        similarity: 86,
        manual: {
          position: '18–30 岁城市男性，通勤与周末均穿',
          oldNew: '老客 40% / 新客 60%',
          channel: '抖音直播 + 天猫旗舰店',
          owner: '商品企划 A',
        },
        predicted: {
          segments: [
            { name: '都市蓝领', share: 0.31, confidence: 0.81 },
            { name: '新锐白领', share: 0.24, confidence: 0.74 },
            { name: '小镇青年', share: 0.18, confidence: 0.66 },
          ],
          riskFlags: [],
        },
        diff: [
          { dim: '性别', manual: '男 82%', algo: '男 79%', align: 'high', delta: 3 },
          { dim: '年龄段', manual: '18–30', algo: '25–34', align: 'mid', delta: 11 },
          { dim: '策略人群', manual: '都市蓝领', algo: '都市蓝领', align: 'high', delta: 0 },
          { dim: '消费能力', manual: '中', algo: '中', align: 'high', delta: 2 },
          { dim: '城市等级', manual: '一二线', algo: '一二线', align: 'high', delta: 4 },
          { dim: '人生阶段', manual: '职场初期', algo: '职场初期', align: 'high', delta: 1 },
        ],
        decision: '首单 8,000 件，深备 30%；首发走抖音直播 + 天猫旗舰店',
        rationale: '两侧策略人群完全一致，年龄段有 11pp 偏移但不改变客群结构。建议按老客 40% 备货。',
        reviewState: '已评审',
        action: '放量',
      },
      {
        spu: 'SPU-2602',
        name: '加厚连帽卫衣',
        category: '连帽卫衣',
        price: '¥329',
        status: '盲区款',
        statusTone: 'blind',
        similarity: 62,
        manual: {
          position: '25–35 岁男性，冬季通勤外套为主',
          oldNew: '老客 65% / 新客 35%',
          channel: '线下门店为主',
          owner: '商品企划 B',
        },
        predicted: {
          segments: [
            { name: '都市中产', share: 0.34, confidence: 0.88 },
            { name: '资深白领', share: 0.22, confidence: 0.72 },
            { name: '精致妈妈', share: 0.15, confidence: 0.58 },
          ],
          riskFlags: [],
        },
        diff: [
          { dim: '性别', manual: '男 70%', algo: '男 44%', align: 'low', delta: 26 },
          { dim: '年龄段', manual: '25–35', algo: '30–40', align: 'mid', delta: 9 },
          { dim: '策略人群', manual: '（未定义）', algo: '都市中产', align: 'low', delta: 34 },
          { dim: '消费能力', manual: '中', algo: '高', align: 'mid', delta: 18 },
          { dim: '城市等级', manual: '二三线', algo: '一二线', align: 'low', delta: 22 },
          { dim: '人生阶段', manual: '职场中期', algo: '家庭期', align: 'low', delta: 20 },
        ],
        decision: '小单快反：首单 400 件，锁定 30% 面料；先在私域做定向测款',
        rationale: '算法侧人群与商品部判断完全错位，但置信度与画像覆盖率都足够高，值得用小单验证而非直接看衰。',
        reviewState: '待评审',
        action: '测款',
      },
      {
        spu: 'SPU-2603',
        name: '轻量短羽绒服',
        category: '短羽绒服',
        price: '¥599',
        status: '争议款',
        statusTone: 'dispute',
        similarity: 38,
        manual: {
          position: '28–40 岁城市女性，中高端通勤',
          oldNew: '老客 55% / 新客 45%',
          channel: '天猫旗舰店 + 线下核心店',
          owner: '商品企划 C',
        },
        predicted: {
          segments: [
            { name: '小镇中年', share: 0.29, confidence: 0.71 },
            { name: '小镇中产', share: 0.24, confidence: 0.68 },
            { name: '都市银发', share: 0.16, confidence: 0.54 },
          ],
          riskFlags: ['画像覆盖率不足'],
        },
        diff: [
          { dim: '性别', manual: '女 75%', algo: '女 58%', align: 'low', delta: 17 },
          { dim: '年龄段', manual: '28–40', algo: '35–50', align: 'low', delta: 13 },
          { dim: '策略人群', manual: '都市中产', algo: '小镇中年', align: 'low', delta: 29 },
          { dim: '消费能力', manual: '高', algo: '中', align: 'mid', delta: 16 },
          { dim: '城市等级', manual: '一二线', algo: '三四线', align: 'low', delta: 25 },
          { dim: '人生阶段', manual: '职场中期', algo: '家庭期', align: 'mid', delta: 12 },
        ],
        decision: '降级首发：首单压到 3,000 件，要求商品部补充专属流量资源；面料锁定以便快反',
        rationale: '算法判定该款主要卖给下沉市场中年客群，与商品部定位的高线城市通勤客差异显著；城市等级与策略人群两条同时偏离，判定为主观过度乐观。',
        reviewState: '待评审',
        action: '降级',
      },
      {
        spu: 'SPU-2604',
        name: '多袋工装直筒裤',
        category: '工装裤',
        price: '¥289',
        status: '异化款',
        statusTone: 'diverge',
        similarity: 74,
        manual: {
          position: '25–40 岁城市男性，机能风穿搭',
          oldNew: '老客 30% / 新客 70%',
          channel: '抖音短视频 + 达人分销',
          owner: '商品企划 D',
        },
        predicted: {
          segments: [
            { name: 'Z世代', share: 0.36, confidence: 0.79 },
            { name: '新锐白领', share: 0.2, confidence: 0.64 },
            { name: '都市蓝领', share: 0.19, confidence: 0.6 },
          ],
          riskFlags: [],
        },
        diff: [
          { dim: '性别', manual: '男 78%', algo: '男 74%', align: 'high', delta: 4 },
          { dim: '年龄段', manual: '25–40', algo: '18–28', align: 'mid', delta: 9 },
          { dim: '策略人群', manual: '机能风人群', algo: 'Z世代', align: 'mid', delta: 18 },
          { dim: '消费能力', manual: '中', algo: '中', align: 'high', delta: 3 },
          { dim: '城市等级', manual: '二三线', algo: '一二线', align: 'mid', delta: 14 },
          { dim: '人生阶段', manual: '职场初期', algo: '学生', align: 'low', delta: 19 },
        ],
        decision: '保留货品，拆成两个详情页版本做 AB 测试：机能风话术 / 校园通勤话术',
        rationale: '双方都看好，但沟通语言完全不同：商品部讲机能风，算法看到的是学生群体。货品没问题，话术错位。',
        reviewState: '待评审',
        action: '改话术',
      },
      {
        spu: 'SPU-2605',
        name: '羊毛混纺针织开衫',
        category: '针织开衫',
        price: '¥359',
        status: '待评审',
        statusTone: 'pending',
        similarity: null,
        manual: {
          position: '（商品部尚未提交）',
          oldNew: '（未提交）',
          channel: '（未提交）',
          owner: '商品企划 E',
        },
        predicted: {
          segments: [
            { name: '都市中产', share: 0.28, confidence: 0.6 },
            { name: '精致妈妈', share: 0.21, confidence: 0.52 },
          ],
          riskFlags: ['商品属性不完整'],
        },
        diff: [],
        decision: '等待商品部提交人工画像后进入比对',
        rationale: '算法侧预测缺少面料成分与版型字段，置信度不足，不足以作为结论。',
        reviewState: '阻塞',
        action: '',
      },
    ],
    dims,
  };

  /* ── 货渠匹配（工具 1） ─────────────────────────────────── */
  const matchChannels = [
    { id: 'CH01', name: '演示直播 A', type: '抖音直播', grade: '核心店' },
    { id: 'CH02', name: '演示直播 B', type: '抖音直播', grade: '标准店' },
    { id: 'CH03', name: '演示商品卡店', type: '抖音商品卡', grade: '旗舰店' },
    { id: 'CH04', name: '演示天猫旗舰店', type: '天猫', grade: '旗舰店' },
    { id: 'CH05', name: '演示京东店', type: '京东', grade: '核心店' },
    { id: 'CH06', name: '演示线下店 A', type: '实体店', grade: '核心店' },
    { id: 'CH07', name: '演示线下店 B', type: '实体店', grade: '标准店' },
    { id: 'CH08', name: '演示特卖渠道', type: '唯品会', grade: '临时特卖' },
  ];
  const matchProducts = [
    { id: 'SPU-2601', name: '重磅圆领短袖 T 恤', price: 199 },
    { id: 'SPU-2602', name: '加厚连帽卫衣', price: 329 },
    { id: 'SPU-2603', name: '轻量短羽绒服', price: 599 },
    { id: 'SPU-2604', name: '多袋工装直筒裤', price: 289 },
    { id: 'SPU-2606', name: '宽松落肩衬衫', price: 239 },
    { id: 'SPU-2607', name: '高腰直筒牛仔裤', price: 279 },
  ];
  // 矩阵 [商品][渠道] = 匹配分
  const matchMatrix = [
    [92, 88, 85, 61, 55, 79, 71, 34],
    [71, 69, 66, 74, 58, 62, 48, 31],
    [38, 35, 33, 46, 51, 72, 44, 28],
    [76, 81, 79, 52, 47, 55, 43, 26],
    [84, 86, 83, 58, 52, 68, 61, 30],
    [63, 58, 54, 69, 72, 66, 55, 41],
  ];
  const matchDetail = {
    positive: ['策略人群吻合', '年龄段吻合', '客单价区间吻合'],
    negative: ['城市等级偏离', '消费能力承接不足'],
    advice: '分货：建议主推；投流：建议加投；熔断：不建议',
    risks: ['该渠道画像样本量偏小', '季节因子未纳入'],
  };
  /**
   * 合成演示矩阵的配色分档（只作用于本页的合成示意数据）。
   * 正式匹配口径只在 packages/core 的 MATCH_CONFIG 里定义一处。
   */
  const demoBands = { a: 80, b: 60, fuse: 45 };
  const matchLegend = [
    { grade: 'A', label: `建议主推 · ≥ ${demoBands.a}`, tone: 'strong' },
    { grade: 'B', label: `建议微调 · ${demoBands.b}–${demoBands.a - 0.1}`, tone: 'mid' },
    { grade: 'C', label: `慎选 · ${demoBands.fuse}–${demoBands.b - 0.1}`, tone: 'weak' },
    { grade: '熔断', label: `不建议 · < ${demoBands.fuse}（C 级内）`, tone: 'none' },
  ];

  /* ── 新品预测（工具 2） ─────────────────────────────────── */
  const predict = {
    // 预测可用字段：仅客观属性
    input: {
      spu: 'SPU-2608',
      category: '连帽卫衣',
      season: '2026 秋冬',
      silhouette: '宽松落肩',
      fabric: '420g 重磅棉',
      priceBand: '¥300–400',
      ip: '无',
    },
    // 人工侧字段：可用于背对背的人工画像，但不得进入预测路径
    manualOnly: {
      selling: '防风保暖 / 通勤百搭',
      targetAudience: '（商品部人工填写）',
      newOldRatio: '（商品部人工填写）',
    },
    fieldLabels: {
      spu: '款号', category: '品类', season: '季节', silhouette: '版型',
      fabric: '面料', priceBand: '价格带', ip: 'IP 联名',
      selling: '卖点', targetAudience: '人工人群定位', newOldRatio: '人工新老客比例',
    },
    segments: [
      { name: '都市中产', share: 0.33, confidence: 0.86 },
      { name: '资深白领', share: 0.21, confidence: 0.73 },
      { name: '都市蓝领', share: 0.17, confidence: 0.61 },
    ],
    dims: [
      { dim: '性别', label: '男', share: 0.83 },
      { dim: '年龄段', label: '25–40', share: 0.46 },
      { dim: '策略人群', label: '都市中产', share: 0.33 },
      { dim: '消费能力', label: '高', share: 0.27 },
      { dim: '城市等级', label: '一二线', share: 0.58 },
      { dim: '人生阶段', label: '职场中期', share: 0.31 },
    ],
    similar: [
      { spu: 'SPU-2412', name: '同版型历史款', score: 0.82, note: '版型与面料高度相似' },
      { spu: 'SPU-2388', name: '同品类历史爆款', score: 0.71, note: '人群结构接近' },
      { spu: 'SPU-2201', name: '同面料历史款', score: 0.58, note: '面料相同但版型不同' },
    ],
    risks: ['可解释基线，非训练模型', '映射置信度偏低'],
    riskNote: '当前为可解释 baseline，不是已训练模型结论；正式公式冻结后需重跑回测。',
  };

  /* ── 渠道画像库 ─────────────────────────────────────────── */
  const channelProfiles = [
    { id: 'CH01', name: '演示直播 A', type: '抖音直播', platform: '抖音', month: '2026-10', coverage: 0.94, sample: 9640, top: ['男 62%', '25–34', '都市蓝领'] },
    { id: 'CH02', name: '演示直播 B', type: '抖音直播', platform: '抖音', month: '2026-10', coverage: 0.87, sample: 5310, top: ['女 57%', '18–28', 'Z世代'] },
    { id: 'CH04', name: '演示天猫旗舰店', type: '天猫', platform: '天猫', month: '2026-10', coverage: 0.91, sample: 32640, top: ['女 71%', '25–34', '都市中产'] },
    { id: 'CH05', name: '演示京东店', type: '京东', platform: '京东', month: '2026-10', coverage: 0.84, sample: 18920, top: ['男 66%', '30–40', '资深白领'] },
    { id: 'CH06', name: '演示线下店 A', type: '实体店', platform: '实体店', month: '2026-09', coverage: 0.88, sample: 6180, top: ['女 68%', '35–49', '小镇中年'] },
    { id: 'CH08', name: '演示特卖渠道', type: '唯品会', platform: '唯品会', month: '2026-10', coverage: 0.71, sample: 15720, top: ['女 64%', '35–49', '小镇中年'] },
  ];

  /* ── 商品画像库 ─────────────────────────────────────────── */
  const productProfiles = [
    { spu: 'SPU-2601', name: '重磅圆领短袖 T 恤', cat: '短袖 T 恤', month: '2026-10', coverage: 0.96, top: ['男 79%', '25–34', '都市蓝领'] },
    { spu: 'SPU-2602', name: '加厚连帽卫衣', cat: '连帽卫衣', month: '2026-10', coverage: 0.93, top: ['男 56%', '30–40', '都市中产'] },
    { spu: 'SPU-2603', name: '轻量短羽绒服', cat: '短羽绒服', month: '2026-09', coverage: 0.86, top: ['女 58%', '35–50', '小镇中年'] },
    { spu: 'SPU-2604', name: '多袋工装直筒裤', cat: '工装裤', month: '2026-10', coverage: 0.92, top: ['男 74%', '18–28', 'Z世代'] },
  ];

  /* ── 标签反查 ───────────────────────────────────────────── */
  const tagIndex = {
    strategy_segment: ['都市蓝领', '新锐白领', '资深白领', '都市中产', 'Z世代', '精致妈妈', '小镇中年', '都市银发'],
    city_tier: ['一线', '新一线', '二线', '三线', '四线', '五线'],
    spending_power: ['极高', '高', '中', '低', '极低'],
    gender: ['女', '男'],
  };
  const tagHits = {
    'strategy_segment|都市蓝领': [
      { entity: '演示直播 A', type: '渠道', share: 0.31, tgi: 142, month: '2026-10' },
      { entity: '重磅圆领短袖 T 恤', type: '商品', share: 0.28, tgi: 138, month: '2026-10' },
      { entity: '演示特卖渠道', type: '渠道', share: 0.19, tgi: 96, month: '2026-10' },
      { entity: '轻量短羽绒服', type: '商品', share: 0.12, tgi: 71, month: '2026-09' },
    ],
    'strategy_segment|资深白领': [
      { entity: '演示天猫旗舰店', type: '渠道', share: 0.26, tgi: 151, month: '2026-10' },
      { entity: '加厚连帽卫衣', type: '商品', share: 0.22, tgi: 133, month: '2026-10' },
    ],
    'city_tier|一线': [
      { entity: '演示天猫旗舰店', type: '渠道', share: 0.34, tgi: 128, month: '2026-10' },
      { entity: '多袋工装直筒裤', type: '商品', share: 0.22, tgi: 112, month: '2026-10' },
    ],
    'spending_power|高': [
      { entity: '演示天猫旗舰店', type: '渠道', share: 0.24, tgi: 119, month: '2026-10' },
    ],
    'gender|女': [
      { entity: '演示线下店 A', type: '渠道', share: 0.68, tgi: 137, month: '2026-09' },
      { entity: '轻量短羽绒服', type: '商品', share: 0.58, tgi: 92, month: '2026-09' },
    ],
  };

  /* ── 数据源管理 ─────────────────────────────────────────── */
  const datasource = {
    tools: [
      { name: 'list_channels', ok: true, note: '渠道清单已就绪' },
      { name: 'get_channel_portrait', ok: true, note: '渠道人群画像已就绪' },
      { name: 'get_brand_portrait', ok: false, note: '品牌人群画像未接入：缺少品牌级人群画像导出（当前只有品牌清单）' },
      { name: 'get_competitor_portrait', ok: false, note: '竞品人群画像未接入：缺少竞品人群画像导出' },
      { name: 'list_products', ok: true, note: '商品清单已就绪' },
      { name: 'get_product_dossier', ok: true, note: '商品宽表已就绪' },
      { name: 'get_product_portrait', ok: true, note: '单品画像部分就绪（覆盖少量款）' },
      { name: 'get_portrait_aggregate', ok: true, note: '仅品类层级可聚合' },
      { name: 'get_funnel', ok: false, note: '生命周期漏斗未接入：缺少按款按月的浏览／收藏／加购／购买／直接购买／退货数据' },
      { name: 'compare_product_channel', ok: true, note: '可产出逐维度差异' },
      { name: 'search_by_tag', ok: true, note: '反查命中正常' },
      { name: 'search_similar_products', ok: true, note: '相似款检索可用' },
      { name: 'list_member_features', ok: false, note: '会员特征字典未接入：缺少业务方案约定的会员字段表' },
      { name: 'get_retention_cohort', ok: false, note: 'Cohort 留存数据未接入：缺少新客首购月与次留数据' },
      { name: 'get_recency_distribution', ok: false, note: '老客 Recency 分布未接入：缺少老客距最近一次购买的天数分布' },
      { name: 'get_channel_flow_matrix', ok: false, note: '老客跨渠道流转矩阵未接入：缺少老客来源渠道与回流渠道配对数据' },
      { name: 'get_diagnosis', ok: false, note: '三大诊断数据未接入：缺少二回跃迁、召回毛利与清仓客次季转化数据' },
    ],
    batches: [
      { id: 'B-2026-10-03', source: '演示平台导出', rows: '1,842 行', status: '成功', at: '2026-11-02 09:12' },
      { id: 'B-2026-10-02', source: '演示商品主表', rows: '246 行', status: '成功', at: '2026-11-01 18:40' },
      { id: 'B-2026-09-07', source: '演示渠道主表', rows: '168 行', status: '成功', at: '2026-09-08 10:05' },
      { id: 'B-2026-09-01', source: '演示单品属性表', rows: '198 行', status: '成功', at: '2026-09-02 11:20' },
    ],
  };

  /* ── 留存与回购（需求三） ───────────────────────────────── */
  const retention = {
    structure: [
      { seg: '首购新客', buyers: 120000, share: '40%', mom: '+5%', yoy: '-2%', gmv: '¥1,800万', gmvShare: '36%', aov: '¥150', upt: '1.76' },
      { seg: '二回老客', buyers: 45000, share: '15%', mom: '+12%', yoy: '+8%', gmv: '¥900万', gmvShare: '18%', aov: '¥200', upt: '2.10' },
      { seg: '成熟活跃老客', buyers: 75000, share: '25%', mom: '-1%', yoy: '+4%', gmv: '¥1,600万', gmvShare: '32%', aov: '¥213', upt: '2.17' },
      { seg: '同季跨年老客', buyers: 30000, share: '10%', mom: '+20%', yoy: '+5%', gmv: '¥500万', gmvShare: '10%', aov: '¥166', upt: '1.84' },
      { seg: '休眠流失召回', buyers: 30000, share: '10%', mom: '-8%', yoy: '-15%', gmv: '¥200万', gmvShare: '4%', aov: '¥66', upt: '1.46' },
    ],
    cohorts: [
      { m: '2026-04', n: 8200, d30: 18.4, d60: 12.1, d90: 8.6, next: 6.2 },
      { m: '2026-05', n: 9100, d30: 19.1, d60: 12.8, d90: 9.1, next: 6.8 },
      { m: '2026-06', n: 11400, d30: 20.2, d60: 13.6, d90: 9.8, next: 7.4 },
      { m: '2026-07', n: 10200, d30: 17.3, d60: 11.2, d90: 7.9, next: null },
      { m: '2026-08', n: 7600, d30: 15.6, d60: 9.8, d90: null, next: null },
    ],
    recency: [
      { band: '1–30 天', buyers: 18000, share: '10%', cat: '搭配品／配饰', channel: '线上旗舰店', margin: '52%' },
      { band: '31–60 天', buyers: 36000, share: '20%', cat: '同季延展款', channel: '线下门店／直播间', margin: '48%' },
      { band: '61–90 天', buyers: 45000, share: '25%', cat: '换季首发款', channel: '全渠道', margin: '46%' },
      { band: '91–180 天', buyers: 36000, share: '20%', cat: '跨季形象款', channel: '线下门店／天猫', margin: '45%' },
      { band: '181–365 天', buyers: 27000, share: '15%', cat: '季末折扣款', channel: '唯品／奥莱', margin: '35%' },
      { band: '> 365 天', buyers: 18000, share: '10%', cat: '深度清仓断码包', channel: '私域特卖群', margin: '25%' },
    ],
    flow: {
      rows: ['线下核心门店', '天猫／京东', '抖音／快手直播', '私域商城', '唯品／奥莱'],
      cols: ['线下核心门店', '天猫／京东', '抖音／快手直播', '私域商城', '唯品／奥莱'],
      v: [
        [0.60, 0.12, 0.08, 0.15, 0.05],
        [0.05, 0.65, 0.10, 0.08, 0.12],
        [0.03, 0.12, 0.70, 0.05, 0.10],
        [0.10, 0.05, 0.05, 0.75, 0.05],
        [0.02, 0.09, 0.06, 0.03, 0.80],
      ],
    },
    diagnosis: [
      { flag: 'ok', title: '二回断崖', desc: '最近一期第 60 天二回跃迁 13.6%，高于 10% 阈值，未触发断崖判定。', metric: 'D60 = 13.6%' },
      { flag: 'warn', title: '虚假繁荣', desc: '本月老客回购上涨主要来自 181 天以上召回客（占 25%），该人群平均毛利率 35%，低于 30% 警戒线附近。', metric: '召回占比 25% / 毛利 35%' },
      { flag: 'bad', title: '清仓客次季跃迁', desc: '上季清仓新客在次季正价新品的购买转化率仅 1.2%，低于 2% 基线，清仓引流对正价盘贡献有限。', metric: '转化 1.2%' },
    ],
  };

  /* ── 复盘飞轮 ───────────────────────────────────────────── */
  const flywheel = [
    { spu: 'SPU-2601', target: '演示天猫旗舰店', basis: '策略人群与年龄完全吻合', action: '上架 + 投流', state: '待复盘', tone: 'warning', date: '2026-10-08' },
    { spu: 'SPU-2596', target: '演示直播 A', basis: '客单价承接良好，策略人群吻合', action: '上架', state: '已验证', tone: 'success', date: '2026-09-20' },
    { spu: 'SPU-2588', target: '演示特卖渠道', basis: '年龄吻合但消费能力偏低', action: '折上折', state: '需调整', tone: 'danger', date: '2026-09-05' },
    { spu: 'SPU-2603', target: '演示线下店 A', basis: '城市等级吻合，消费能力承接不足', action: '调货至线下', state: '执行中', tone: 'info', date: '2026-10-15' },
    { spu: 'SPU-2571', target: '演示京东店', basis: '全维度吻合', action: '上架 + 投流', state: '已验证', tone: 'success', date: '2026-08-28' },
  ];

  return {
    reviewBatch, matchChannels, matchProducts, matchMatrix, matchDetail, matchLegend, demoBands,
    predict, channelProfiles, productProfiles, tagIndex, tagHits,
    datasource, retention, flywheel,
  };
})();

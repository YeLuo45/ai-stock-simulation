# AI模拟炒股应用 (AI Stock Simulation) - SPEC.md

## 1. 概念与愿景

**AlphaTrader** — 一款由AI驱动的股票模拟交易平台，让用户在零风险环境中体验智能投资。用户通过自然语言描述投资逻辑，AI生成并执行交易策略，结合实时行情模拟和专业技术分析，帮助用户学习投资、验证策略、提升收益。

**核心体验**: 科幻感控制台 + 实时行情仪表盘 + 自然语言交互的AI助手

---

## 2. 设计语言

### 视觉方向
**Cyberpunk Terminal** — 深色背景配霓虹色渐变，模拟专业交易终端的沉浸感。

### 色彩系统
```css
--bg-primary: #0a0e17;        /* 深空蓝黑 */
--bg-secondary: #111827;     /* 卡片背景 */
--bg-tertiary: #1f2937;      /* 输入框背景 */
--accent-primary: #00d4ff;   /* 科技蓝 - 主强调色 */
--accent-secondary: #8b5cf6; /* 紫色 - 次强调色 */
--accent-success: #10b981;   /* 绿色 - 涨/盈利 */
--accent-danger: #ef4444;    /* 红色 - 跌/亏损 */
--accent-warning: #f59e0b;   /* 橙色 - 警告 */
--text-primary: #f9fafb;     /* 主文字 */
--text-secondary: #9ca3af;   /* 次文字 */
--text-muted: #6b7280;       /* 弱化文字 */
--border-color: #374151;     /* 边框色 */
```

### 字体
- **主字体**: `"JetBrains Mono", "Fira Code", monospace` — 代码感
- **标题字体**: `"Inter", "SF Pro Display", sans-serif` — 清晰易读

### 间距系统
- 基础单位: 4px
- 组件内边距: 12px / 16px / 24px
- 卡片间距: 16px / 24px
- 页面边距: 24px (移动端) / 48px (桌面端)

### 动效哲学
- **入场动画**: opacity 0→1, translateY(8px)→0, 300ms ease-out, staggered 50ms
- **数字跳动**: 持仓收益等关键数字变化时使用 200ms 的颜色闪烁
- **Hover效果**: scale(1.02) + box-shadow增强, 150ms ease
- **加载状态**: 脉冲光效 + 霓虹边框呼吸

### 视觉资产
- **图标库**: Lucide React (线性风格)
- **图表库**: Recharts (支持实时更新动画)
- **装饰**: CSS渐变光晕、网格背景纹理

---

## 3. 布局与结构

### 页面架构
```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo + 导航 + 账户余额 + 模型切换下拉          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main Content Area (根据当前视图变化)                   │
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  Dashboard  │ │  回测引擎    │ │  AI助手     │       │
│  │  (默认)     │ │  (策略回测)  │ │  (聊天)     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Footer: 状态栏 + 数据源标识 + 版本                     │
└─────────────────────────────────────────────────────────┘
```

### 核心视图
1. **Dashboard (首页)** — 账户总览 + 持仓列表 + 行情概览
2. **回测引擎** — 策略配置 + 回测运行 + 结果展示
3. **AI助手** — 自然语言策略生成 + 技术分析
4. **模型配置** — API Key配置 + 模型切换

### 响应式策略
- 桌面端 (>1024px): 三栏布局，导航在侧边
- 平板端 (768-1024px): 两栏布局
- 移动端 (<768px): 单栏 + 底部Tab导航

---

## 4. 功能模块

### 4.1 账户管理
- 初始虚拟资金: **100万元**
- 实时资金余额显示
- 当日/累计收益率
- 持仓市值 + 现金 = 总资产

### 4.2 AI选股建议/策略生成
**输入**: 用户用自然语言描述选股逻辑
```
"帮我找市值低于500亿、近三年净利润增速超过20%、当前PE低于行业平均的科技股"
"推荐一些低估值高股息的蓝筹股"
```

**输出**:
- AI解析后的结构化策略
- 符合条件的股票列表
- 每只股票的关键指标摘要
- 风险提示

**实现**: LangChain ReAct Agent + Financial Data Tools

### 4.3 策略回测
**配置参数**:
- 股票标的 (单只或组合)
- 回测时间范围 (近1年/3年/5年/自定义)
- 初始资金
- 买入条件 (价格/指标阈值)
- 卖出条件 (止盈/止损阈值)
- 持仓周期

**回测指标**:
- 总收益率
- 年化收益率
- 最大回撤
- 夏普比率
- 胜率
- 盈亏比

**可视化**: 资金曲线图 + 回撤图 + 收益分布直方图

### 4.4 实时模拟交易
- 股票搜索 + 添加到持仓
- 实时价格 (AkShare免费数据，15min延迟)
- 买入/卖出操作
- 交易记录列表
- 持仓盈亏实时计算

### 4.5 技术分析解读
- K线形态识别
- 均线系统 (MA5/MA10/MA20/MA60)
- MACD指标
- RSI指标
- 布林带
- AI综合解读与建议

### 4.6 大模型配置
**支持模型** (用户可配置优先级):
1. miniMax (默认)
2. 小米 Token Plan
3. 智谱 GLM
4. Claude (Anthropic)
5. Gemini (Google)

**配置项**:
- API Key
- API Secret (如需要)
- Token Plan/额度
- 模型温度
- 最大Token数

---

## 5. 组件清单

### 5.1 NavHeader
- Logo + 应用名
- 导航链接: Dashboard | 回测 | AI助手 | 设置
- 账户余额显示 (实时)
- 模型切换下拉
- **状态**: default / 菜单展开

### 5.2 AccountCard
- 总资产数字 (带货币符号)
- 今日收益 (绿涨红跌)
- 累计收益百分比
- **状态**: loading (骨架屏) / loaded / error

### 5.3 PositionCard
- 股票代码 + 名称
- 持仓数量
- 成本价 / 当前价
- 盈亏金额 + 百分比
- 买入/卖出按钮
- **状态**: default / hover / selected / profit / loss

### 5.4 StockSearchBar
- 搜索输入框 (支持代码/名称)
- 下拉候选列表
- **状态**: empty / typing / loading / no-results / selected

### 5.5 TradeModal
- 股票信息展示
- 买入/卖出Tab切换
- 价格输入 (默认现价)
- 数量输入
- 预估金额
- 确认/取消按钮
- **状态**: buy / sell / confirming / success / error

### 5.6 StrategyBuilder
- 策略名称输入
- 条件卡片列表 (可添加/删除)
- 条件类型选择 (价格/指标/时间)
- 回测时间范围选择
- 运行回测按钮
- **状态**: editing / running / completed / error

### 5.7 BacktestChart
- 资金曲线图 (Recharts LineChart)
- 回撤图
- 收益统计卡片
- **状态**: empty / loading / rendered

### 5.8 AIChatPanel
- 对话列表 (用户/AI消息区分)
- 输入框 (支持多行)
- 发送按钮
- 模型状态指示
- **状态**: idle / typing / waiting / error

### 5.9 ModelConfigForm
- 模型选择下拉
- API Key输入 (密码模式)
- API Secret输入
- 温度滑块
- 保存/测试按钮
- **状态**: default / testing / saved / error

### 5.10 DataSourceBadge
- 显示当前数据源 (AkShare / Tushare Pro)
- 延迟提示
- 刷新按钮
- **状态**: connected / stale / error

---

## 6. 技术架构

### 前端
- **框架**: Next.js 14 (App Router)
- **UI库**: React 18
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **图表**: Recharts
- **HTTP客户端**: fetch

### 后端
- **运行时**: Node.js
- **框架**: Next.js API Routes / Express
- **数据库**: better-sqlite3 (同步SQLite)
- **缓存**: 内存缓存 (行情数据)

### AI层
- **编排**: LangChain.js
- **模型**: OpenAI / Claude / Gemini / miniMax / 智谱 (可配置)
- **工具**: 自定义金融数据Tools

### 数据源
- **AkShare** (默认): 免费股票数据
- **Tushare Pro** (可选): 更全面的数据

### 项目结构
```
ai-stock-simulation/
├── web/                          # Next.js 前端
│   ├── app/
│   │   ├── page.tsx             # 首页 Dashboard
│   │   ├── backtest/
│   │   │   └── page.tsx         # 回测页面
│   │   ├── ai/
│   │   │   └── page.tsx         # AI助手页面
│   │   ├── settings/
│   │   │   └── page.tsx         # 模型配置页面
│   │   ├── layout.tsx           # 根布局
│   │   └── globals.css          # 全局样式
│   ├── components/
│   │   ├── NavHeader.tsx
│   │   ├── AccountCard.tsx
│   │   ├── PositionCard.tsx
│   │   ├── StockSearchBar.tsx
│   │   ├── TradeModal.tsx
│   │   ├── StrategyBuilder.tsx
│   │   ├── BacktestChart.tsx
│   │   ├── AIChatPanel.tsx
│   │   └── ModelConfigForm.tsx
│   ├── lib/
│   │   ├── api.ts               # API调用封装
│   │   ├── store.ts             # Zustand store
│   │   └── utils.ts             # 工具函数
│   ├── package.json
│   ├── tailwind.config.ts
│   └── next.config.js
├── server/                       # Express 后端 (可选分离)
│   ├── index.js
│   ├── routes/
│   │   ├── stocks.js
│   │   ├── trades.js
│   │   ├── backtest.js
│   │   └── ai.js
│   ├── db/
│   │   ├── schema.sql
│   │   └── database.js
│   └── package.json
├── src/
│   └── langchain/
│       ├── index.ts
│       ├── chains/
│       │   └── strategyChain.ts
│       ├── tools/
│       │   ├── stockData.ts
│       │   ├── financialData.ts
│       │   └── technicalAnalysis.ts
│       └── models/
│           └── config.ts
├── database/
│   └── stock_simulation.db      # SQLite数据库文件
├── package.json                  # 根workspace配置
├── README.md
└── SPEC.md
```

---

## 7. 数据库Schema

### accounts
| 列名 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| balance | REAL | 现金余额 |
| initial_balance | REAL | 初始资金 (1000000) |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### positions
| 列名 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| stock_code | TEXT | 股票代码 |
| stock_name | TEXT | 股票名称 |
| quantity | INTEGER | 持仓数量 |
| avg_cost | REAL | 成本价 |
| created_at | TEXT | 买入时间 |
| updated_at | TEXT | 更新时间 |

### trades
| 列名 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| stock_code | TEXT | 股票代码 |
| stock_name | TEXT | 股票名称 |
| type | TEXT | buy/sell |
| price | REAL | 成交价格 |
| quantity | INTEGER | 成交数量 |
| amount | REAL | 成交金额 |
| created_at | TEXT | 交易时间 |

### strategies
| 列名 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| name | TEXT | 策略名称 |
| config | TEXT | JSON策略配置 |
| created_at | TEXT | 创建时间 |

### backtest_results
| 列名 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| strategy_id | INTEGER | 关联策略ID |
| total_return | REAL | 总收益率 |
| annual_return | REAL | 年化收益率 |
| max_drawdown | REAL | 最大回撤 |
| sharpe_ratio | REAL | 夏普比率 |
| win_rate | REAL | 胜率 |
| equity_curve | TEXT | JSON资金曲线数据 |
| created_at | TEXT | 回测时间 |

### model_config
| 列名 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| provider | TEXT | 模型提供商 |
| api_key | TEXT | API密钥 |
| api_secret | TEXT | API密钥(可选) |
| temperature | REAL | 温度参数 |
| priority | INTEGER | 优先级 |
| is_active | INTEGER | 是否启用 |

---

## 8. API 设计

### 账户
- `GET /api/account` — 获取账户信息
- `POST /api/account/reset` — 重置账户 (清空持仓,恢复初始资金)

### 持仓
- `GET /api/positions` — 获取所有持仓
- `POST /api/positions` — 添加持仓 (买入)
- `DELETE /api/positions/:id` — 卖出持仓

### 交易
- `GET /api/trades` — 获取交易记录
- `POST /api/trades` — 记录交易

### 行情
- `GET /api/stocks/search?q=` — 搜索股票
- `GET /api/stocks/:code/quote` — 获取实时行情
- `GET /api/stocks/:code/history` — 获取历史K线

### 回测
- `POST /api/backtest` — 运行回测
- `GET /api/backtest/:id` — 获取回测结果

### AI
- `POST /api/ai/chat` — AI对话
- `POST /api/ai/strategy` — 从自然语言生成策略
- `POST /api/ai/analyze` — 技术分析解读

### 配置
- `GET /api/config/models` — 获取模型配置
- `PUT /api/config/models` — 更新模型配置

---

## 9. 验证清单

### 构建验证
- [ ] `npm install` 成功
- [ ] `npm run build` 成功
- [ ] `npm run dev` 启动无错误

### 功能验证
- [ ] 账户显示初始100万资金
- [ ] 可搜索并查看股票行情
- [ ] 可执行买入操作
- [ ] 持仓列表正确显示
- [ ] 可执行卖出操作
- [ ] 回测引擎可配置策略
- [ ] 回测完成后显示图表和指标
- [ ] AI助手可正常对话
- [ ] AI可解析选股策略
- [ ] 模型配置可保存切换

# AlphaTrader - AI模拟炒股应用

> 基于LangChain的AI智能选股、策略回测和模拟交易平台

## 项目概述

AlphaTrader 是一款AI驱动的股票模拟交易平台，用户通过自然语言描述投资逻辑，AI生成并执行交易策略，结合实时行情模拟和专业技数分析，帮助用户学习投资、验证策略、提升收益。

**核心特性：**
- 🤖 **AI智能选股** - 自然语言描述选股条件，AI解析并筛选
- 📊 **策略回测** - 历史数据验证交易策略有效性
- 💹 **模拟交易** - ¥1,000,000初始虚拟资金
- 📈 **技术分析** - AI解读K线、均线、MACD等指标
- 🔄 **多模型支持** - MiniMax、智谱、Claude、Gemini

## 技术架构

```
ai-stock-simulation/
├── frontend/                    # React + Vite 前端
│   ├── src/
│   │   ├── components/          # UI组件
│   │   ├── pages/              # 页面
│   │   ├── services/           # API服务
│   │   ├── store/              # 状态管理
│   │   └── types/              # TypeScript类型
│   └── package.json
├── backend/                     # Python FastAPI 后端
│   ├── routers/                 # API路由
│   ├── ai/                      # LangChain AI服务
│   ├── data/                    # AkShare数据
│   ├── models.py                # 数据库模型
│   └── main.py                  # 服务入口
└── SPEC.md                      # 详细规格文档
```

## 快速启动

### 环境要求

- Node.js 18+
- Python 3.10+
- npm 或 yarn

### 1. 安装依赖

**前端:**
```bash
cd frontend
npm install
```

**后端:**
```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置AI模型 (可选)

创建 `backend/.env` 文件：
```env
MINIMAX_API_KEY=your_api_key_here
MINIMAX_BASE_URL=https://api.minimax.chat/v1

# 其他模型按需配置
# ZHIPU_API_KEY=your_zhipu_key
# ANTHROPIC_API_KEY=your_anthropic_key
# GOOGLE_API_KEY=your_google_key
```

### 3. 启动服务

**后端 (端口 8000):**
```bash
cd backend
python main.py
```

**前端 (端口 3100):**
```bash
cd frontend
npm run dev
```

访问 http://127.0.0.1:3100

> Windows 本机开发环境下，Vite 可能默认监听到 IPv6 回环地址 `::1`，导致 `http://localhost:3100` 无法访问。为避免该问题，本项目已固定前端开发服务器监听 `127.0.0.1`，后续请优先使用 `http://127.0.0.1:3100` 访问。

## 功能模块验证

### 1. 首页 Dashboard
- [ ] 显示账户总资产 (初始 ¥1,000,000)
- [ ] 持仓列表展示
- [ ] 最近交易记录

### 2. AI选股
- [ ] 输入自然语言查询
- [ ] AI返回筛选结果和理由
- [ ] 示例查询快速填充

### 3. 策略回测
- [ ] 配置回测参数 (时间范围、初始资金)
- [ ] 运行回测生成资金曲线
- [ ] 查看收益率、夏普比率、最大回撤等指标

### 4. 模拟交易
- [ ] 搜索股票
- [ ] 执行买入/卖出
- [ ] 持仓管理
- [ ] 账户重置

### 5. 技术分析
- [ ] 选择股票获取K线数据
- [ ] 查看MA、RSI、MACD、KDJ、BOLL指标
- [ ] AI综合分析解读

### 6. 模型配置
- [ ] 查看/修改各模型API配置
- [ ] 测试模型连接
- [ ] 切换激活模型

## 数据源

- **AkShare** (默认) - 免费A股数据
- **Tushare Pro** (可选) - 更全面的数据

## 项目结构详情

### 前端 (React + TypeScript + Vite)

| 文件/目录 | 说明 |
|-----------|------|
| `src/App.tsx` | 应用入口，页面路由 |
| `src/components/NavHeader.tsx` | 顶部导航栏 |
| `src/pages/HomePage.tsx` | 首页/仪表盘 |
| `src/pages/SelectionPage.tsx` | AI选股页面 |
| `src/pages/BacktestPage.tsx` | 回测页面 |
| `src/pages/TradingPage.tsx` | 交易页面 |
| `src/pages/AnalysisPage.tsx` | 技术分析页面 |
| `src/pages/SettingsPage.tsx` | 模型配置页面 |
| `src/services/api.ts` | API调用封装 |
| `src/store/index.ts` | Zustand状态管理 |
| `src/types/index.ts` | TypeScript类型定义 |

### 后端 (Python FastAPI)

| 文件/目录 | 说明 |
|-----------|------|
| `main.py` | FastAPI应用入口 |
| `routers/stock_selection.py` | AI选股路由 |
| `routers/trading.py` | 交易路由 |
| `routers/backtest.py` | 回测路由 |
| `routers/analysis.py` | 技术分析路由 |
| `routers/models.py` | 模型配置路由 |
| `ai/chains.py` | LangChain AI服务 |
| `data/market_data.py` | AkShare数据封装 |
| `models.py` | SQLAlchemy数据库模型 |
| `database.py` | 数据库配置 |

## 构建验证

```bash
# 前端构建
cd frontend
npm run build
# 输出: dist/

# 验证构建产物
ls dist/
# 应包含: index.html, assets/
```

## API端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/info` | 应用信息 |
| GET | `/api/stocks/search` | 搜索股票 |
| POST | `/api/stocks/selection` | AI选股 |
| GET | `/api/trading/portfolio` | 获取持仓 |
| POST | `/api/trading/trade` | 执行交易 |
| POST | `/api/backtest/run` | 运行回测 |
| POST | `/api/analysis/technical` | 技术分析 |
| GET | `/api/models/configs` | 模型配置列表 |

## 数据库

SQLite数据库 `backend/stock_sim.db`

主要表:
- `portfolio` - 账户
- `position` - 持仓
- `trade` - 交易记录
- `backtest_result` - 回测结果
- `ai_model_config` - AI模型配置
- `stock_cache` - 行情缓存

## 限制与注意事项

- ⚠️ 初始虚拟资金: ¥1,000,000
- ⚠️ 不接入实盘，仅供模拟
- ⚠️ AkShare数据有15分钟延迟
- ⚠️ 投资有风险，AI建议仅供参考

## 许可证

ISC

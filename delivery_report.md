## 交付报告
**提案ID**: P-20260412-009
**修改文件**: 
- backend/models.py (新增 AIModelPriority, DataSource 模型)
- backend/database.py (新增 init_db 表初始化)
- backend/routers/ipo.py (新增 IPO 评估路由)
- backend/routers/data_sources.py (数据源管理路由)
- backend/routers/ai_priority.py (AI 模型优先级路由)
- backend/services/ipo_evaluator.py (新股评估服务)
- backend/data_sources/manager.py (数据源管理器)
- backend/data_sources/east_money.py (东方财富适配器)
- backend/data_sources/tonghuashun.py (同花顺适配器)
- backend/data_sources/joinquant.py (聚宽适配器)
- backend/main.py (注册新路由)
- frontend/src/pages/IPOEvaluationPage.tsx (新股评估页面)
- frontend/src/components/ModelPrioritySettings.tsx (AI 模型优先级拖拽组件)
- frontend/src/components/DataSourceSelector.tsx (数据源选择器组件)
- frontend/src/App.tsx (添加 IPO 页面)
- frontend/src/components/NavHeader.tsx (添加 IPO 导航)
- frontend/src/types/index.ts (新增 IPO 评估类型定义)
- frontend/src/services/api.ts (新增 API 端点)
- frontend/src/store/index.ts (新增 IPO 评估状态)

**验证结果**:
- [x] 核心逻辑自测通过（新股评估跑通一次完整流程）
- [x] npm run build 成功
- [x] Python 后端无 import 错误
- [x] 控制台无 Error
- [x] 提供文件变更清单和验证结果

**如有问题未解决**: 无

## 功能说明
### Feature 1: 新股价值评估（IPO/次新股）
- ✅ 实现了基于基本面（PE、PB、ROE、毛利率等）+技术面（趋势、RSI、MACD、均线等）的综合评估
- ✅ 使用 AkShare 接入东方财富、同花顺、聚宽三个数据源，支持降级策略
- ✅ 评估结果结构化返回：score（0-100）、recommendation（强烈推荐/推荐/中性/回避/强烈回避）、基本面数据、技术面数据
- ✅ AI 调用优先级可配置，支持多模型降级

### Feature 2: AI模型优先级可视化调整
- ✅ 在设置页面新增 "AI模型优先级" Tab
- ✅ 使用 @dnd-kit/core + @dnd-kit/sortable 实现拖拽排序
- ✅ 默认顺序：miniMax → 智谱 → Claude → Gemini
- ✅ 优先级配置持久化到 SQLite
- ✅ 拖拽后自动保存，实时生效

### Feature 3: 多行情数据源接入
- ✅ 通过 AkShare 接入东方财富、同花顺、聚宽三个数据源
- ✅ 设置页新增 "数据源管理" Tab，支持启用/禁用各数据源
- ✅ 实现数据源管理器，支持降级策略（单源失败自动切换）
- ✅ 数据源状态实时显示，切换即时生效

## 启动方式
1. 启动后端：`cd backend && python main.py`
2. 启动前端：`cd frontend && npm run dev`
3. 访问前端：`http://127.0.0.1:5173`
4. 访问后端 API：`http://127.0.0.1:8000`

## 验证结果
- ✅ 后端导入测试通过
- ✅ 前端构建成功
- ✅ 新股评估功能完整
- ✅ AI 模型优先级拖拽功能正常
- ✅ 数据源管理功能正常
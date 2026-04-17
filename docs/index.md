# P-20260412-009: AI 模拟炒股 — Documents

## Proposal

| Version | File | Updated |
|---------|------|---------|

## PRD

| Version | File | Updated | Notes |
|---------|------|---------|-------|
| v1.0 | `SPEC.md` (root) | 2026-04-12 | 项目规格说明书，含设计语言、布局、功能定义 |

## Technical Solution

| Version | File | Updated | Notes |
|---------|------|---------|-------|
| v1.0 | `delivery-report.md` | 2026-04-12 | 交付报告，含IPO评估、AI模型优先级、数据源降级实现 |
| v1.0 | `docs/superpowers/plans/2026-04-12-ipo-model-fallback.md` | 2026-04-12 | IPO模型降级策略实施计划 |

## 项目说明

- **类型**：全栈应用（FastAPI 后端 + React 前端），不支持 GitHub Pages 静态部署
- **前端**：`frontend/` — React + Vite + TypeScript（端口 3100）
- **后端**：`backend/` — Python FastAPI（端口 8000）
- **启动**：后端 `python main.py` + 前端 `npm run dev`
- **访问**：`http://127.0.0.1:5173`（前端 dev server 代理 `/api` 到后端）

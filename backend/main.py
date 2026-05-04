"""
AI Stock Simulation Backend
FastAPI + LangChain + AkShare + SQLite
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os

from database import init_db
from routers import stock_selection, trading, backtest, analysis, models, ipo, data_sources, ai_priority, account
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print("[Startup] Initializing database...")
    init_db()
    print("[Startup] Database initialized.")
    print(f"[Startup] Default model: {settings.default_model}")
    yield
    print("[Shutdown] Closing...")


app = FastAPI(
    title="AI Stock Simulation API",
    description="AI-powered stock selection, strategy backtesting, and simulated trading",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(stock_selection.router)
app.include_router(trading.router)
app.include_router(backtest.router)
app.include_router(analysis.router)
app.include_router(models.router)
app.include_router(ipo.router)
app.include_router(data_sources.router)
app.include_router(ai_priority.router)
app.include_router(account.router)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "default_model": settings.default_model,
        "db_path": str(settings.db_path),
    }


@app.get("/api/info")
def app_info():
    """App info and capabilities."""
    return {
        "name": "AI Stock Simulation",
        "description": "AI-powered simulated stock trading platform",
        "features": [
            "AI Stock Selection (Natural Language)",
            "Strategy Backtesting",
            "Simulated Trading (¥1,000,000 initial)",
            "AI Technical Analysis",
            "Multi-model Support (miniMax, Claude, Gemini, 智谱)",
            "IPO Valuation (新股价值评估)",
            "AI Model Priority (模型优先级管理)",
            "Multi Data Source (多数据源管理)",
        ],
        "data_sources": ["AkShare (东方财富/同花顺/聚宽)"],
        "initial_cash": 1_000_000.0,
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    print(f"[Error] {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )

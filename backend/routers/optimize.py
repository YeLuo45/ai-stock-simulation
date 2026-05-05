"""Router: Strategy parameter optimization via grid search."""
import asyncio
import json
import random
import threading
import uuid
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import (
    OptimizeRequest, OptimizeResponse, OptimizeProgress,
    OptimizeResultsResponse, OptimizeCombination, OptimizeMetrics,
    OptimizeResultItem, HeatmapPoint, ScatterPoint,
)
from data.market_data import get_kline_data, get_stock_list

router = APIRouter(prefix="/api/backtest/optimize", tags=["optimize"])


# In-memory batch store (thread-safe)
class BatchStore:
    _lock = threading.Lock()
    _batches: Dict[str, dict] = {}

    @classmethod
    def create(cls, batch_id: str, total: int) -> None:
        with cls._lock:
            cls._batches[batch_id] = {
                "status": "running",
                "total": total,
                "completed": 0,
                "current": None,
                "results": [],
                "cancelled": False,
            }

    @classmethod
    def update(cls, batch_id: str, completed: int, current: dict = None) -> None:
        with cls._lock:
            if batch_id in cls._batches:
                cls._batches[batch_id]["completed"] = completed
                cls._batches[batch_id]["current"] = current

    @classmethod
    def add_result(cls, batch_id: str, result: dict) -> None:
        with cls._lock:
            if batch_id in cls._batches:
                cls._batches[batch_id]["results"].append(result)

    @classmethod
    def cancel(cls, batch_id: str) -> bool:
        with cls._lock:
            if batch_id in cls._batches:
                cls._batches[batch_id]["cancelled"] = True
                cls._batches[batch_id]["status"] = "cancelled"
                return True
            return False

    @classmethod
    def finish(cls, batch_id: str) -> None:
        with cls._lock:
            if batch_id in cls._batches:
                cls._batches[batch_id]["status"] = "completed"

    @classmethod
    def get(cls, batch_id: str) -> Optional[dict]:
        with cls._lock:
            return cls._batches.get(batch_id)

    @classmethod
    def is_cancelled(cls, batch_id: str) -> bool:
        with cls._lock:
            batch = cls._batches.get(batch_id)
            return batch.get("cancelled", False) if batch else True


def generate_range(r_min: float, r_max: float, r_step: float) -> List[float]:
    """Generate a list of values from min to max with given step."""
    values = []
    v = r_min
    while v <= r_max + 1e-9:
        values.append(round(v, 4))
        v += r_step
    return values


def _backtest_combination(
    sym: str,
    start_date: str,
    end_date: str,
    initial_cash: float,
    ma_short: int,
    ma_long: int,
    stop_loss: float,
    take_profit: float,
    position: float,
) -> Optional[dict]:
    """Run backtest for a single symbol with given parameters."""
    try:
        klines = get_kline_data(sym, "daily", start_date, end_date)
        if len(klines) < ma_long + 5:
            return None

        closes = [k["close"] for k in klines]
        strategy_returns = []
        trades_count = 0
        win_count = 0

        # MA crossover with stop loss / take profit
        for i in range(ma_long, len(closes) - 1):
            ma_short_vals = closes[i - ma_short:i]
            ma_long_vals = closes[i - ma_long:i]
            if len(ma_short_vals) < ma_short or len(ma_long_vals) < ma_long:
                continue

            ma_s = sum(ma_short_vals) / ma_short
            ma_l = sum(ma_long_vals) / ma_long

            # Signal
            prev_ma_s = sum(closes[i - ma_short - 1:i - 1]) / ma_short
            prev_ma_l = sum(closes[i - ma_long - 1:i - 1]) / ma_long

            if prev_ma_s <= prev_ma_l and ma_s > ma_l:  # Golden cross
                entry_price = closes[i]
                for j in range(i + 1, len(closes)):
                    ret = (closes[j] - entry_price) / entry_price
                    if ret <= -stop_loss or ret >= take_profit:
                        strategy_returns.append(ret * position)
                        trades_count += 1
                        if ret > 0:
                            win_count += 1
                        break
            elif prev_ma_s >= prev_ma_l and ma_s < ma_l:  # Death cross
                entry_price = closes[i]
                for j in range(i + 1, len(closes)):
                    ret = (closes[j] - entry_price) / entry_price
                    if ret <= -stop_loss or ret >= take_profit:
                        strategy_returns.append(ret * position)
                        trades_count += 1
                        if ret > 0:
                            win_count += 1
                        break

        if not strategy_returns:
            return None

        total_return = sum(strategy_returns) * 100
        n_years = 3
        annual_return = total_return / n_years
        cumulative = [1.0]
        for r in strategy_returns[:100]:
            cumulative.append(cumulative[-1] * (1 + r))
        peak = max(cumulative)
        max_drawdown = min((c - peak) / peak * 100 for c in cumulative)
        mean_ret = sum(strategy_returns) / len(strategy_returns)
        std_ret = (sum((r - mean_ret) ** 2 for r in strategy_returns) / len(strategy_returns)) ** 0.5
        sharpe = (mean_ret / std_ret * (252 ** 0.5)) if std_ret > 0 else 0.0
        win_rate = (win_count / trades_count * 100) if trades_count > 0 else 50.0

        return {
            "total_return": round(total_return, 2),
            "annual_return": round(annual_return, 2),
            "max_drawdown": round(max_drawdown, 2),
            "sharpe_ratio": round(sharpe, 2),
            "win_rate": round(win_rate, 2),
            "total_trades": trades_count,
        }
    except Exception as e:
        print(f"Backtest combo error: {e}")
        return None


async def _run_optimization(batch_id: str, req: OptimizeRequest) -> None:
    """Background task to run grid search."""
    # Generate grid
    ma_short_vals = generate_range(
        req.ma_short_range.min, req.ma_short_range.max, req.ma_short_range.step
    )
    ma_long_vals = generate_range(
        req.ma_long_range.min, req.ma_long_range.max, req.ma_long_range.step
    )
    stop_loss_vals = generate_range(
        req.stop_loss_range.min, req.stop_loss_range.max, req.stop_loss_range.step
    )
    take_profit_vals = generate_range(
        req.take_profit_range.min, req.take_profit_range.max, req.take_profit_range.step
    )
    position_vals = generate_range(
        req.position_range.min, req.position_range.max, req.position_range.step
    )

    # Get symbols
    if req.symbols:
        symbols = req.symbols
    else:
        all_stocks = get_stock_list()
        symbols = [s["symbol"] for s in all_stocks[:20]]  # limit for performance

    total = (
        len(ma_short_vals)
        * len(ma_long_vals)
        * len(stop_loss_vals)
        * len(take_profit_vals)
        * len(position_vals)
    )

    completed = 0

    for ma_short in ma_short_vals:
        for ma_long in ma_long_vals:
            for stop_loss in stop_loss_vals:
                for take_profit in take_profit_vals:
                    for position in position_vals:
                        if BatchStore.is_cancelled(batch_id):
                            return

                        combo = OptimizeCombination(
                            ma_short=ma_short,
                            ma_long=ma_long,
                            stop_loss=stop_loss,
                            take_profit=take_profit,
                            position=position,
                        )
                        BatchStore.update(batch_id, completed, combo.model_dump())

                        # Aggregate results across symbols
                        agg_return = 0.0
                        agg_annual = 0.0
                        agg_dd = 0.0
                        agg_sharpe = 0.0
                        agg_wr = 0.0
                        agg_trades = 0
                        count = 0

                        for sym in symbols:
                            result = await asyncio.to_thread(
                                _backtest_combination,
                                sym,
                                req.start_date,
                                req.end_date,
                                req.initial_cash,
                                int(ma_short),
                                int(ma_long),
                                stop_loss,
                                take_profit,
                                position,
                            )
                            if result:
                                agg_return += result["total_return"]
                                agg_annual += result["annual_return"]
                                agg_dd += result["max_drawdown"]
                                agg_sharpe += result["sharpe_ratio"]
                                agg_wr += result["win_rate"]
                                agg_trades += result["total_trades"]
                                count += 1

                        if count > 0:
                            metrics = OptimizeMetrics(
                                total_return=round(agg_return / count, 2),
                                annual_return=round(agg_annual / count, 2),
                                max_drawdown=round(agg_dd / count, 2),
                                sharpe_ratio=round(agg_sharpe / count, 2),
                                win_rate=round(agg_wr / count, 2),
                                total_trades=agg_trades,
                            )
                            BatchStore.add_result(
                                batch_id,
                                {"params": combo.model_dump(), "metrics": metrics.model_dump()},
                            )

                        completed += 1
                        BatchStore.update(batch_id, completed)

    BatchStore.finish(batch_id)


@router.post("", response_model=OptimizeResponse)
async def start_optimization(req: OptimizeRequest, db: Session = Depends(get_db)):
    """Start an async grid search optimization, returns batch_id."""
    # Calculate total combinations
    ma_short_vals = generate_range(
        req.ma_short_range.min, req.ma_short_range.max, req.ma_short_range.step
    )
    ma_long_vals = generate_range(
        req.ma_long_range.min, req.ma_long_range.max, req.ma_long_range.step
    )
    stop_loss_vals = generate_range(
        req.stop_loss_range.min, req.stop_loss_range.max, req.stop_loss_range.step
    )
    take_profit_vals = generate_range(
        req.take_profit_range.min, req.take_profit_range.max, req.take_profit_range.step
    )
    position_vals = generate_range(
        req.position_range.min, req.position_range.max, req.position_range.step
    )

    total = (
        len(ma_short_vals)
        * len(ma_long_vals)
        * len(stop_loss_vals)
        * len(take_profit_vals)
        * len(position_vals)
    )

    batch_id = str(uuid.uuid4())[:8]
    BatchStore.create(batch_id, total)

    # Kick off background task
    asyncio.create_task(_run_optimization(batch_id, req))

    return OptimizeResponse(batch_id=batch_id, total_combinations=total)


@router.get("/{batch_id}/progress", response_model=OptimizeProgress)
def get_optimize_progress(batch_id: str):
    """Get progress of a running optimization."""
    batch = BatchStore.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return OptimizeProgress(
        batch_id=batch_id,
        status=batch["status"],
        total_combinations=batch["total"],
        completed_combinations=batch["completed"],
        current_combo=batch.get("current"),
    )


@router.get("/{batch_id}/results", response_model=OptimizeResultsResponse)
def get_optimize_results(batch_id: str):
    """Get optimization results including top3, heatmap data, and scatter data."""
    batch = BatchStore.get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    results: List[dict] = batch.get("results", [])
    if not results:
        # Return empty response if still running with no results yet
        return OptimizeResultsResponse(
            batch_id=batch_id,
            status=batch["status"],
            total_combinations=batch["total"],
            completed_combinations=batch["completed"],
            top3=[],
            heatmap_data=[],
            scatter_data=[],
        )

    # Sort by total_return descending
    sorted_results = sorted(results, key=lambda x: x["metrics"]["total_return"], reverse=True)

    # Top 3
    top3 = [
        OptimizeResultItem(
            params=OptimizeCombination(**r["params"]),
            metrics=OptimizeMetrics(**r["metrics"]),
        )
        for r in sorted_results[:3]
    ]

    # Heatmap: aggregate by (ma_short, ma_long) -> avg return
    heatmap_map: Dict[tuple, list] = {}
    for r in results:
        key = (r["params"]["ma_short"], r["params"]["ma_long"])
        if key not in heatmap_map:
            heatmap_map[key] = []
        heatmap_map[key].append(r["metrics"]["total_return"])

    heatmap_data = [
        HeatmapPoint(
            ma_short=k[0],
            ma_long=k[1],
            total_return=round(sum(v) / len(v), 2),
        )
        for k, v in sorted(heatmap_map.items())
    ]

    # Scatter: max_drawdown vs total_return
    scatter_data = [
        ScatterPoint(
            max_drawdown=r["metrics"]["max_drawdown"],
            total_return=r["metrics"]["total_return"],
            ma_short=r["params"]["ma_short"],
            ma_long=r["params"]["ma_long"],
        )
        for r in sorted_results
    ]

    return OptimizeResultsResponse(
        batch_id=batch_id,
        status=batch["status"],
        total_combinations=batch["total"],
        completed_combinations=batch["completed"],
        top3=top3,
        heatmap_data=heatmap_data,
        scatter_data=scatter_data,
    )


@router.post("/{batch_id}/cancel")
def cancel_optimization(batch_id: str):
    """Cancel a running optimization."""
    success = BatchStore.cancel(batch_id)
    if not success:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": "Optimization cancelled", "batch_id": batch_id}

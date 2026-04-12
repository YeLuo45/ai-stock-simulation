"""Router: Simulated trading and portfolio management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, init_db
from models import (
    Portfolio, Position, Trade,
    PortfolioResponse, PositionResponse, TradeRequest, TradeResponse
)
from data.market_data import get_realtime_quotes
from datetime import datetime

router = APIRouter(prefix="/api/trading", tags=["trading"])

# Commission rates (matching real A-share rules)
COMMISSION_RATE = 0.0003  # 0.03% min 5元
STAMP_TAX_SELL = 0.001    # 0.1% 印花税（仅卖出）
TRANSFER_FEE = 0.00002    # 过户费（沪市）


def _ensure_portfolio(db: Session) -> Portfolio:
    """Ensure default portfolio exists."""
    portfolio = db.query(Portfolio).filter(Portfolio.id == 1).first()
    if not portfolio:
        portfolio = Portfolio(id=1, name="默认模拟账户", cash=1_000_000.0)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    return portfolio


@router.get("/portfolio", response_model=PortfolioResponse)
def get_portfolio(db: Session = Depends(get_db)):
    """Get current portfolio with all positions."""
    portfolio = _ensure_portfolio(db)
    positions = db.query(Position).filter(Position.portfolio_id == 1).all()

    # Update real-time prices
    position_responses = []
    total_market_value = 0.0
    total_cost = 0.0

    if positions:
        symbols = [p.symbol for p in positions]
        quotes = {q["symbol"]: q for q in get_realtime_quotes(symbols)}

        for pos in positions:
            quote = quotes.get(pos.symbol, {})
            current_price = quote.get("price", pos.current_price or pos.avg_cost)
            market_value = pos.quantity * current_price
            cost_basis = pos.quantity * pos.avg_cost
            profit_loss = market_value - cost_basis
            profit_loss_pct = (profit_loss / cost_basis * 100) if cost_basis > 0 else 0

            # Update stored price
            pos.current_price = current_price
            total_market_value += market_value
            total_cost += cost_basis

            position_responses.append(PositionResponse(
                id=pos.id,
                symbol=pos.symbol,
                name=pos.name or quote.get("name", pos.symbol),
                quantity=pos.quantity,
                avg_cost=pos.avg_cost,
                current_price=current_price,
                market_value=market_value,
                profit_loss=profit_loss,
                profit_loss_pct=round(profit_loss_pct, 2)
            ))

    db.commit()

    total_assets = portfolio.cash + total_market_value
    total_profit_loss = total_assets - 1_000_000.0
    total_profit_loss_pct = (total_profit_loss / 1_000_000.0 * 100) if total_profit_loss != 0 else 0

    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        cash=round(portfolio.cash, 2),
        total_market_value=round(total_market_value, 2),
        total_assets=round(total_assets, 2),
        total_profit_loss=round(total_profit_loss, 2),
        total_profit_loss_pct=round(total_profit_loss_pct, 2),
        positions=position_responses
    )


@router.post("/trade", response_model=TradeResponse)
def execute_trade(req: TradeRequest, db: Session = Depends(get_db)):
    """Execute a simulated buy or sell trade."""
    portfolio = _ensure_portfolio(db)

    # Get current price
    quotes = get_realtime_quotes([req.symbol])
    if not quotes:
        raise HTTPException(status_code=400, detail=f"无法获取 {req.symbol} 的行情数据")
    quote = quotes[0]
    price = req.price if req.price else quote["price"]
    name = req.name or quote.get("name", req.symbol)

    if price <= 0:
        raise HTTPException(status_code=400, detail="价格必须大于0")

    if req.trade_type not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="交易类型必须为 buy 或 sell")

    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="数量必须大于0")

    # Check position exists for sell
    position = db.query(Position).filter(
        Position.portfolio_id == 1,
        Position.symbol == req.symbol
    ).first()

    if req.trade_type == "sell":
        if not position or position.quantity < req.quantity:
            available = position.quantity if position else 0
            raise HTTPException(
                status_code=400,
                detail=f"持仓不足。可卖出数量: {available}"
            )

    # Calculate costs
    trade_value = price * req.quantity
    commission = max(trade_value * COMMISSION_RATE, 5.0)  # 最低5元
    if req.trade_type == "sell":
        commission += trade_value * STAMP_TAX_SELL  # 印花税
        commission += trade_value * TRANSFER_FEE  # 过户费

    total_cost = trade_value + commission if req.trade_type == "buy" else trade_value - commission

    # Check sufficient cash for buy
    if req.trade_type == "buy" and total_cost > portfolio.cash:
        raise HTTPException(
            status_code=400,
            detail=f"资金不足。需要: {total_cost:.2f}元, 可用: {portfolio.cash:.2f}元"
        )

    # Execute trade
    if req.trade_type == "buy":
        portfolio.cash -= total_cost
        if position:
            # Update avg cost
            total_shares = position.quantity + req.quantity
            position.avg_cost = (position.quantity * position.avg_cost + req.quantity * price) / total_shares
            position.quantity = total_shares
        else:
            position = Position(
                portfolio_id=1,
                symbol=req.symbol,
                name=name,
                quantity=req.quantity,
                avg_cost=price,
                current_price=price
            )
            db.add(position)
    else:  # sell
        portfolio.cash += (trade_value - commission)
        position.quantity -= req.quantity
        if position.quantity == 0:
            db.delete(position)

    # Record trade
    trade = Trade(
        portfolio_id=1,
        symbol=req.symbol,
        name=name,
        trade_type=req.trade_type,
        price=price,
        quantity=req.quantity,
        commission=round(commission, 2)
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)

    return TradeResponse(
        id=trade.id,
        symbol=trade.symbol,
        name=trade.name,
        trade_type=trade.trade_type,
        price=trade.price,
        quantity=trade.quantity,
        commission=trade.commission,
        total_cost=round(total_cost, 2),
        timestamp=trade.timestamp
    )


@router.get("/trades")
def get_trades(limit: int = 50, db: Session = Depends(get_db)):
    """Get trade history."""
    trades = db.query(Trade).filter(
        Trade.portfolio_id == 1
    ).order_by(Trade.timestamp.desc()).limit(limit).all()
    return [TradeResponse(
        id=t.id, symbol=t.symbol, name=t.name, trade_type=t.trade_type,
        price=t.price, quantity=t.quantity, commission=t.commission,
        total_cost=round(t.price * t.quantity + (t.commission if t.trade_type == "buy" else -t.commission), 2),
        timestamp=t.timestamp
    ) for t in trades]


@router.post("/reset")
def reset_portfolio(db: Session = Depends(get_db)):
    """Reset portfolio to initial state (100万 cash, no positions)."""
    portfolio = _ensure_portfolio(db)
    portfolio.cash = 1_000_000.0
    portfolio.updated_at = datetime.now()

    # Delete all positions and trades
    db.query(Position).filter(Position.portfolio_id == 1).delete()
    db.query(Trade).filter(Trade.portfolio_id == 1).delete()
    db.commit()

    return {"message": "模拟账户已重置，初始资金100万元"}

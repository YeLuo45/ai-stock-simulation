"""
Router: 交易闭环API（账户/持仓/交易/行情接口）
实现完整的交易闭环：账户查询、持仓管理、交易记录、实时行情
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Portfolio, Position, Trade
from data.market_data import get_realtime_quotes
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/api/trading", tags=["交易闭环"])

# ============== 手续费费率 ==============
COMMISSION_RATE = 0.0003    # 买入万三佣金（0.03%）
STAMP_TAX_SELL = 0.001      # 卖出千一印花税（0.1%）
TRANSFER_FEE = 0.00002      # 过户费（沪市，0.002%）
MIN_COMMISSION = 5.0        # 最低佣金5元


# ============== Pydantic Models ==============

class AccountResponse(BaseModel):
    """账户信息响应"""
    id: int
    name: str
    cash: float                          # 可用资金
    total_market_value: float            # 总市值
    total_assets: float                  # 总资产 = 资金 + 市值
    total_cost: float                    # 总成本
    total_profit_loss: float             # 累计收益金额
    total_profit_loss_pct: float         # 累计收益率
    today_profit_loss: float             # 今日收益
    today_profit_loss_pct: float         # 今日收益率
    initial_cash: float = 1_000_000.0    # 初始资金
    positions_count: int                 # 持仓数量

    class Config:
        from_attributes = True


class PositionItem(BaseModel):
    """持仓项"""
    id: int
    symbol: str
    name: str
    quantity: int                        # 持仓数量
    avg_cost: float                      # 成本价
    current_price: float                 # 当前价
    market_value: float                  # 市值 = 数量 * 当前价
    profit_loss: float                   # 盈亏金额
    profit_loss_pct: float               # 盈亏比例 %
    today_change_pct: float              # 今日涨跌幅 %

    class Config:
        from_attributes = True


class PositionListResponse(BaseModel):
    """持仓列表响应"""
    positions: List[PositionItem]
    total_market_value: float
    total_profit_loss: float


class BuyRequest(BaseModel):
    """买入请求"""
    symbol: str
    name: str
    quantity: int                        # 买入数量（必须是100的整数倍）
    price: Optional[float] = None        # 指定价格，None表示市价


class SellRequest(BaseModel):
    """卖出请求"""
    quantity: int                         # 卖出数量


class TradeItem(BaseModel):
    """交易记录项"""
    id: int
    symbol: str
    name: str
    trade_type: str                       # "buy" or "sell"
    price: float
    quantity: int
    total_amount: float                  # 成交金额 = price * quantity
    commission: float                    # 手续费
    stamp_tax: float                     # 印花税（仅卖出）
    net_amount: float                    # 净收/支金额
    timestamp: datetime

    class Config:
        from_attributes = True


class TradeListResponse(BaseModel):
    """交易记录列表响应"""
    trades: List[TradeItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class StockPriceResponse(BaseModel):
    """股票实时价格响应"""
    symbol: str
    name: str
    price: float
    change_pct: float                    # 涨跌幅 %
    volume: float                        # 成交量
    pe: Optional[float] = None
    pb: Optional[float] = None
    market_cap: Optional[float] = None   # 总市值（亿元）


# ============== 辅助函数 ==============

def _ensure_portfolio(db: Session) -> Portfolio:
    """确保默认投资组合存在"""
    portfolio = db.query(Portfolio).filter(Portfolio.id == 1).first()
    if not portfolio:
        portfolio = Portfolio(id=1, name="默认模拟账户", cash=1_000_000.0)
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    return portfolio


def _get_today_start() -> datetime:
    """获取今日零点时间"""
    today = datetime.now().date()
    return datetime.combine(today, datetime.min.time())


def _calculate_commission(trade_value: float, is_sell: bool = False) -> dict:
    """计算手续费"""
    commission = max(trade_value * COMMISSION_RATE, MIN_COMMISSION)
    stamp_tax = 0.0
    if is_sell:
        stamp_tax = trade_value * STAMP_TAX_SELL
        commission += stamp_tax
        # 过户费（仅沪市，简化处理按成交金额的万分之0.2）
        transfer_fee = trade_value * TRANSFER_FEE
        commission += transfer_fee
    return {
        "commission": round(commission, 2),
        "stamp_tax": round(stamp_tax, 2)
    }


def _update_position_prices(db: Session, positions: list) -> dict:
    """批量更新持仓的实时价格，返回今日涨跌信息"""
    if not positions:
        return {}
    
    symbols = [p.symbol for p in positions]
    quotes = {q["symbol"]: q for q in get_realtime_quotes(symbols)}
    
    price_info = {}
    for pos in positions:
        quote = quotes.get(pos.symbol, {})
        current_price = quote.get("price", pos.current_price or pos.avg_cost)
        change_pct = quote.get("change_pct", 0.0)
        
        # 更新持仓价格
        pos.current_price = current_price
        
        # 计算盈亏
        market_value = pos.quantity * current_price
        cost_basis = pos.quantity * pos.avg_cost
        profit_loss = market_value - cost_basis
        profit_loss_pct = (profit_loss / cost_basis * 100) if cost_basis > 0 else 0
        
        price_info[pos.symbol] = {
            "current_price": current_price,
            "change_pct": change_pct,
            "market_value": market_value,
            "profit_loss": profit_loss,
            "profit_loss_pct": round(profit_loss_pct, 2)
        }
    
    db.commit()
    return price_info


# ============== API 接口 ==============

@router.get("/account", response_model=AccountResponse)
def get_account(db: Session = Depends(get_db)):
    """
    获取账户信息
    - 可用资金、总资产、今日收益、累计收益
    """
    portfolio = _ensure_portfolio(db)
    positions = db.query(Position).filter(
        Position.portfolio_id == 1,
        Position.quantity > 0
    ).all()
    
    # 更新持仓实时价格
    price_info = _update_position_prices(db, positions)
    
    # 计算汇总数据
    total_market_value = sum(info["market_value"] for info in price_info.values())
    total_cost = sum(p.quantity * p.avg_cost for p in positions)
    total_profit_loss = total_market_value - total_cost
    total_profit_loss_pct = (total_profit_loss / total_cost * 100) if total_cost > 0 else 0
    
    # 计算今日收益（基于持仓的今日涨跌）
    today_profit_loss = 0.0
    for pos in positions:
        info = price_info.get(pos.symbol, {})
        change_pct = info.get("change_pct", 0.0)
        # 今日收益 ≈ 持仓市值 * 涨跌幅
        market_value = info.get("market_value", pos.quantity * pos.current_price)
        today_profit_loss += market_value * (change_pct / 100)
    
    today_profit_loss_pct = (today_profit_loss / (total_market_value + portfolio.cash) * 100) if total_market_value > 0 else 0
    
    return AccountResponse(
        id=portfolio.id,
        name=portfolio.name,
        cash=round(portfolio.cash, 2),
        total_market_value=round(total_market_value, 2),
        total_assets=round(portfolio.cash + total_market_value, 2),
        total_cost=round(total_cost, 2),
        total_profit_loss=round(total_profit_loss, 2),
        total_profit_loss_pct=round(total_profit_loss_pct, 2),
        today_profit_loss=round(today_profit_loss, 2),
        today_profit_loss_pct=round(today_profit_loss_pct, 2),
        positions_count=len(positions)
    )


@router.get("/positions", response_model=PositionListResponse)
def get_positions(db: Session = Depends(get_db)):
    """
    获取持仓列表（含实时价格和盈亏）
    """
    portfolio = _ensure_portfolio(db)
    positions = db.query(Position).filter(
        Position.portfolio_id == 1,
        Position.quantity > 0
    ).all()
    
    # 更新持仓实时价格
    price_info = _update_position_prices(db, positions)
    
    position_items = []
    total_market_value = 0.0
    total_profit_loss = 0.0
    
    for pos in positions:
        info = price_info.get(pos.symbol, {})
        current_price = info.get("current_price", pos.current_price or pos.avg_cost)
        change_pct = info.get("change_pct", 0.0)
        market_value = info.get("market_value", pos.quantity * current_price)
        profit_loss = info.get("profit_loss", 0.0)
        profit_loss_pct = info.get("profit_loss_pct", 0.0)
        
        total_market_value += market_value
        total_profit_loss += profit_loss
        
        position_items.append(PositionItem(
            id=pos.id,
            symbol=pos.symbol,
            name=pos.name or pos.symbol,
            quantity=pos.quantity,
            avg_cost=round(pos.avg_cost, 2),
            current_price=round(current_price, 2),
            market_value=round(market_value, 2),
            profit_loss=round(profit_loss, 2),
            profit_loss_pct=profit_loss_pct,
            today_change_pct=round(change_pct, 2)
        ))
    
    return PositionListResponse(
        positions=position_items,
        total_market_value=round(total_market_value, 2),
        total_profit_loss=round(total_profit_loss, 2)
    )


@router.post("/positions", response_model=TradeItem)
def buy_stock(req: BuyRequest, db: Session = Depends(get_db)):
    """
    买入股票
    - 数量必须是100的整数倍（A股规则）
    - 支持指定价格或市价
    - 手续费：买入万三佣金（最低5元）
    """
    portfolio = _ensure_portfolio(db)
    
    # 验证数量（必须是100的整数倍）
    if req.quantity % 100 != 0:
        raise HTTPException(status_code=400, detail="买入数量必须是100的整数倍")
    
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="买入数量必须大于0")
    
    # 获取实时价格
    quotes = get_realtime_quotes([req.symbol])
    if not quotes:
        raise HTTPException(status_code=400, detail=f"无法获取 {req.symbol} 的行情数据")
    
    quote = quotes[0]
    price = req.price if req.price else quote["price"]
    name = req.name or quote.get("name", req.symbol)
    
    if price <= 0:
        raise HTTPException(status_code=400, detail="价格必须大于0")
    
    # 计算成交金额和手续费
    trade_value = price * req.quantity
    fee_info = _calculate_commission(trade_value, is_sell=False)
    commission = fee_info["commission"]
    total_cost = trade_value + commission  # 买入总支出
    
    # 检查资金是否充足
    if total_cost > portfolio.cash:
        raise HTTPException(
            status_code=400,
            detail=f"资金不足。需要: {total_cost:.2f}元（含佣金{commission:.2f}元），可用: {portfolio.cash:.2f}元"
        )
    
    # 更新资金
    portfolio.cash -= total_cost
    
    # 更新或创建持仓
    position = db.query(Position).filter(
        Position.portfolio_id == 1,
        Position.symbol == req.symbol
    ).first()
    
    if position:
        # 补仓：重新计算加权平均成本
        total_shares = position.quantity + req.quantity
        total_cost_basis = position.quantity * position.avg_cost + req.quantity * price
        position.avg_cost = total_cost_basis / total_shares
        position.quantity = total_shares
        position.name = name
        position.current_price = price
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
    
    # 记录交易
    trade = Trade(
        portfolio_id=1,
        symbol=req.symbol,
        name=name,
        trade_type="buy",
        price=price,
        quantity=req.quantity,
        commission=commission
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    db.refresh(position)
    
    return TradeItem(
        id=trade.id,
        symbol=trade.symbol,
        name=trade.name,
        trade_type=trade.trade_type,
        price=trade.price,
        quantity=trade.quantity,
        total_amount=round(trade_value, 2),
        commission=commission,
        stamp_tax=0.0,
        net_amount=-round(total_cost, 2),  # 买入为支出
        timestamp=trade.timestamp
    )


@router.delete("/positions/{position_id}", response_model=TradeItem)
def sell_stock(position_id: int, req: SellRequest, db: Session = Depends(get_db)):
    """
    卖出股票（支持部分卖出）
    - 卖出数量必须大于0且不超过持仓数量
    - 手续费：万三佣金 + 千一印花税 + 万分之0.2过户费（沪市）
    """
    portfolio = _ensure_portfolio(db)
    
    # 获取持仓
    position = db.query(Position).filter(
        Position.id == position_id,
        Position.portfolio_id == 1
    ).first()
    
    if not position:
        raise HTTPException(status_code=404, detail="持仓不存在")
    
    if position.quantity < req.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"持仓不足。可卖出数量: {position.quantity}"
        )
    
    # 获取实时价格
    quotes = get_realtime_quotes([position.symbol])
    if not quotes:
        raise HTTPException(status_code=400, detail=f"无法获取 {position.symbol} 的行情数据")
    
    quote = quotes[0]
    price = quote["price"]
    name = position.name or quote.get("name", position.symbol)
    
    # 计算成交金额和手续费
    trade_value = price * req.quantity
    fee_info = _calculate_commission(trade_value, is_sell=True)
    commission = fee_info["commission"]
    stamp_tax = fee_info["stamp_tax"]
    net_amount = trade_value - commission  # 卖出净收入
    
    # 更新资金
    portfolio.cash += net_amount
    
    # 更新持仓
    position.quantity -= req.quantity
    position.current_price = price
    
    if position.quantity == 0:
        db.delete(position)
    
    # 记录交易
    trade = Trade(
        portfolio_id=1,
        symbol=position.symbol,
        name=name,
        trade_type="sell",
        price=price,
        quantity=req.quantity,
        commission=commission
    )
    db.add(trade)
    db.commit()
    db.refresh(trade)
    
    return TradeItem(
        id=trade.id,
        symbol=trade.symbol,
        name=trade.name,
        trade_type=trade.trade_type,
        price=trade.price,
        quantity=trade.quantity,
        total_amount=round(trade_value, 2),
        commission=commission,
        stamp_tax=stamp_tax,
        net_amount=round(net_amount, 2),  # 卖出为收入
        timestamp=trade.timestamp
    )


@router.get("/trades", response_model=TradeListResponse)
def get_trades(
    symbol: Optional[str] = Query(None, description="股票代码筛选"),
    start_date: Optional[str] = Query(None, description="开始日期，格式YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式YYYY-MM-DD"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db)
):
    """
    获取交易记录（支持分页、股票代码筛选、时间范围筛选）
    """
    query = db.query(Trade).filter(Trade.portfolio_id == 1)
    
    # 按股票代码筛选
    if symbol:
        query = query.filter(Trade.symbol == symbol)
    
    # 按时间范围筛选
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Trade.timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="开始日期格式错误，请使用YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            # 结束日期设为当天结束
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
            query = query.filter(Trade.timestamp <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="结束日期格式错误，请使用YYYY-MM-DD")
    
    # 获取总数
    total = query.count()
    total_pages = (total + page_size - 1) // page_size
    
    # 分页查询
    offset = (page - 1) * page_size
    trades = query.order_by(Trade.timestamp.desc()).offset(offset).limit(page_size).all()
    
    trade_items = []
    for t in trades:
        trade_value = t.price * t.quantity
        stamp_tax = 0.0
        if t.trade_type == "sell":
            stamp_tax = trade_value * STAMP_TAX_SELL
        
        net_amount = -trade_value - t.commission if t.trade_type == "buy" else trade_value - t.commission
        
        trade_items.append(TradeItem(
            id=t.id,
            symbol=t.symbol,
            name=t.name,
            trade_type=t.trade_type,
            price=t.price,
            quantity=t.quantity,
            total_amount=round(trade_value, 2),
            commission=t.commission,
            stamp_tax=round(stamp_tax, 2),
            net_amount=round(net_amount, 2),
            timestamp=t.timestamp
        ))
    
    return TradeListResponse(
        trades=trade_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/stocks/{code}/price", response_model=StockPriceResponse)
def get_stock_price(code: str, db: Session = Depends(get_db)):
    """
    获取股票实时价格
    """
    quotes = get_realtime_quotes([code])
    
    if not quotes:
        raise HTTPException(status_code=404, detail=f"无法获取 {code} 的行情数据")
    
    quote = quotes[0]
    
    if quote.get("price", 0) == 0:
        raise HTTPException(status_code=404, detail=f"股票 {code} 价格数据无效")
    
    return StockPriceResponse(
        symbol=quote["symbol"],
        name=quote.get("name", code),
        price=round(quote["price"], 2),
        change_pct=round(quote.get("change_pct", 0), 2),
        volume=quote.get("volume", 0),
        pe=quote.get("pe"),
        pb=quote.get("pb"),
        market_cap=quote.get("market_cap")
    )

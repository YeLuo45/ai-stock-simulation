/**
 * CSV导出服务
 */
import type { BacktestResponse, BacktestTrade } from '../types';

/**
 * 将回测结果导出为CSV
 */
export function exportBacktestToCSV(result: BacktestResponse): void {
  const lines: string[] = [];
  
  // 1. 基本信息
  lines.push('回测报告');
  lines.push(`策略名称,${result.strategy_name}`);
  lines.push(`总收益率,${result.total_return}%`);
  lines.push(`年化收益率,${result.annual_return}%`);
  lines.push(`最大回撤,${result.max_drawdown}%`);
  lines.push(`夏普比率,${result.sharpe_ratio}`);
  lines.push(`胜率,${result.win_rate}%`);
  lines.push(`盈亏比,${result.profit_loss_ratio}`);
  lines.push(`交易次数,${result.total_trades}`);
  lines.push('');
  
  // 2. 交易记录
  lines.push('交易记录');
  lines.push('日期,标的,类型,价格,数量,金额,盈亏');
  
  for (const trade of result.trades) {
    lines.push([
      trade.date,
      trade.symbol,
      trade.type === 'buy' ? '买入' : '卖出',
      trade.price.toFixed(2),
      trade.quantity,
      trade.amount.toLocaleString(),
      trade.profit !== undefined ? trade.profit.toFixed(2) : '-'
    ].join(','));
  }
  
  lines.push('');
  
  // 3. 月度收益
  lines.push('月度收益');
  lines.push('月份,收益率');
  for (const month of result.monthly_returns) {
    lines.push(`${month.month},${month.return_pct}%`);
  }
  
  lines.push('');
  
  // 4. 收益分布
  lines.push('收益分布');
  lines.push('区间,次数,占比');
  for (const dist of result.return_distribution) {
    lines.push(`${dist.range},${dist.count},${dist.percentage}%`);
  }
  
  lines.push('');
  
  // 5. 资金曲线
  lines.push('资金曲线');
  lines.push('日期,资金');
  for (const point of result.equity_curve) {
    lines.push(`${point.date},${point.value}`);
  }
  
  // 生成CSV字符串并下载
  const csvContent = '\uFEFF' + lines.join('\n'); // UTF-8 BOM
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `回测报告_${result.strategy_name}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出交易记录为CSV（仅交易部分）
 */
export function exportTradesToCSV(trades: BacktestTrade[], strategyName: string): void {
  const lines: string[] = [];
  
  lines.push('日期,标的,类型,价格,数量,金额,盈亏');
  
  for (const trade of trades) {
    lines.push([
      trade.date,
      trade.symbol,
      trade.type === 'buy' ? '买入' : '卖出',
      trade.price.toFixed(2),
      trade.quantity,
      trade.amount.toLocaleString(),
      trade.profit !== undefined ? trade.profit.toFixed(2) : '-'
    ].join(','));
  }
  
  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `交易记录_${strategyName}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

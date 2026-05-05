/**
 * 回测报告导出服务
 */
import type { BacktestResponse, BacktestTrade } from '../types';
import html2canvas from 'html2canvas';

/**
 * 生成回测报告HTML字符串
 */
export function generateBacktestReportHTML(result: BacktestResponse, equityImageBase64?: string): string {
  const date = new Date().toLocaleString('zh-CN')
  const isProfit = result.total_return >= 0

  const tradesRows = result.trades.slice(0, 50).map((t, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${t.date}</td>
      <td>${t.symbol}</td>
      <td class="${t.type === 'buy' ? 'buy' : 'sell'}">${t.type === 'buy' ? '买入' : '卖出'}</td>
      <td class="num">¥${t.price.toFixed(2)}</td>
      <td class="num">${t.quantity}</td>
      <td class="num">¥${t.amount.toLocaleString()}</td>
      <td class="num ${t.profit !== undefined ? (t.profit >= 0 ? 'profit' : 'loss') : ''}">${t.profit !== undefined ? `${t.profit >= 0 ? '+' : ''}¥${t.profit.toFixed(2)}` : '-'}</td>
    </tr>
  `).join('')

  const monthlyRows = result.monthly_returns.map((m, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${m.month}</td>
      <td class="num ${m.return_pct >= 0 ? 'profit' : 'loss'}">${m.return_pct >= 0 ? '+' : ''}${m.return_pct.toFixed(2)}%</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>回测报告 - ${result.strategy_name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #0a0e1a; color: #e2e8f0; padding: 32px; font-size: 14px; }
  .container { max-width: 900px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 32px; }
  .header h1 { font-size: 24px; color: #38bdf8; margin-bottom: 8px; }
  .header .meta { color: #64748b; font-size: 12px; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
  .card h2 { font-size: 15px; color: #38bdf8; border-bottom: 1px solid #1f2937; padding-bottom: 10px; margin-bottom: 14px; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
  .metric { background: #1a2234; border-radius: 8px; padding: 12px; text-align: center; }
  .metric .label { font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .metric .value { font-size: 18px; font-weight: bold; }
  .profit { color: #10b981; }
  .loss { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1a2234; color: #94a3b8; font-weight: 500; text-align: left; padding: 8px 10px; }
  td { padding: 7px 10px; border-bottom: 1px solid #1f2937; }
  .even td { background: #111827; }
  .odd td { background: #0f172a; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .buy { color: #10b981; }
  .sell { color: #ef4444; }
  .chart-img { width: 100%; border-radius: 8px; margin: 12px 0; }
  .footer { text-align: center; color: #475569; font-size: 11px; margin-top: 24px; }
  @media print {
    body { background: white; color: black; padding: 16px; }
    .card { background: white; border-color: #ddd; }
    .metric { background: #f9f9f9; }
    .even td, .odd td { background: white; }
    th { background: #f0f0f0; color: black; }
    .buy { color: green; }
    .sell { color: red; }
    .profit { color: green; }
    .loss { color: red; }
  }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>量化回测报告</h1>
    <div class="meta">策略: ${result.strategy_name} &nbsp;|&nbsp; 生成时间: ${date}</div>
  </div>

  <div class="card">
    <h2>收益指标摘要</h2>
    <div class="metrics">
      <div class="metric">
        <div class="label">总收益率</div>
        <div class="value ${isProfit ? 'profit' : 'loss'}">${isProfit ? '+' : ''}${result.total_return.toFixed(2)}%</div>
      </div>
      <div class="metric">
        <div class="label">年化收益率</div>
        <div class="value ${result.annual_return >= 0 ? 'profit' : 'loss'}">${result.annual_return >= 0 ? '+' : ''}${result.annual_return.toFixed(2)}%</div>
      </div>
      <div class="metric">
        <div class="label">最大回撤</div>
        <div class="value loss">-${result.max_drawdown.toFixed(2)}%</div>
      </div>
      <div class="metric">
        <div class="label">夏普比率</div>
        <div class="value" style="color:#38bdf8">${result.sharpe_ratio.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="label">胜率</div>
        <div class="value" style="color:#a78bfa">${result.win_rate.toFixed(1)}%</div>
      </div>
      <div class="metric">
        <div class="label">盈亏比</div>
        <div class="value" style="color:#fbbf24">${result.profit_loss_ratio.toFixed(2)}</div>
      </div>
      <div class="metric">
        <div class="label">交易次数</div>
        <div class="value">${result.total_trades}</div>
      </div>
    </div>
  </div>

  ${equityImageBase64 ? `
  <div class="card">
    <h2>收益曲线</h2>
    <img class="chart-img" src="${equityImageBase64}" alt="收益曲线" />
  </div>
  ` : ''}

  <div class="card">
    <h2>交易记录 (共 ${result.trades.length} 笔)</h2>
    ${result.trades.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>标的</th>
          <th>类型</th>
          <th class="num">价格</th>
          <th class="num">数量</th>
          <th class="num">金额</th>
          <th class="num">盈亏</th>
        </tr>
      </thead>
      <tbody>${tradesRows}</tbody>
    </table>
    ${result.trades.length > 50 ? `<p style="color:#64748b;font-size:12px;margin-top:8px;text-align:center">显示前50条记录，共${result.trades.length}笔</p>` : ''}
    ` : '<p style="color:#64748b;text-align:center">暂无交易记录</p>'}
  </div>

  <div class="card">
    <h2>月度收益</h2>
    <table>
      <thead>
        <tr>
          <th>月份</th>
          <th class="num">收益率</th>
        </tr>
      </thead>
      <tbody>${monthlyRows}</tbody>
    </table>
  </div>

  <div class="footer">
    由 AI 股票模拟器生成 &nbsp;|&nbsp; 仅供参考，不构成投资建议
  </div>
</div>
</body>
</html>`
}

/**
 * 导出回测报告为HTML文件
 */
export async function exportBacktestToHTML(result: BacktestResponse, equityCurveElementId?: string): Promise<void> {
  let equityImageBase64: string | undefined

  // If a DOM element ID is provided, capture it as an image
  if (equityCurveElementId) {
    const element = document.getElementById(equityCurveElementId)
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: '#111827',
          scale: 2,
        })
        equityImageBase64 = canvas.toDataURL('image/png')
      } catch {
        // fallback: no image
      }
    }
  }

  const html = generateBacktestReportHTML(result, equityImageBase64)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `回测报告_${result.strategy_name}_${new Date().toISOString().split('T')[0]}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 打印回测报告（触发浏览器打印对话框，可另存为PDF）
 */
export async function printBacktestReport(result: BacktestResponse, equityCurveElementId?: string): Promise<void> {
  let equityImageBase64: string | undefined

  if (equityCurveElementId) {
    const element = document.getElementById(equityCurveElementId)
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: '#111827',
          scale: 2,
        })
        equityImageBase64 = canvas.toDataURL('image/png')
      } catch {
        // fallback
      }
    }
  }

  const html = generateBacktestReportHTML(result, equityImageBase64)
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('请允许弹出窗口以打印报告')
    return
  }
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.print()
  }
}

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

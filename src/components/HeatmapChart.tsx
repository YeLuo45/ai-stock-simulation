/**
 * HeatmapChart - Custom heatmap for parameter optimization visualization
 * X-axis = short MA period, Y-axis = long MA period
 * Color scale: green for positive returns, red for negative returns
 */
import { useMemo, useState } from 'react';

export interface HeatmapCell {
  shortPeriod: number;
  longPeriod: number;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  profit_loss_ratio: number;
  total_trades: number;
  annual_return?: number;
}

export interface HeatmapChartProps {
  data: HeatmapCell[];
  onCellClick?: (cell: HeatmapCell) => void;
  cellSize?: number;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  cell: HeatmapCell | null;
}

export default function HeatmapChart({ data, onCellClick, cellSize = 60 }: HeatmapChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    cell: null,
  });

  // Group data by short and long periods to create a 2D grid
  const { gridData, shortPeriods, longPeriods, minReturn, maxReturn } = useMemo(() => {
    const grid: Map<number, Map<number, HeatmapCell>> = new Map();
    const shorts: Set<number> = new Set();
    const longs: Set<number> = new Set();

    for (const cell of data) {
      const short = cell.shortPeriod;
      const long = cell.longPeriod;
      shorts.add(short);
      longs.add(long);

      if (!grid.has(short)) grid.set(short, new Map());
      grid.get(short)!.set(long, cell);
    }

    const shortArr = Array.from(shorts).sort((a, b) => a - b);
    const longArr = Array.from(longs).sort((a, b) => a - b);

    // Find min/max returns for normalization
    let min = Infinity;
    let max = -Infinity;
    for (const cell of data) {
      if (cell.total_return < min) min = cell.total_return;
      if (cell.total_return > max) max = cell.total_return;
    }

    return {
      gridData: grid,
      shortPeriods: shortArr,
      longPeriods: longArr,
      minReturn: min,
      maxReturn: max,
    };
  }, [data]);

  // Get color based on return value
  const getCellColor = (cell: HeatmapCell): string => {
    const absReturn = Math.abs(cell.total_return);
    const maxAbsReturn = Math.max(Math.abs(minReturn), Math.abs(maxReturn));
    const intensity = maxAbsReturn > 0 ? absReturn / maxAbsReturn : 0;

    if (cell.total_return >= 0) {
      // Green: rgba(16, 185, 129, alpha)
      const alpha = 0.2 + intensity * 0.8;
      return `rgba(16, 185, 129, ${alpha})`;
    } else {
      // Red: rgba(239, 68, 68, alpha)
      const alpha = 0.2 + intensity * 0.8;
      return `rgba(239, 68, 68, ${alpha})`;
    }
  };

  const handleMouseEnter = (e: React.MouseEvent, cell: HeatmapCell) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      cell,
    });
  };

  const handleMouseLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const handleClick = (cell: HeatmapCell) => {
    onCellClick?.(cell);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        暂无优化数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="relative inline-block min-w-full">
        {/* X-axis labels (short MA periods) */}
        <div className="flex ml-12 mb-1">
          {shortPeriods.map(short => (
            <div
              key={`x-${short}`}
              className="text-text-muted text-xs text-center"
              style={{ width: cellSize }}
            >
              {short}
            </div>
          ))}
        </div>

        {/* Grid with Y-axis labels */}
        <div className="flex">
          {/* Y-axis labels (long MA periods) */}
          <div className="flex flex-col justify-around mr-1">
            {longPeriods.map(long => (
              <div
                key={`y-${long}`}
                className="text-text-muted text-xs text-right"
                style={{ height: cellSize }}
              >
                {long}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex flex-col justify-around gap-0.5">
            {longPeriods.map(long => (
              <div key={`row-${long}`} className="flex gap-0.5">
                {shortPeriods.map(short => {
                  const cell = gridData.get(short)?.get(long);
                  if (!cell) {
                    return (
                      <div
                        key={`${short}-${long}`}
                        className="bg-bg-tertiary border border-border-color/30"
                        style={{ width: cellSize, height: cellSize }}
                      />
                    );
                  }

                  return (
                    <div
                      key={`${short}-${long}`}
                      className="cursor-pointer transition-all hover:scale-105 hover:z-10"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: getCellColor(cell),
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => handleMouseEnter(e, cell)}
                      onMouseLeave={handleMouseLeave}
                      onClick={() => handleClick(cell)}
                      title={`MA${short}/${long}: ${cell.total_return.toFixed(2)}%`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Axis labels */}
        <div className="mt-2 text-text-muted text-xs text-center">
          短周期MA
        </div>

        {/* Tooltip */}
        {tooltip.visible && tooltip.cell && (
          <div
            className="fixed z-50 bg-bg-primary border border-border-color rounded-lg shadow-xl p-3 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y + 10,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="text-sm font-medium mb-2">
              MA{tooltip.cell.shortPeriod}/MA{tooltip.cell.longPeriod}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">总收益率:</span>
                <span className={tooltip.cell.total_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                  {tooltip.cell.total_return >= 0 ? '+' : ''}{tooltip.cell.total_return.toFixed(2)}%
                </span>
              </div>
              {tooltip.cell.annual_return !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">年化收益:</span>
                  <span className={tooltip.cell.annual_return >= 0 ? 'text-accent-success' : 'text-accent-danger'}>
                    {tooltip.cell.annual_return >= 0 ? '+' : ''}{tooltip.cell.annual_return.toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">最大回撤:</span>
                <span className="text-accent-danger">{tooltip.cell.max_drawdown.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">夏普比率:</span>
                <span className="text-accent-primary">{tooltip.cell.sharpe_ratio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">胜率:</span>
                <span className="text-accent-secondary">{tooltip.cell.win_rate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">盈亏比:</span>
                <span className="text-accent-warning">{tooltip.cell.profit_loss_ratio.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">交易次数:</span>
                <span>{tooltip.cell.total_trades}</span>
              </div>
            </div>
          </div>
        )}

        {/* Color legend */}
        <div className="mt-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)' }} />
            <span className="text-xs text-text-muted">负收益</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-bg-tertiary border border-border-color" />
            <span className="text-xs text-text-muted">中性</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.8)' }} />
            <span className="text-xs text-text-muted">正收益</span>
          </div>
        </div>
      </div>
    </div>
  );
}

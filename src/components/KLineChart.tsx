/**
 * K线图组件 - 使用 lightweight-charts v5 渲染
 */
import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';

interface KLineChartProps {
  data: {
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  }[];
  symbol?: string;
  height?: number;
}

export default function KLineChart({ data, symbol = '', height = 400 }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // 清理旧图表
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#2d2d3a' },
        horzLines: { color: '#2d2d3a' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          width: 1,
          color: '#6b7280',
          style: 2,
        },
        horzLine: {
          width: 1,
          color: '#6b7280',
          style: 2,
        },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    seriesRef.current = candlestickSeries;

    // 转换数据格式
    const chartData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time.split('T')[0] as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    candlestickSeries.setData(chartData);

    // 适应窗口
    chart.timeScale().fitContent();

    // 响应式
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [data, height]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          {symbol ? `${symbol} K线` : 'K线图'}
        </span>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-accent-success" />
            <span>上涨</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-accent-danger" />
            <span>下跌</span>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
    </div>
  );
}

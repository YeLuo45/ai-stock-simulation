/**
 * K线指标面板 - 多窗口版本
 * K线主图 + MACD/RSI/KDJ 副图，十字光标同步
 */
import { useEffect, useRef, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts';

interface KLineData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface KLineChartProps {
  data: KLineData[];
  symbol?: string;
}

// 计算 MACD
function calculateMACD(
  closes: number[]
): { dif: number[]; dea: number[]; hist: number[] } {
  const ema = (arr: number[], period: number): number[] => {
    const result: number[] = [];
    const k = 2 / (period + 1);
    for (let i = 0; i < arr.length; i++) {
      if (i === 0) {
        result.push(arr[i]);
      } else {
        result.push(arr[i] * k + result[i - 1] * (1 - k));
      }
    }
    return result;
  };

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = ema12.map((v, i) => v - ema26[i]);
  const dea = ema(dif, 9);
  const hist = dif.map((v, i) => (v - dea[i]) * 2);
  return { dif, dea, hist };
}

// 计算 RSI
function calculateRSI(closes: number[], period = 14): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(50);
      continue;
    }
    let gain = 0;
    let loss = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gain += change;
      else loss += Math.abs(change);
    }
    const avgGain = gain / period;
    const avgLoss = loss / period;
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

// 计算 KDJ
function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 9,
  kPeriod = 3,
  dPeriod = 3
): { k: number[]; d: number[]; j: number[] } {
  const k: number[] = [];
  const d: number[] = [];
  const j: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      k.push(50);
      d.push(50);
      j.push(50);
      continue;
    }

    let highest = highs[i - period + 1];
    let lowest = lows[i - period + 1];
    for (let n = i - period + 2; n <= i; n++) {
      if (highs[n] > highest) highest = highs[n];
      if (lows[n] < lowest) lowest = lows[n];
    }

    const rsv =
      highest === lowest ? 50 : ((closes[i] - lowest) / (highest - lowest)) * 100;
    const prevK = k.length > 0 ? k[k.length - 1] : 50;
    const prevD = d.length > 0 ? d[d.length - 1] : 50;

    const kVal = (2 / (kPeriod + 1)) * rsv + (1 - 2 / (kPeriod + 1)) * prevK;
    const dVal = (2 / (dPeriod + 1)) * kVal + (1 - 2 / (dPeriod + 1)) * prevD;
    const jVal = 3 * kVal - 2 * dVal;

    k.push(kVal);
    d.push(dVal);
    j.push(jVal);
  }

  return { k, d, j };
}

// 计算 MA
function calculateMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(closes[i]);
    } else {
      const sum = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

export default function KLineChart({ data, symbol = '' }: KLineChartProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const kdjRef = useRef<HTMLDivElement>(null);

  const mainChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const kdjChartRef = useRef<IChartApi | null>(null);

  const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma5SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdDifRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdDeaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const kSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const jSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // 预计算指标数据
  const indicators = useMemo(() => {
    if (data.length === 0) return null;
    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const times = data.map((d) => d.time.split('T')[0]) as Time[];

    const macd = calculateMACD(closes);
    const rsi = calculateRSI(closes, 14);
    const kdj = calculateKDJ(highs, lows, closes, 9, 3, 3);
    const ma5 = calculateMA(closes, 5);
    const ma10 = calculateMA(closes, 10);
    const ma20 = calculateMA(closes, 20);

    return { times, closes, highs, lows, macd, rsi, kdj, ma5, ma10, ma20 };
  }, [data]);

  useEffect(() => {
    if (!mainRef.current || !macdRef.current || !rsiRef.current || !kdjRef.current || !indicators)
      return;

    const { times, macd, rsi, kdj, ma5, ma10, ma20 } = indicators;

    // 清理
    mainChartRef.current?.remove();
    macdChartRef.current?.remove();
    rsiChartRef.current?.remove();
    kdjChartRef.current?.remove();

    const chartOptions = (height: number) => ({
      width: mainRef.current!.clientWidth,
      height,
      layout: { background: { color: '#1a1a2e' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#2d2d3a' }, horzLines: { color: '#2d2d3a' } },
      crosshair: { mode: 1 as const, vertLine: { color: '#6b7280', style: 2 as const, width: 1 as const }, horzLine: { color: '#6b7280', style: 2 as const, width: 1 as const } },
      timeScale: { borderColor: '#374151', timeVisible: true },
      rightPriceScale: { borderColor: '#374151' },
    });

    // 主图
    const mainChart = createChart(mainRef.current, chartOptions(280));
    mainChartRef.current = mainChart;

    const candlestickSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    mainSeriesRef.current = candlestickSeries;

    const candleData: CandlestickData<Time>[] = data.map((d) => ({
      time: d.time.split('T')[0] as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    candlestickSeries.setData(candleData);

    // MA 均线
    const ma5Data: LineData<Time>[] = times.map((t, i) => ({ time: t, value: ma5[i] }));
    const ma10Data: LineData<Time>[] = times.map((t, i) => ({ time: t, value: ma10[i] }));
    const ma20Data: LineData<Time>[] = times.map((t, i) => ({ time: t, value: ma20[i] }));

    ma5SeriesRef.current = mainChart.addSeries(LineSeries, { color: '#00d4ff', lineWidth: 1 });
    ma10SeriesRef.current = mainChart.addSeries(LineSeries, { color: '#ffd700', lineWidth: 1 });
    ma20SeriesRef.current = mainChart.addSeries(LineSeries, { color: '#ff69b4', lineWidth: 1 });
    ma5SeriesRef.current.setData(ma5Data);
    ma10SeriesRef.current.setData(ma10Data);
    ma20SeriesRef.current.setData(ma20Data);

    // MACD 图
    const macdChart = createChart(macdRef.current, chartOptions(100));
    macdChartRef.current = macdChart;

    const macdDifData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: macd.dif[i] }));
    const macdDeaData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: macd.dea[i] }));
    const macdHistData: HistogramData<Time>[] = times.map((t, i) => ({
      time: t,
      value: macd.hist[i],
      color: macd.hist[i] >= 0 ? '#10b981' : '#ef4444',
    }));

    macdDifRef.current = macdChart.addSeries(LineSeries, { color: '#00d4ff', lineWidth: 1 });
    macdDeaRef.current = macdChart.addSeries(LineSeries, { color: '#ffd700', lineWidth: 1 });
    macdHistRef.current = macdChart.addSeries(HistogramSeries, { priceFormat: { type: 'price' }, priceScaleId: '' });
    macdDifRef.current.setData(macdDifData);
    macdDeaRef.current.setData(macdDeaData);
    macdHistRef.current.setData(macdHistData);

    // RSI 图
    const rsiChart = createChart(rsiRef.current, chartOptions(80));
    rsiChartRef.current = rsiChart;

    const rsiData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: rsi[i] }));
    rsiSeriesRef.current = rsiChart.addSeries(LineSeries, { color: '#ff69b4', lineWidth: 1 });
    rsiSeriesRef.current.setData(rsiData);

    // 添加超买超卖线
    const rsi70Data: LineData<Time>[] = times.map((t) => ({ time: t, value: 70 }));
    const rsi30Data: LineData<Time>[] = times.map((t) => ({ time: t, value: 30 }));
    const rsi70Series = rsiChart.addSeries(LineSeries, { color: '#ef4444', lineWidth: 1, lineStyle: 2 });
    const rsi30Series = rsiChart.addSeries(LineSeries, { color: '#10b981', lineWidth: 1, lineStyle: 2 });
    rsi70Series.setData(rsi70Data);
    rsi30Series.setData(rsi30Data);

    // KDJ 图
    const kdjChart = createChart(kdjRef.current, chartOptions(80));
    kdjChartRef.current = kdjChart;

    const kData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: kdj.k[i] }));
    const dData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: kdj.d[i] }));
    const jData: LineData<Time>[] = times.map((t, i) => ({ time: t, value: kdj.j[i] }));

    kSeriesRef.current = kdjChart.addSeries(LineSeries, { color: '#00d4ff', lineWidth: 1 });
    dSeriesRef.current = kdjChart.addSeries(LineSeries, { color: '#ffd700', lineWidth: 1 });
    jSeriesRef.current = kdjChart.addSeries(LineSeries, { color: '#ff69b4', lineWidth: 1 });
    kSeriesRef.current.setData(kData);
    dSeriesRef.current.setData(dData);
    jSeriesRef.current.setData(jData);

    // 同步 timeScale
    mainChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const mainRange = mainChart.timeScale().getVisibleLogicalRange();
      if (mainRange) {
        macdChart.timeScale().setVisibleLogicalRange(mainRange);
        rsiChart.timeScale().setVisibleLogicalRange(mainRange);
        kdjChart.timeScale().setVisibleLogicalRange(mainRange);
      }
    });
    macdChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const macdRange = macdChart.timeScale().getVisibleLogicalRange();
      if (macdRange) {
        mainChart.timeScale().setVisibleLogicalRange(macdRange);
        rsiChart.timeScale().setVisibleLogicalRange(macdRange);
        kdjChart.timeScale().setVisibleLogicalRange(macdRange);
      }
    });
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const rsiRange = rsiChart.timeScale().getVisibleLogicalRange();
      if (rsiRange) {
        mainChart.timeScale().setVisibleLogicalRange(rsiRange);
        macdChart.timeScale().setVisibleLogicalRange(rsiRange);
        kdjChart.timeScale().setVisibleLogicalRange(rsiRange);
      }
    });
    kdjChart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      const kdjRange = kdjChart.timeScale().getVisibleLogicalRange();
      if (kdjRange) {
        mainChart.timeScale().setVisibleLogicalRange(kdjRange);
        macdChart.timeScale().setVisibleLogicalRange(kdjRange);
        rsiChart.timeScale().setVisibleLogicalRange(kdjRange);
      }
    });

    // 十字光标同步
    mainChart.subscribeCrosshairMove((param) => {
      if (param.time) {
        macdChart.setCrosshairPosition(NaN, param.time as Time, macdDifRef.current!);
        rsiChart.setCrosshairPosition(NaN, param.time as Time, rsiSeriesRef.current!);
        kdjChart.setCrosshairPosition(NaN, param.time as Time, kSeriesRef.current!);
      }
    });
    macdChart.subscribeCrosshairMove((param) => {
      if (param.time) {
        mainChart.setCrosshairPosition(NaN, param.time as Time, mainSeriesRef.current!);
        rsiChart.setCrosshairPosition(NaN, param.time as Time, rsiSeriesRef.current!);
        kdjChart.setCrosshairPosition(NaN, param.time as Time, kSeriesRef.current!);
      }
    });
    rsiChart.subscribeCrosshairMove((param) => {
      if (param.time) {
        mainChart.setCrosshairPosition(NaN, param.time as Time, mainSeriesRef.current!);
        macdChart.setCrosshairPosition(NaN, param.time as Time, macdDifRef.current!);
        kdjChart.setCrosshairPosition(NaN, param.time as Time, kSeriesRef.current!);
      }
    });
    kdjChart.subscribeCrosshairMove((param) => {
      if (param.time) {
        mainChart.setCrosshairPosition(NaN, param.time as Time, mainSeriesRef.current!);
        macdChart.setCrosshairPosition(NaN, param.time as Time, macdDifRef.current!);
        rsiChart.setCrosshairPosition(NaN, param.time as Time, rsiSeriesRef.current!);
      }
    });

    // 适应内容
    mainChart.timeScale().fitContent();

    // 响应式
    const handleResize = () => {
      const width = mainRef.current!.clientWidth;
      mainChart.applyOptions({ width });
      macdChart.applyOptions({ width });
      rsiChart.applyOptions({ width });
      kdjChart.applyOptions({ width });
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(mainRef.current);

    return () => {
      observer.disconnect();
      mainChart.remove();
      macdChart.remove();
      rsiChart.remove();
      kdjChart.remove();
    };
  }, [data, indicators]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm font-medium text-text-primary">
          {symbol ? `${symbol} K线` : 'K线图'}
        </span>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#00d4ff]" /><span>MA5</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#ffd700]" /><span>MA10</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-[#ff69b4]" /><span>MA20</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-[#10b981]" /><span>涨</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-[#ef4444]" /><span>跌</span></div>
        </div>
      </div>
      <div ref={mainRef} className="w-full rounded-lg overflow-hidden" />
      <div className="flex items-center px-1 text-xs text-text-muted"><span>MACD (12/26/9)</span></div>
      <div ref={macdRef} className="w-full rounded-lg overflow-hidden" />
      <div className="flex items-center px-1 text-xs text-text-muted"><span>RSI (14)</span></div>
      <div ref={rsiRef} className="w-full rounded-lg overflow-hidden" />
      <div className="flex items-center px-1 text-xs text-text-muted"><span>KDJ (9/3/3)</span></div>
      <div ref={kdjRef} className="w-full rounded-lg overflow-hidden" />
    </div>
  );
}

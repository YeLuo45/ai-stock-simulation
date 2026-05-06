/**
 * KLineChart - Multi-panel K-line chart with technical indicators
 * Uses lightweight-charts v5 for high-performance financial charting
 * 
 * Layout:
 * - Main (60%): K-line + MA5/MA10/MA20
 * - MACD (15%): DIF/DEA lines + histogram
 * - RSI (12.5%): RSI curve + 30/70 overbought/oversold lines
 * - KDJ (12.5%): K/D/J curves
 */
import { useEffect, useRef, useMemo, useState } from "react";
import {
  createChart,
  IChartApi,
  CandlestickData,
  LineData,
  HistogramData,
  Time,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
} from "lightweight-charts";
import type { OHLCV } from "../services/indicators";
import { sma, calculateRSI, calculateMACD, calculateKDJ } from "../services/indicators";

const COLORS = {
  background: "#1a1a2e",
  upColor: "#10b981",
  downColor: "#ef4444",
  upBorder: "#10b981",
  downBorder: "#ef4444",
  ma5: "#00d4ff",
  ma10: "#f59e0b",
  ma20: "#8b5cf6",
  dif: "#00d4ff",
  dea: "#f59e0b",
  macdHistogramUp: "rgba(16, 185, 129, 0.5)",
  macdHistogramDown: "rgba(239, 68, 68, 0.5)",
  rsi: "#ec4899",
  rsi30: "#10b981",
  rsi70: "#ef4444",
  k: "#00d4ff",
  d: "#f59e0b",
  j: "#ec4899",
  grid: "rgba(55, 65, 81, 0.5)",
  crosshair: "rgba(156, 163, 175, 0.5)",
  text: "#9ca3af",
};

interface KLineChartProps {
  data: OHLCV[];
  symbol?: string;
}

export default function KLineChart({ data, symbol }: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const macdChartRef = useRef<IChartApi | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);
  const kdjChartRef = useRef<IChartApi | null>(null);
  const [showMACD, setShowMACD] = useState(true);
  const [showRSI, setShowRSI] = useState(true);
  const [showKDJ, setShowKDJ] = useState(true);

  // Calculate indicators from data
  const indicators = useMemo(() => {
    if (!data || data.length === 0) return null;

    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const times = data.map((d) => d.date as Time);

    // MA calculations
    const ma5Data: LineData[] = closes.map((_, i) => {
      const val = sma(closes.slice(0, i + 1), Math.min(5, i + 1));
      return { time: times[i], value: val };
    });

    const ma10Data: LineData[] = closes.map((_, i) => {
      const val = sma(closes.slice(0, i + 1), Math.min(10, i + 1));
      return { time: times[i], value: val };
    });

    const ma20Data: LineData[] = closes.map((_, i) => {
      const val = sma(closes.slice(0, i + 1), Math.min(20, i + 1));
      return { time: times[i], value: val };
    });

    // RSI calculation (14 period)
    const rsiData: LineData[] = closes.map((_, i) => {
      const period = Math.min(14, i + 1);
      const val = calculateRSI(closes.slice(0, i + 1), period);
      return { time: times[i], value: val };
    });

    // MACD calculation (12, 26, 9)
    const macdResult: { dif: LineData[]; dea: LineData[]; histogram: HistogramData[] } = {
      dif: [],
      dea: [],
      histogram: [],
    };

    for (let i = 0; i < closes.length; i++) {
      const { macd, signal, hist } = calculateMACD(closes.slice(0, i + 1));
      macdResult.dif.push({ time: times[i], value: macd });
      macdResult.dea.push({ time: times[i], value: signal });
      macdResult.histogram.push({
        time: times[i],
        value: hist,
        color: hist >= 0 ? COLORS.macdHistogramUp : COLORS.macdHistogramDown,
      });
    }

    // KDJ calculation (9, 3, 3)
    const kdjResult: { k: LineData[]; d: LineData[]; j: LineData[] } = {
      k: [],
      d: [],
      j: [],
    };

    for (let i = 0; i < closes.length; i++) {
      const period = Math.min(14, i + 1);
      const { k, d, j } = calculateKDJ(
        highs.slice(0, i + 1),
        lows.slice(0, i + 1),
        closes.slice(0, i + 1),
        period
      );
      kdjResult.k.push({ time: times[i], value: k });
      kdjResult.d.push({ time: times[i], value: d });
      kdjResult.j.push({ time: times[i], value: j });
    }

    return {
      times,
      ma5Data,
      ma10Data,
      ma20Data,
      rsiData,
      macdResult,
      kdjResult,
    };
  }, [data]);

  // Format price for display
  const formatPrice = (price: number) => price.toFixed(2);

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0 || !indicators) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const totalHeight = container.clientHeight || 600;

    // Layout heights
    const mainHeight = totalHeight * 0.60;
    const macdHeight = totalHeight * 0.15;
    const rsiHeight = totalHeight * 0.125;
    const kdjHeight = totalHeight * 0.125;

    // Create chart options factory
    const makeChartOptions = (height: number) => ({
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.background },
        textColor: COLORS.text,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: COLORS.grid, style: 1 },
        horzLines: { color: COLORS.grid, style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: COLORS.crosshair,
          labelBackgroundColor: "#374151",
        },
        horzLine: {
          color: COLORS.crosshair,
          labelBackgroundColor: "#374151",
        },
      },
      rightPriceScale: {
        borderColor: COLORS.grid,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: COLORS.grid,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });

    // Main K-line chart
    const mainChart = createChart(container, makeChartOptions(mainHeight));
    mainChartRef.current = mainChart;

    // Candlestick data
    const candlestickData: CandlestickData[] = data.map((d) => ({
      time: d.date as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    // Main candlestick series
    const mainSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: COLORS.upColor,
      downColor: COLORS.downColor,
      borderUpColor: COLORS.upBorder,
      borderDownColor: COLORS.downBorder,
      wickUpColor: COLORS.upColor,
      wickDownColor: COLORS.downColor,
    });
    mainSeries.setData(candlestickData);

    // MA lines on main chart
    const ma5Series = mainChart.addSeries(LineSeries, {
      color: COLORS.ma5,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma5Series.setData(indicators.ma5Data);

    const ma10Series = mainChart.addSeries(LineSeries, {
      color: COLORS.ma10,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma10Series.setData(indicators.ma10Data);

    const ma20Series = mainChart.addSeries(LineSeries, {
      color: COLORS.ma20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    ma20Series.setData(indicators.ma20Data);

    // MACD chart
    if (showMACD) {
      const macdChart = createChart(container, makeChartOptions(macdHeight));
      macdChartRef.current = macdChart;

      // MACD histogram
      const macdHistogram = macdChart.addSeries(HistogramSeries, {
        priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
        priceScaleId: "right",
      });
      macdHistogram.setData(indicators.macdResult.histogram);

      // DIF line
      const difSeries = macdChart.addSeries(LineSeries, {
        color: COLORS.dif,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      difSeries.setData(indicators.macdResult.dif);

      // DEA line
      const deaSeries = macdChart.addSeries(LineSeries, {
        color: COLORS.dea,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      deaSeries.setData(indicators.macdResult.dea);
    }

    // RSI chart
    if (showRSI) {
      const rsiChart = createChart(container, makeChartOptions(rsiHeight));
      rsiChartRef.current = rsiChart;

      // RSI line
      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: COLORS.rsi,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
        priceScaleId: "right",
      });
      rsiSeries.setData(indicators.rsiData);

      // RSI overbought/oversold lines
      const rsi30Data: LineData[] = indicators.times.map((t) => ({ time: t, value: 30 }));
      const rsi70Data: LineData[] = indicators.times.map((t) => ({ time: t, value: 70 }));

      const rsi30Series = rsiChart.addSeries(LineSeries, {
        color: COLORS.rsi30,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      rsi30Series.setData(rsi30Data);

      const rsi70Series = rsiChart.addSeries(LineSeries, {
        color: COLORS.rsi70,
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      rsi70Series.setData(rsi70Data);
    }

    // KDJ chart
    if (showKDJ) {
      const kdjChart = createChart(container, makeChartOptions(kdjHeight));
      kdjChartRef.current = kdjChart;

      // K line
      const kSeries = kdjChart.addSeries(LineSeries, {
        color: COLORS.k,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      kSeries.setData(indicators.kdjResult.k);

      // D line
      const dSeries = kdjChart.addSeries(LineSeries, {
        color: COLORS.d,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      dSeries.setData(indicators.kdjResult.d);

      // J line
      const jSeries = kdjChart.addSeries(LineSeries, {
        color: COLORS.j,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      jSeries.setData(indicators.kdjResult.j);
    }

    // Synchronize time scales across all visible charts
    const syncCharts: IChartApi[] = [mainChart];
    if (showMACD && macdChartRef.current) syncCharts.push(macdChartRef.current);
    if (showRSI && rsiChartRef.current) syncCharts.push(rsiChartRef.current);
    if (showKDJ && kdjChartRef.current) syncCharts.push(kdjChartRef.current);
    syncCharts.forEach((sourceChart) => {
      sourceChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) {
          syncCharts.forEach((target) => {
            if (target !== sourceChart) {
              target.timeScale().setVisibleLogicalRange(range);
            }
          });
        }
      });

      sourceChart.subscribeCrosshairMove((param) => {
        if (param.time) {
          syncCharts.forEach((target) => {
            if (target !== sourceChart) {
              target.setCrosshairPosition(NaN, param.time as Time, mainSeries);
            }
          });
        }
      });
    });

    // Fit content on all charts
    syncCharts.forEach((chart) => chart.timeScale().fitContent());

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth;
      const newHeight = containerRef.current.clientHeight || 600;
      const newMainHeight = newHeight * 0.60;
      const newMacdHeight = newHeight * 0.15;
      const newRsiHeight = newHeight * 0.125;
      const newKdjHeight = newHeight * 0.125;

      mainChart.applyOptions({ width: newWidth, height: newMainHeight });
      if (showMACD && macdChartRef.current) macdChartRef.current.applyOptions({ width: newWidth, height: newMacdHeight });
      if (showRSI && rsiChartRef.current) rsiChartRef.current.applyOptions({ width: newWidth, height: newRsiHeight });
      if (showKDJ && kdjChartRef.current) kdjChartRef.current.applyOptions({ width: newWidth, height: newKdjHeight });
    };

    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      mainChart.remove();
      if (macdChartRef.current) macdChartRef.current.remove();
      if (rsiChartRef.current) rsiChartRef.current.remove();
      if (kdjChartRef.current) kdjChartRef.current.remove();
      mainChartRef.current = null;
      macdChartRef.current = null;
      rsiChartRef.current = null;
      kdjChartRef.current = null;
    };
  }, [data, indicators, showMACD, showRSI, showKDJ]);

  // Legend display
  const renderLegend = () => {
    if (!data || data.length === 0) return null;
    const lastCandle = data[data.length - 1];
    const isUp = lastCandle.close >= lastCandle.open;
    const change = lastCandle.close - lastCandle.open;
    const changePct = (change / lastCandle.open) * 100;

    return (
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-3 text-xs">
        <span className="text-text-primary font-mono">
          {symbol && <span className="text-accent-primary mr-2">{symbol}</span>}
          <span className={isUp ? "text-accent-success" : "text-accent-danger"}>
            {formatPrice(lastCandle.close)}
          </span>
          <span className={isUp ? "text-accent-success" : "text-accent-danger"}>
            {isUp ? " ▲ " : " ▼ "}
            {formatPrice(Math.abs(change))} ({changePct.toFixed(2)}%)
          </span>
        </span>
        <span className="text-text-muted font-mono">
          <span style={{ color: COLORS.ma5 }}>MA5</span>
        </span>
        <span className="text-text-muted font-mono">
          <span style={{ color: COLORS.ma10 }}>MA10</span>
        </span>
        <span className="text-text-muted font-mono">
          <span style={{ color: COLORS.ma20 }}>MA20</span>
        </span>
        <span className="flex gap-1 ml-2">
          <button
            onClick={() => setShowMACD(v => !v)}
            className={`px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${showMACD ? "bg-blue-600 text-white" : "bg-bg-secondary text-text-muted"}`}
          >
            MACD
          </button>
          <button
            onClick={() => setShowRSI(v => !v)}
            className={`px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${showRSI ? "bg-pink-600 text-white" : "bg-bg-secondary text-text-muted"}`}
          >
            RSI
          </button>
          <button
            onClick={() => setShowKDJ(v => !v)}
            className={`px-1.5 py-0.5 rounded text-xs cursor-pointer transition-colors ${showKDJ ? "bg-green-600 text-white" : "bg-bg-secondary text-text-muted"}`}
          >
            KDJ
          </button>
        </span>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      style={{ height: "600px", backgroundColor: COLORS.background }}
    >
      {renderLegend()}
      {showMACD && (
        <div
          className="absolute left-0 right-0 text-center text-text-muted text-xs py-1 pointer-events-none"
          style={{ top: "60%", transform: "translateY(-50%)", height: "15%" }}
        >
          <span className="bg-bg-primary px-2 py-0.5 rounded">MACD(12,26,9)</span>
        </div>
      )}
      {showRSI && (
        <div
          className="absolute left-0 right-0 text-center text-text-muted text-xs py-1 pointer-events-none"
          style={{ top: "75%", transform: "translateY(-50%)", height: "12.5%" }}
        >
          <span className="bg-bg-primary px-2 py-0.5 rounded">RSI(14)</span>
        </div>
      )}
      {showKDJ && (
        <div
          className="absolute left-0 right-0 text-center text-text-muted text-xs py-1 pointer-events-none"
          style={{ top: "87.5%", transform: "translateY(-50%)", height: "12.5%" }}
        >
          <span className="bg-bg-primary px-2 py-0.5 rounded">KDJ(9,3,3)</span>
        </div>
      )}
    </div>
  );
}

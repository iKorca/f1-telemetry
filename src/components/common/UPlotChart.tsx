import React, { useRef, useEffect, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

interface UPlotChartProps {
  options: Partial<uPlot.Options>;
  data: uPlot.AlignedData;
  width?: number;
  height?: number;
  plugins?: uPlot.Plugin[];
}

function UPlotChart({ options, data, width, height, plugins }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const prevSeriesLenRef = useRef<number>(0);

  const createChart = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy existing
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const container = containerRef.current;
    const w = width ?? container.clientWidth;
    const h = height ?? 300;

    const fullOpts: uPlot.Options = {
      ...options,
      width: w,
      height: h,
      plugins: plugins || [],
    } as uPlot.Options;

    chartRef.current = new uPlot(fullOpts, data, container);
    prevSeriesLenRef.current = options.series?.length ?? 0;
  }, [options, data, width, height, plugins]);

  // Create chart on mount
  useEffect(() => {
    createChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
    // Only recreate on mount; updates handled by data/options effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On data change: setData (don't recreate)
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  // On structural option change (series count): recreate
  useEffect(() => {
    const newLen = options.series?.length ?? 0;
    if (newLen !== prevSeriesLenRef.current && chartRef.current) {
      createChart();
    }
  }, [options.series?.length, createChart]);

  // ResizeObserver for responsive width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (chartRef.current && w > 0) {
          chartRef.current.setSize({
            width: w,
            height: height ?? chartRef.current.height,
          });
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, [height]);

  return <div ref={containerRef} />;
}

export default React.memo(UPlotChart);

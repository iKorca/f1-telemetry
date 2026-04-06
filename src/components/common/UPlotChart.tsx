import React, { useRef, useEffect, useMemo } from 'react';
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

  // Track series count to know when to recreate vs just setData
  const seriesCount = options.series?.length ?? 0;

  // Stable key: recreate chart when series structure changes
  // This avoids complex effect dependency issues
  const structureKey = useMemo(() => {
    return `${seriesCount}-${height ?? 300}`;
  }, [seriesCount, height]);

  // Create/recreate chart when structure changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Destroy previous
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // Don't create with empty data
    if (!data || data.length === 0 || !data[0] || data[0].length < 2) return;

    const w = width ?? container.clientWidth ?? 600;
    const h = height ?? 300;

    const fullOpts: uPlot.Options = {
      ...options,
      width: Math.max(w, 100),
      height: h,
      plugins: plugins || [],
    } as uPlot.Options;

    try {
      chartRef.current = new uPlot(fullOpts, data, container);
    } catch (err) {
      console.error('UPlotChart create error:', err);
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
    // Recreate when structure changes (series count, height)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  // Update data without recreating
  useEffect(() => {
    if (!chartRef.current) return;
    if (!data || data.length === 0) return;

    // Verify data array count matches series count
    const expectedLen = chartRef.current.series.length;
    if (data.length !== expectedLen) {
      // Structural mismatch — skip setData, let recreate handle it
      return;
    }

    try {
      chartRef.current.setData(data);
    } catch (err) {
      console.error('UPlotChart setData error:', err);
    }
  }, [data]);

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

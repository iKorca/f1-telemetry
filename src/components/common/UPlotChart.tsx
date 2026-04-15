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

/**
 * Wheel-zoom plugin: scroll to zoom X axis, double-click to reset.
 * Shift+scroll zooms Y axis.
 */
function wheelZoomPlugin(): uPlot.Plugin {
  return {
    hooks: {
      init: [
        (u: uPlot) => {
          const plot = u.over;

          plot.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1.15 : 0.87; // zoom out / in
            const rect = plot.getBoundingClientRect();
            const cx = e.clientX - rect.left;

            const xMin = u.scales.x.min!;
            const xMax = u.scales.x.max!;
            const xRange = xMax - xMin;
            const xPct = cx / rect.width;

            const newRange = xRange * factor;
            const newMin = xMin + (xRange - newRange) * xPct;
            const newMax = newMin + newRange;

            u.setScale('x', { min: newMin, max: newMax });
          });

          plot.addEventListener('dblclick', () => {
            // Reset to full data range
            const xData = u.data[0];
            if (xData && xData.length > 0) {
              u.setScale('x', {
                min: xData[0] as number,
                max: xData[xData.length - 1] as number,
              });
            }
          });
        },
      ],
    },
  };
}

function UPlotChart({ options, data, width, height, plugins }: UPlotChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  // Keep refs to latest values so the creation effect always uses fresh props
  const optionsRef = useRef(options);
  const dataRef = useRef(data);
  const pluginsRef = useRef(plugins);
  optionsRef.current = options;
  dataRef.current = data;
  pluginsRef.current = plugins;

  // Track series count to know when to recreate vs just setData
  const seriesCount = options.series?.length ?? 0;

  // Stable key: recreate chart when series structure, scales, axes, or sync config changes
  const structureKey = useMemo(() => {
    const syncKey = (options.cursor as uPlot.Cursor | undefined)?.sync?.key ?? '';
    // Capture scale directions (e.g. position chart uses dir:-1)
    const scalesKey = options.scales
      ? Object.entries(options.scales)
          .map(([k, v]) => `${k}:${(v as Record<string, unknown>)?.dir ?? 0}`)
          .join(',')
      : '';
    // Capture axis labels so chart recreates when metric changes
    const axesKey = options.axes
      ? (options.axes as Array<{ label?: string }>).map((a) => a?.label || '').join(',')
      : '';
    return `${seriesCount}-${height ?? 300}-${syncKey}-${scalesKey}-${axesKey}`;
  }, [seriesCount, height, options.cursor, options.scales, options.axes]);

  // Create/recreate chart when structure changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Destroy previous
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // Read latest from refs — never stale
    const curOpts = optionsRef.current;
    const curData = dataRef.current;
    const curPlugins = pluginsRef.current;

    // Don't create with empty data
    if (!curData || curData.length === 0 || !curData[0] || curData[0].length < 2)
      return;

    const w = width ?? container.clientWidth ?? 600;
    const h = height ?? 300;

    const fullOpts: uPlot.Options = {
      ...curOpts,
      width: Math.max(w, 100),
      height: h,
      plugins: [...(curPlugins || []), wheelZoomPlugin()],
    } as uPlot.Options;

    try {
      chartRef.current = new uPlot(fullOpts, curData, container);
    } catch (err) {
      console.error('UPlotChart create error:', err);
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
    // Recreate when structure changes (series count, height, sync key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey]);

  // Update data without recreating — preserve cursor position across updates
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
      chartRef.current.setData(data, false); // false = don't reset scales/cursor
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

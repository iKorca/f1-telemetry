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
 * Share the same cursor + x-scale across several charts. Charts opt in by
 * passing `cursor: { sync: withSync('practice') }` in their options — every
 * chart with the same key highlights the same X on hover and zooms together.
 */
export function withSync(key: string, matchX = true): uPlot.Cursor.Sync {
  return {
    key,
    setSeries: true,
    match: [matchX ? (a: string, b: string) => a === b : () => false, () => false],
  } as unknown as uPlot.Cursor.Sync;
}

// ─── Scale sync registry ──────────────────────────────────────────────────────
// Charts sharing the same cursor.sync.key will also share x-scale (zoom + pan).

interface SyncGroup {
  charts: Set<uPlot>;
  broadcasting: boolean;
}

const scaleSyncGroups = new Map<string, SyncGroup>();

function getSyncGroup(key: string): SyncGroup {
  let group = scaleSyncGroups.get(key);
  if (!group) {
    group = { charts: new Set(), broadcasting: false };
    scaleSyncGroups.set(key, group);
  }
  return group;
}

function broadcastScale(key: string, source: uPlot, min: number, max: number) {
  const group = getSyncGroup(key);
  if (group.broadcasting) return; // prevent reentry
  group.broadcasting = true;
  for (const chart of group.charts) {
    if (chart !== source) {
      chart.setScale('x', { min, max });
    }
  }
  group.broadcasting = false;
}

/**
 * Trackpad-aware zoom + pan plugin for macOS:
 * - Pinch-to-zoom (ctrlKey on wheel events) → zoom X axis at cursor position
 * - Two-finger horizontal scroll (regular wheel) → pan X axis
 * - Double-click → reset to full data range
 * - Syncs x-scale across all charts with the same sync key
 */
function wheelZoomPlugin(syncKey?: string): uPlot.Plugin {
  return {
    hooks: {
      init: [
        (u: uPlot) => {
          const plot = u.over;

          // Register in sync group
          if (syncKey) {
            getSyncGroup(syncKey).charts.add(u);
          }

          plot.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();

            const xMin = u.scales.x.min!;
            const xMax = u.scales.x.max!;
            const xRange = xMax - xMin;
            const rect = plot.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const xPct = cx / rect.width;

            if (e.ctrlKey) {
              // ── Pinch-to-zoom (macOS sends ctrlKey + deltaY for pinch) ──
              const factor = e.deltaY > 0 ? 1.1 : 0.91;
              const newRange = xRange * factor;
              const newMin = xMin + (xRange - newRange) * xPct;
              const newMax = newMin + newRange;
              u.setScale('x', { min: newMin, max: newMax });
              if (syncKey) broadcastScale(syncKey, u, newMin, newMax);
            } else {
              // ── Two-finger horizontal scroll → pan ──
              // deltaX = horizontal scroll, deltaY = vertical scroll
              // Use deltaX for horizontal panning; ignore pure vertical scroll
              const dx = e.deltaX;
              if (Math.abs(dx) < 1) return; // ignore pure vertical scroll
              const pxPerUnit = rect.width / xRange;
              const shift = dx / pxPerUnit;
              const newMin = xMin + shift;
              const newMax = xMax + shift;
              u.setScale('x', { min: newMin, max: newMax });
              if (syncKey) broadcastScale(syncKey, u, newMin, newMax);
            }
          });

          plot.addEventListener('dblclick', () => {
            // Reset to full data range
            const xData = u.data[0];
            if (xData && xData.length > 0) {
              const min = xData[0] as number;
              const max = xData[xData.length - 1] as number;
              u.setScale('x', { min, max });
              if (syncKey) broadcastScale(syncKey, u, min, max);
            }
          });
        },
      ],
      destroy: [
        (u: uPlot) => {
          if (syncKey) {
            const group = scaleSyncGroups.get(syncKey);
            if (group) {
              group.charts.delete(u);
              if (group.charts.size === 0) {
                scaleSyncGroups.delete(syncKey);
              }
            }
          }
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

  // Extract sync key from cursor options
  const syncKey = useMemo(() => {
    return (options.cursor as uPlot.Cursor | undefined)?.sync?.key ?? '';
  }, [options.cursor]);

  // Stable key: recreate chart when series structure, scales, axes, title or
  // sync config changes. uPlot bakes these properties in at init time —
  // setData() can't hot-swap them, so we must rebuild the chart instance.
  const structureKey = useMemo(() => {
    const scalesKey = options.scales
      ? Object.entries(options.scales)
          .map(([k, v]) => `${k}:${(v as Record<string, unknown>)?.dir ?? 0}`)
          .join(',')
      : '';
    const axesKey = options.axes
      ? (options.axes as Array<{ label?: string }>).map((a) => a?.label || '').join(',')
      : '';
    const seriesKey = options.series
      ? (options.series as Array<{ label?: string }>).map((s) => s?.label || '').join(',')
      : '';
    const titleKey = (options as { title?: string }).title || '';
    return `${seriesCount}-${height ?? 300}-${syncKey}-${scalesKey}-${axesKey}-${seriesKey}-${titleKey}`;
  }, [seriesCount, height, syncKey, options.scales, options.axes, options.series, options.title]);

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
      plugins: [...(curPlugins || []), wheelZoomPlugin(syncKey || undefined)],
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

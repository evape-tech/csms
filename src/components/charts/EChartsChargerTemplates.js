import React, { useRef, useEffect, useState, Suspense, lazy } from 'react';
const LazyReactECharts = lazy(() => import('echarts-for-react'));

function LazyECharts({ option, style, opts }) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setVisible(true);
              io.disconnect();
              break;
            }
          }
        },
        { rootMargin: '200px' }
      );
      io.observe(el);
      return () => io.disconnect();
    }

    setVisible(true);
  }, []);

  const placeholderStyle = { width: '100%', height: '100%', minHeight: 300 };

  return (
    <div ref={rootRef} style={{ width: '100%', height: '100%' }}>
      {visible ? (
        <Suspense fallback={<div style={placeholderStyle} />}>
          <LazyReactECharts option={option} style={style} opts={opts} />
        </Suspense>
      ) : (
        <div style={placeholderStyle} />
      )}
    </div>
  );
}

export function ChargerBarChartECharts({ periods = [], series = [] }) {
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 30, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: periods },
    yAxis: { type: 'value' },
    legend: { show: true },
    series: series.map(s => ({
      name: s.name,
      type: 'bar',
      data: s.data,
      itemStyle: {},
    })),
  };
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 300, maxHeight: 400 }}>
      <LazyECharts option={option} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export function ChargerLineChartECharts({ periods = [], series = [] }) {
  const option = {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 30, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: periods },
    yAxis: { type: 'value' },
    legend: { show: true },
    series: series.map(s => ({
      name: s.name,
      type: 'line',
      data: s.data,
      smooth: true,
      symbol: 'circle',
      itemStyle: {},
    })),
  };
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 300, maxHeight: 400 }}>
      <LazyECharts option={option} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

export function ChargerPieChartECharts({ data }) {
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: params => `${params.name}: ${params.value}%`,
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      left: 'center',
      itemWidth: 14,
      itemHeight: 14,
      textStyle: { fontSize: 12 },
    },
    series: [
      {
        name: '用電量佔比',
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '45%'],
        data: data.map(item => ({ value: item.value, name: item.name, itemStyle: { color: item.color } })),
        label: {
          formatter: '{b}\n{d}%',
          fontSize: 12,
        },
        labelLine: { length: 10, length2: 10 },
      },
    ],
  };
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 300, maxHeight: 400, boxSizing: 'border-box', boxShadow: 'none' }}>
      <LazyECharts option={option} style={{ width: '100%', height: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}

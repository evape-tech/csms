'use client'
import React, { useRef, useEffect, useState, Suspense, lazy } from 'react';
// lazy load the echarts renderer to avoid loading it until needed
const LazyReactECharts = lazy(() => import('echarts-for-react'));

function LazyECharts({ option, style }) {
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

    // fallback: if IO is not available, just show immediately
    setVisible(true);
  }, []);

  const placeholderStyle = { height: (style && style.height) || 300 };

  return (
    <div ref={rootRef} style={{ width: '100%' }}>
      {visible ? (
        <Suspense fallback={<div style={placeholderStyle} />}>
          <LazyReactECharts option={option} style={style} />
        </Suspense>
      ) : (
        <div style={placeholderStyle} />
      )}
    </div>
  );
}

export function BarChartECharts({ data }) {
  const option = {
    grid: { top: 16, left: 16, right: 16, bottom: 0, containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: params => `${params[0].name}用電量<br/>${params[0].value} kWh`,
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.period),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: data.map(item => item.usage),
        type: 'bar',
        itemStyle: { color: '#8884d8' },
      },
    ],
  };

  return <LazyECharts option={option} style={{ height: 300 }} />;
}

export function AreaChartECharts({ data }) {
  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: params => `${params[0].name}<br/>${params[0].value.toLocaleString()} kWh`,
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.date),
    },
    yAxis: {
      type: 'value',
    },
    series: [
      {
        data: data.map(item => item.total),
        type: 'line',
        areaStyle: { opacity: 0.3 },
        itemStyle: { color: '#8884d8' },
        smooth: true,
      },
    ],
  };

  return <LazyECharts option={option} style={{ height: 300 }} />;
}

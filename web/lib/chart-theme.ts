'use client';

import { useTheme } from 'next-themes';

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== 'light';

  return {
    grid: dark ? '#1e293b' : '#e2e8f0',
    axis: dark ? '#64748b' : '#94a3b8',
    tooltipBg: dark ? '#0f172a' : '#ffffff',
    tooltipBorder: dark ? '#1e293b' : '#e2e8f0',
    tooltipText: dark ? '#e2e8f0' : '#0f172a',
  };
}

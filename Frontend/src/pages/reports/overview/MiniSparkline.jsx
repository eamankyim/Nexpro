import { Line, LineChart, ResponsiveContainer } from 'recharts';

/**
 * Minimal sparkline for KPI cards.
 */
export default function MiniSparkline({ data, positive = true, color }) {
  const stroke = color || (positive ? 'var(--color-primary)' : '#b91c1c');
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 40, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

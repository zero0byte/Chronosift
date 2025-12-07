import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TimelineEntry, ColumnDefinition } from '../types';

interface TimelineChartProps {
  entries: TimelineEntry[];
  columns: ColumnDefinition[];
  // onTimeRangeSelect?: (startTime: Date, endTime: Date) => void;
}

export default function TimelineChart({ entries, columns }: TimelineChartProps) {
  const timestampColumn = columns.find(col => col.column_type === 'timestamp');

  const chartData = useMemo(() => {
    if (!timestampColumn) return [];

    // Group entries by hour
    const groups = new Map<string, number>();

    entries.forEach(entry => {
      const timestamp = entry.data[timestampColumn.name];
      if (!timestamp) return;

      const date = new Date(timestamp);
      // Round to nearest hour
      date.setMinutes(0, 0, 0);
      const key = date.toISOString();

      groups.set(key, (groups.get(key) || 0) + 1);
    });

    // Convert to array and sort
    return Array.from(groups.entries())
      .map(([time, count]) => ({
        time,
        count,
        label: new Date(time).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [entries, timestampColumn]);

  if (!timestampColumn) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No timestamp column found. Add a timestamp column to view the timeline chart.
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No timeline data to display
      </div>
    );
  }

  // Calculate color based on event density
  const maxCount = Math.max(...chartData.map(d => d.count));
  const getColor = (count: number) => {
    const intensity = count / maxCount;
    if (intensity > 0.7) return '#dc3545'; // High activity - red
    if (intensity > 0.4) return '#ffc107'; // Medium activity - yellow
    return '#007bff'; // Low activity - blue
  };

  return (
    <div style={{ width: '100%', height: '300px', backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '4px', border: '1px solid #ddd' }}>
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>📊 Event Distribution Over Time</h4>
        <div style={{ fontSize: '12px', color: '#666' }}>
          <span style={{ marginRight: '12px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#007bff', marginRight: '4px' }}></span>
            Low
          </span>
          <span style={{ marginRight: '12px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#ffc107', marginRight: '4px' }}></span>
            Medium
          </span>
          <span>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#dc3545', marginRight: '4px' }}></span>
            High
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
          <XAxis 
            dataKey="label" 
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div style={{ 
                    backgroundColor: 'white', 
                    padding: '8px 12px', 
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                      {payload[0].payload.label}
                    </div>
                    <div style={{ fontSize: '13px', color: '#007bff' }}>
                      {payload[0].value} events
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.count)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

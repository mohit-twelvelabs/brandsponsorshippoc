import React, { useMemo } from 'react';
import { TimelineChartProps } from '../types';
import { LineChart } from './ui/LineChart';

// Strand masterbrand hex values for chart series — NOT used in classNames
const SERIES_COLORS = [
  '#60E21B', // mb-green
  '#FABA17', // mb-orange
  '#FFB0CD', // mb-pink
  '#FFB592', // mb-peach
  '#30710E', // mb-green-dark
  '#7D5D0C', // mb-orange-dark
];

// Helper function to determine which video a given time belongs to
const getVideoContextForTime = (timeSeconds: number, boundaries: any[]) => {
  return boundaries.find(boundary =>
    timeSeconds >= boundary.start_time_seconds && timeSeconds <= boundary.end_time_seconds
  );
};

const TimelineChart: React.FC<TimelineChartProps> = ({ brandAppearances, containerId, videoBoundaries }) => {
  // Group appearances by brand and create timeline data
  const chartData = useMemo(() => {
    if (!brandAppearances || brandAppearances.length === 0) {
      return { data: [], categories: [] };
    }

    // Group appearances by brand and create time intervals
    const brandTimelines: { [brand: string]: { [time: number]: number } } = {};
    const allTimes = new Set<number>();

    brandAppearances.forEach((appearance) => {
      const brand = appearance.brand;
      if (!brandTimelines[brand]) {
        brandTimelines[brand] = {};
      }
      if (appearance.timeline && appearance.timeline.length === 2) {
        const startTime = Math.floor(appearance.timeline[0] / 60);
        allTimes.add(startTime);
        brandTimelines[brand][startTime] = (brandTimelines[brand][startTime] || 0) + 1;
      }
    });

    if (videoBoundaries) {
      videoBoundaries.forEach(boundary => {
        allTimes.add(Math.floor(boundary.start_time_seconds / 60));
        allTimes.add(Math.floor(boundary.end_time_seconds / 60));
      });
    }

    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    const data = sortedTimes.map(time => {
      const timeSeconds = time * 60;
      const videoContext = videoBoundaries ? getVideoContextForTime(timeSeconds, videoBoundaries) : null;

      const dataPoint: any = {
        time: `${time} min`,
        timeSeconds: timeSeconds,
        videoInfo: videoContext ? `Video: ${videoContext.filename.slice(0, 10)}...` : ''
      };

      Object.keys(brandTimelines).forEach(brand => {
        let cumulative = 0;
        sortedTimes.forEach(t => {
          if (t <= time && brandTimelines[brand][t]) {
            cumulative += brandTimelines[brand][t];
          }
        });
        dataPoint[brand] = cumulative;
      });
      return dataPoint;
    });

    const categories = Object.keys(brandTimelines);

    return { data, categories, colors: SERIES_COLORS };
  }, [brandAppearances, videoBoundaries]);

  if (!brandAppearances || brandAppearances.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-text-secondary font-medium">No timeline data available</p>
          <p className="text-sm text-text-tertiary mt-1">Upload and analyze a video to see brand exposure patterns</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">TIMELINE</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Brand Exposure Over Time</h2>
        <p className="text-base text-text-secondary mt-1">Cumulative brand appearances per minute</p>
      </div>

      {/* Video boundaries indicator for multi-video analysis */}
      {videoBoundaries && videoBoundaries.length > 1 && (
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Video Sequence</p>
          <div className="flex gap-1 h-8 rounded-xl overflow-hidden border border-border">
            {videoBoundaries.map((boundary, index) => {
              const totalDuration = videoBoundaries[videoBoundaries.length - 1].end_time_seconds;
              const duration = boundary.end_time_seconds - boundary.start_time_seconds;
              const widthPercent = (duration / totalDuration) * 100;

              return (
                <div
                  key={boundary.video_id}
                  className="flex items-center justify-center text-xs font-medium text-brand-white px-2"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: index % 2 === 0 ? SERIES_COLORS[0] : SERIES_COLORS[1]
                  }}
                  title={`${boundary.filename} (${Math.round(duration / 60)} min)`}
                >
                  <span className="truncate">Video {index + 1}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-text-tertiary font-mono tabular-nums mt-1">
            <span>0:00</span>
            <span>{Math.round(videoBoundaries[videoBoundaries.length - 1].end_time_seconds / 60)}:00</span>
          </div>
        </div>
      )}

      {/* Chart */}
      <LineChart
        data={chartData.data}
        index="time"
        categories={chartData.categories}
        strokeColors={chartData.colors}
        tooltipBgColor="#1a1a1a"
        tooltipBorderColor="rgba(255,255,255,0.1)"
        gridColor="rgba(0,0,0,0.06)"
        className="h-96"
        valueFormatter={(value) => `${value} appearances`}
      />
    </div>
  );
};

export default TimelineChart;

import React, { useMemo } from 'react';
import { TimelineChartProps } from '../types';
import { LineChart } from './ui/LineChart';
import { Card } from './ui/Card';
import { Text } from './ui/Text';

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
        const startTime = Math.floor(appearance.timeline[0] / 60); // Convert to minutes
        allTimes.add(startTime);
        brandTimelines[brand][startTime] = (brandTimelines[brand][startTime] || 0) + 1;
      }
    });

    // Add video boundary times for better resolution
    if (videoBoundaries) {
      videoBoundaries.forEach(boundary => {
        allTimes.add(Math.floor(boundary.start_time_seconds / 60));
        allTimes.add(Math.floor(boundary.end_time_seconds / 60));
      });
    }

    // Sort times
    const sortedTimes = Array.from(allTimes).sort((a, b) => a - b);

    // Create cumulative data for each brand
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
    const colors = [
      'var(--primary)',
      'var(--accent)', 
      'var(--secondary)',
      'var(--destructive)',
      'var(--muted-foreground)'
    ];

    return { data, categories, colors };
  }, [brandAppearances, videoBoundaries]);

  if (!brandAppearances || brandAppearances.length === 0) {
    return (
      <Card className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">📈</div>
          <Text as="p">No timeline data available</Text>
          <Text as="p" className="text-sm text-muted-foreground">Upload and analyze a video to see brand exposure patterns</Text>
        </div>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Video boundaries indicator for multi-video analysis */}
      {videoBoundaries && videoBoundaries.length > 1 && (
        <div className="mb-4">
          <Text as="h4" className="text-sm font-medium mb-2">Video Sequence Timeline</Text>
          <div className="flex gap-1 h-8 rounded overflow-hidden border">
            {videoBoundaries.map((boundary, index) => {
              const totalDuration = videoBoundaries[videoBoundaries.length - 1].end_time_seconds;
              const duration = boundary.end_time_seconds - boundary.start_time_seconds;
              const widthPercent = (duration / totalDuration) * 100;
              
              return (
                <div
                  key={boundary.video_id}
                  className={`flex items-center justify-center text-xs font-medium text-white px-2 ${
                    index % 2 === 0 ? 'bg-primary' : 'bg-secondary'
                  }`}
                  style={{ width: `${widthPercent}%` }}
                  title={`${boundary.filename} (${Math.round(duration / 60)} min)`}
                >
                  <span className="truncate">
                    Video {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0:00</span>
            <span>{Math.round(videoBoundaries[videoBoundaries.length - 1].end_time_seconds / 60)}:00</span>
          </div>
        </div>
      )}
      
      <LineChart
        data={chartData.data}
        index="time"
        categories={chartData.categories}
        strokeColors={chartData.colors}
        className="h-96"
        valueFormatter={(value) => `${value} appearances`}
      />
    </div>
  );
};

export default TimelineChart;

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { BrandAppearance, PlacementMetrics } from '../types';
import { formatTime } from '../utils/formatters';

// Strand hex values for chart fills — NOT used in classNames
const MB_GREEN = '#60E21B';
const MB_ORANGE = '#FABA17';
const MB_GREEN_DARK = '#30710E';
const MB_ORANGE_DARK = '#7D5D0C';
const BORDER_LIGHT = 'rgba(0,0,0,0.08)';

interface PlacementTimelineProps {
  brandAppearances: BrandAppearance[];
  placementMetrics?: PlacementMetrics;
  videoDuration: number;
  containerId: string;
}

const PlacementTimeline: React.FC<PlacementTimelineProps> = ({
  brandAppearances,
  placementMetrics,
  videoDuration,
  containerId
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 200 });

  // Function to get container dimensions
  const getContainerDimensions = useCallback(() => {
    if (!containerRef.current) return { width: 800, height: 200 };

    const containerRect = containerRef.current.getBoundingClientRect();
    return {
      width: Math.max(containerRect.width || 800, 400),
      height: 200
    };
  }, []);

  // Update dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions(getContainerDimensions());
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getContainerDimensions]);

  useEffect(() => {
    if (!svgRef.current || brandAppearances.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 40, right: 40, bottom: 60, left: 80 };
    const width = dimensions.width - margin.left - margin.right - 32;
    const height = dimensions.height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, videoDuration])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(['optimal', 'suboptimal'])
      .range([0, height])
      .padding(0.3);

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3.axisBottom(xScale)
          .tickFormat((d: d3.NumberValue) => {
            const minutes = Math.floor(Number(d) / 60);
            const seconds = Number(d) % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
          })
      )
      .selectAll('text')
      .style('font-size', '10px')
      .style('font-family', 'ui-monospace, monospace')
      .attr('fill', '#888');

    g.select('.domain').attr('stroke', BORDER_LIGHT);
    g.selectAll('.tick line').attr('stroke', BORDER_LIGHT);

    // Axis label
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 44})`)
      .style('text-anchor', 'middle')
      .style('font-size', '10px')
      .attr('fill', '#888')
      .text('Video Timeline');

    // Y axis labels
    g.append('text')
      .attr('x', -8)
      .attr('y', yScale('optimal')! + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('text-anchor', 'end')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .attr('fill', MB_GREEN_DARK)
      .text('Optimal');

    g.append('text')
      .attr('x', -8)
      .attr('y', yScale('suboptimal')! + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .style('text-anchor', 'end')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .attr('fill', MB_ORANGE_DARK)
      .text('Suboptimal');

    // Track backgrounds
    ['optimal', 'suboptimal'].forEach(quality => {
      g.append('rect')
        .attr('x', 0)
        .attr('y', yScale(quality)!)
        .attr('width', width)
        .attr('height', yScale.bandwidth())
        .attr('fill', BORDER_LIGHT)
        .attr('rx', 6);
    });

    // Placement data
    const placements = placementMetrics?.engagement_windows || brandAppearances.map(app => ({
      time_range: app.timeline,
      duration: app.timeline[1] - app.timeline[0],
      type: app.type,
      quality: 'suboptimal' as const,
      context: app.description
    }));

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', '#1a1a1a')
      .style('color', '#ffffff')
      .style('border-radius', '6px')
      .style('padding', '6px 10px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '9999');

    type PlacementData = typeof placements[0];

    // Placement bars
    g.selectAll('.placement')
      .data(placements)
      .enter().append('rect')
      .attr('class', 'placement')
      .attr('x', (d: PlacementData) => xScale(d.time_range[0]))
      .attr('y', (d: PlacementData) => yScale(d.quality)!)
      .attr('width', (d: PlacementData) => Math.max(xScale(d.time_range[1]) - xScale(d.time_range[0]), 2))
      .attr('height', yScale.bandwidth())
      .attr('fill', (d: PlacementData) => d.quality === 'optimal' ? MB_GREEN : MB_ORANGE)
      .attr('fill-opacity', 0.85)
      .attr('stroke', (d: PlacementData) => d.quality === 'optimal' ? MB_GREEN_DARK : MB_ORANGE_DARK)
      .attr('stroke-width', 1)
      .attr('rx', 4)
      .on('mouseover', (event: MouseEvent, d: PlacementData) => {
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(
          `<strong>${d.type}</strong><br/>Duration: ${d.duration}s<br/>Quality: ${d.quality}${d.context ? `<br/>${d.context.substring(0, 50)}...` : ''}`
        )
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 32) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(300).style('opacity', 0);
      });

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${Math.max(width - 100, 10)}, 10)`);

    legend.append('rect').attr('x', 0).attr('y', 0).attr('width', 14).attr('height', 14)
      .attr('fill', MB_GREEN).attr('rx', 3);
    legend.append('text').attr('x', 18).attr('y', 11)
      .style('font-size', '11px').attr('fill', '#444').text('Optimal');

    legend.append('rect').attr('x', 0).attr('y', 20).attr('width', 14).attr('height', 14)
      .attr('fill', MB_ORANGE).attr('rx', 3);
    legend.append('text').attr('x', 18).attr('y', 31)
      .style('font-size', '11px').attr('fill', '#444').text('Suboptimal');

    return () => {
      tooltip.remove();
    };
  }, [brandAppearances, placementMetrics, videoDuration, dimensions]);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md">
      {/* Header */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">TIMELINE</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Placement Timeline</h2>
        <p className="text-base text-text-secondary mt-1">Brand placement quality over video duration</p>
      </div>

      {/* Legend chips */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-mb-green"></span>
          Optimal Placements: {placementMetrics?.optimal_placements || 0}
        </div>
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-mb-orange"></span>
          Suboptimal: {placementMetrics?.suboptimal_placements || 0}
        </div>
        <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium">
          Screen Time: {formatTime(placementMetrics?.visibility_metrics?.total_screen_time || 0)}
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full overflow-x-auto">
        <svg ref={svgRef} id={containerId} className="w-full"></svg>
      </div>
    </div>
  );
};

export default PlacementTimeline;

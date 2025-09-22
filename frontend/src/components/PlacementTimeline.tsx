import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { BrandAppearance, PlacementMetrics } from '../types';
import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { Badge } from './ui/Badge';
import { formatTime } from '../utils/formatters';

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
      width: Math.max(containerRect.width || 800, 400), // Minimum width of 400px
      height: 200
    };
  }, []);

  // Update dimensions on window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions(getContainerDimensions());
    };

    // Set initial dimensions
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [getContainerDimensions]);

  useEffect(() => {
    if (!svgRef.current || brandAppearances.length === 0) return;

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions with responsive width
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };
    const width = dimensions.width - margin.left - margin.right - 32; // Account for card padding
    const height = dimensions.height - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, videoDuration])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(['optimal', 'suboptimal'])
      .range([0, height])
      .padding(0.3);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale)
        .tickFormat((d: d3.NumberValue) => {
          const minutes = Math.floor(Number(d) / 60);
          const seconds = Number(d) % 60;
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }));

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${width / 2}, ${height + 40})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Video Timeline');

    // Add Y axis labels
    g.append('text')
      .attr('x', -10)
      .attr('y', yScale('optimal')! + yScale.bandwidth() / 2)
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#22c55e')
      .text('Optimal');

    g.append('text')
      .attr('x', -10)
      .attr('y', yScale('suboptimal')! + yScale.bandwidth() / 2)
      .style('text-anchor', 'end')
      .style('font-size', '12px')
      .style('fill', '#f59e0b')
      .text('Suboptimal');

    // Process placement data
    const placements = placementMetrics?.engagement_windows || brandAppearances.map(app => ({
      time_range: app.timeline,
      duration: app.timeline[1] - app.timeline[0],
      type: app.type,
      quality: 'suboptimal' as const,
      context: app.description
    }));

    // Create tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    // Define type for placement data
    type PlacementData = typeof placements[0];

    // Draw placement bars
    g.selectAll('.placement')
      .data(placements)
      .enter().append('rect')
      .attr('class', 'placement')
      .attr('x', (d: PlacementData) => xScale(d.time_range[0]))
      .attr('y', (d: PlacementData) => yScale(d.quality)!)
      .attr('width', (d: PlacementData) => xScale(d.time_range[1]) - xScale(d.time_range[0]))
      .attr('height', yScale.bandwidth())
      .attr('fill', (d: PlacementData) => d.quality === 'optimal' ? '#22c55e' : '#f59e0b')
      .attr('fill-opacity', 0.7)
      .attr('stroke', (d: PlacementData) => d.quality === 'optimal' ? '#16a34a' : '#d97706')
      .attr('stroke-width', 1)
      .on('mouseover', (event: MouseEvent, d: PlacementData) => {
        tooltip.transition().duration(200).style('opacity', .9);
        tooltip.html(`
          <strong>${d.type}</strong><br/>
          Duration: ${d.duration}s<br/>
          Quality: ${d.quality}<br/>
          ${d.context ? `Context: ${d.context.substring(0, 50)}...` : ''}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Add legend (positioned responsively)
    const legend = svg.append('g')
      .attr('transform', `translate(${Math.max(width - 120, 10)}, 10)`);

    legend.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', '#22c55e')
      .attr('fill-opacity', 0.7);

    legend.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .style('font-size', '12px')
      .text('Optimal');

    legend.append('rect')
      .attr('x', 0)
      .attr('y', 20)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', '#f59e0b')
      .attr('fill-opacity', 0.7);

    legend.append('text')
      .attr('x', 20)
      .attr('y', 32)
      .style('font-size', '12px')
      .text('Suboptimal');

    // Cleanup
    return () => {
      tooltip.remove();
    };
  }, [brandAppearances, placementMetrics, videoDuration, dimensions]);

  return (
    <Card className="p-4 w-full">
      <div className="mb-4">
        <Text as="h4" className="text-lg font-medium mb-2">Placement Timeline Analysis</Text>
        <div className="flex gap-4 text-sm">
          <Badge variant="outline" className="bg-green-50">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1 inline-block"></span>
            Optimal Placements: {placementMetrics?.optimal_placements || 0}
          </Badge>
          <Badge variant="outline" className="bg-yellow-50">
            <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1 inline-block"></span>
            Suboptimal: {placementMetrics?.suboptimal_placements || 0}
          </Badge>
          <Badge variant="outline">
            Screen Time: {formatTime(placementMetrics?.visibility_metrics?.total_screen_time || 0)}
          </Badge>
        </div>
      </div>
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} id={containerId} className="w-full"></svg>
      </div>
    </Card>
  );
};

export default PlacementTimeline;

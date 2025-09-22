import React from 'react';
import { BarChart3, Clock, Tv, MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import { SponsorshipBreakdown, BrandAppearance } from '../types';
import { formatTime } from '../utils/formatters';
import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';

interface SponsorshipBreakdownChartProps {
  breakdown: SponsorshipBreakdown;
  appearances?: BrandAppearance[];
  className?: string;
  showDetailedMetrics?: boolean;
}

const SponsorshipBreakdownChart: React.FC<SponsorshipBreakdownChartProps> = ({ 
  breakdown, 
  appearances = [], 
  className = "", 
  showDetailedMetrics = false 
}) => {
  const totalTime = breakdown.ad_placements.exposure_time + breakdown.in_game_placements.exposure_time;
  const totalCount = breakdown.ad_placements.count + breakdown.in_game_placements.count;

  // Calculate additional metrics if detailed view is requested
  const getDetailedMetrics = () => {
    if (!showDetailedMetrics || !appearances.length) return null;

    const adAppearances = appearances.filter(a => a.sponsorship_category === 'ad_placement');
    const inGameAppearances = appearances.filter(a => a.sponsorship_category === 'in_game_placement');

    const avgAdDuration = adAppearances.length > 0 
      ? adAppearances.reduce((sum, app) => sum + (app.timeline[1] - app.timeline[0]), 0) / adAppearances.length 
      : 0;

    const avgInGameDuration = inGameAppearances.length > 0 
      ? inGameAppearances.reduce((sum, app) => sum + (app.timeline[1] - app.timeline[0]), 0) / inGameAppearances.length 
      : 0;

    return {
      avgAdDuration,
      avgInGameDuration,
      adAppearances,
      inGameAppearances
    };
  };

  const detailedMetrics = getDetailedMetrics();

  return (
    <Card className={`p-4 ${className}`}>
      <Text as="h4" className="text-sm font-medium mb-4 flex items-center">
        <BarChart3 className="w-4 h-4 mr-2" />
        Sponsorship Category Breakdown
      </Text>

      <div className="space-y-4">
        {/* Top Row - Category Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ad Placements Card */}
          <div className="relative">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 h-full">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg mr-3">
                    📺
                  </div>
                  <div>
                    <Text as="h5" className="text-sm font-semibold text-blue-900">Ad Placements</Text>
                    <Text as="p" className="text-xs text-blue-700">Commercial & Digital</Text>
                  </div>
                </div>
                <Badge className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {breakdown.ad_placements.percentage_of_total}%
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Text as="p" className="text-2xl font-bold text-blue-900">{breakdown.ad_placements.count}</Text>
                  <Text as="p" className="text-sm font-medium text-blue-700">placements</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text as="p" className="text-lg font-semibold text-blue-800">{formatTime(breakdown.ad_placements.exposure_time)}</Text>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* In-Game Placements Card */}
          <div className="relative">
            <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 h-full">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white text-lg mr-3">
                    🏟️
                  </div>
                  <div>
                    <Text as="h5" className="text-sm font-semibold text-green-900">In-Game Placements</Text>
                    <Text as="p" className="text-xs text-green-700">Organic & Integrated</Text>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {breakdown.in_game_placements.percentage_of_total}%
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <Text as="p" className="text-2xl font-bold text-green-900">{breakdown.in_game_placements.count}</Text>
                  <Text as="p" className="text-sm font-medium text-green-700">placements</Text>
                </div>
                <div className="flex justify-between items-center">
                  <Text as="p" className="text-lg font-semibold text-green-800">{formatTime(breakdown.in_game_placements.exposure_time)}</Text>
                  <Clock className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Visualization */}
        <div className="bg-muted/20 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <Text as="h5" className="text-sm font-medium text-foreground">Distribution by Exposure Time</Text>
            <Text as="p" className="text-sm font-semibold text-muted-foreground">{formatTime(totalTime)} total</Text>
          </div>
          
          <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
            {breakdown.ad_placements.percentage_of_total > 0 && (
              <div 
                className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-500" 
                style={{ width: `${breakdown.ad_placements.percentage_of_total}%` }}
              />
            )}
            {breakdown.in_game_placements.percentage_of_total > 0 && (
              <div 
                className="absolute right-0 top-0 h-full bg-green-500 transition-all duration-500" 
                style={{ width: `${breakdown.in_game_placements.percentage_of_total}%` }}
              />
            )}
          </div>
          
          <div className="flex justify-between text-xs">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-blue-700 font-medium">Ads ({breakdown.ad_placements.percentage_of_total}%)</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span className="text-green-700 font-medium">In-Game ({breakdown.in_game_placements.percentage_of_total}%)</span>
            </div>
          </div>
        </div>

        {/* Detailed Performance Metrics */}
        {showDetailedMetrics && detailedMetrics && (
          <div className="bg-muted/10 rounded-lg p-4">
            <Text as="h5" className="text-sm font-medium mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              Performance Comparison
            </Text>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                  <span className="text-blue-700 font-medium">Avg Ad Duration:</span>
                  <span className="font-bold text-blue-900">{formatTime(detailedMetrics.avgAdDuration)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-50 rounded border-l-4 border-blue-500">
                  <span className="text-blue-700 font-medium">Ad Frequency:</span>
                  <span className="font-bold text-blue-900 flex items-center">
                    {breakdown.ad_placements.count > breakdown.in_game_placements.count ? (
                      <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
                    )}
                    {((breakdown.ad_placements.count / totalCount) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-green-50 rounded border-l-4 border-green-500">
                  <span className="text-green-700 font-medium">Avg In-Game Duration:</span>
                  <span className="font-bold text-green-900">{formatTime(detailedMetrics.avgInGameDuration)}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-green-50 rounded border-l-4 border-green-500">
                  <span className="text-green-700 font-medium">In-Game Frequency:</span>
                  <span className="font-bold text-green-900 flex items-center">
                    {breakdown.in_game_placements.count > breakdown.ad_placements.count ? (
                      <TrendingUp className="w-3 h-3 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500 mr-1" />
                    )}
                    {((breakdown.in_game_placements.count / totalCount) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Insight */}
        {!showDetailedMetrics && (
          <div className="flex items-center justify-center p-3 bg-muted/10 rounded-lg border-l-4 border-primary">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {breakdown.ad_placements.percentage_of_total > breakdown.in_game_placements.percentage_of_total ? (
                <>
                  <Tv className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Ad placements dominate exposure time</span>
                </>
              ) : breakdown.in_game_placements.percentage_of_total > breakdown.ad_placements.percentage_of_total ? (
                <>
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span className="font-medium">In-game placements dominate exposure time</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="font-medium">Balanced exposure time distribution</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default SponsorshipBreakdownChart;

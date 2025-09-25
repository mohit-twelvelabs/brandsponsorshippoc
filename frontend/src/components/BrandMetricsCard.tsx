import React from 'react';
import { Trophy, Clock, Target, MessageSquare, TrendingUp, AlertCircle, CheckCircle, TrendingDown, BarChart3, DollarSign, Users } from 'lucide-react';
import { BrandMetricsCardProps } from '../types';
import { formatTime, formatNumber } from '../utils/formatters';
import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { Badge } from './ui/Badge';
import { Progress } from './ui/Progress';
import SponsorshipBreakdownChart from './SponsorshipBreakdownChart';

const BrandMetricsCard: React.FC<BrandMetricsCardProps> = ({ brandMetrics }) => {
  if (!brandMetrics || brandMetrics.length === 0) {
    return (
      <Card className="p-6">
        <Card.Title className="p-0 mb-4 flex items-center">
          <Trophy className="w-6 h-6 mr-2 text-primary" />
          Brand Performance Analysis
        </Card.Title>
        <div className="text-center py-8">
          <div className="text-muted-foreground mb-2">🏆</div>
          <Text as="p">No brand analysis available</Text>
          <Text as="p" className="text-sm text-muted-foreground">Upload and analyze a video to see brand performance metrics</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <Card.Title className="p-0 mb-6 flex items-center">
        <Trophy className="w-6 h-6 mr-2 text-primary" />
        Brand Performance Analysis
      </Card.Title>

      <div className="space-y-4">
        {brandMetrics.map((brand, index) => {
          const insights = brand.ai_insights;
          
          // Check if AI analysis is available
          if (!insights || insights.error) {
            return (
              <Card key={brand.brand} className="p-4 border-l-4 border-red-500 bg-red-50">
                <div className="flex items-center mb-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <Text as="h4" className="text-lg font-semibold">{brand.brand}</Text>
                </div>
                <Text as="p" className="text-sm text-red-700">
                  AI analysis is required for comprehensive placement insights. Please ensure AI services are available.
                </Text>
                <Text as="p" className="text-xs text-red-600 mt-2">
                  {insights?.error || "Unable to generate analysis"}
                </Text>
              </Card>
            );
          }
          
          const placementScore = insights.placement_effectiveness_score || 0;
          const valueRating = insights.roi_assessment?.value_rating || 'unknown';
          
          return (
            <Card key={brand.brand} className="p-4 border-l-4 border-primary bg-muted/5 border border-muted/20">
              {/* Brand header with placement effectiveness */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏷️'}
                  </div>
                  <div>
                    <Text as="h4" className="text-lg font-semibold">{brand.brand}</Text>
                    <Text as="p" className="text-sm text-muted-foreground">{brand.total_appearances} placements analyzed</Text>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Placement Score</span>
                    <Badge variant={placementScore >= 70 ? 'default' : placementScore >= 40 ? 'secondary' : 'destructive'}>
                      {Math.round(placementScore)}%
                    </Badge>
                  </div>
                  <Text as="p" className="text-xs text-muted-foreground mt-1">
                    Value: <span className={`font-medium ${valueRating === 'excellent' ? 'text-green-600' : valueRating === 'good' ? 'text-blue-600' : valueRating === 'fair' ? 'text-yellow-600' : 'text-red-600'}`}>
                      {valueRating.toUpperCase()}
                    </span>
                  </Text>
                </div>
              </div>

              {/* Sponsorship Category Breakdown - Full Width */}
              {brand.sponsorship_breakdown && (
                <div className="mb-6">
                  <SponsorshipBreakdownChart 
                    breakdown={brand.sponsorship_breakdown}
                    appearances={brand.appearances}
                    className="bg-background w-full"
                    showDetailedMetrics={true}
                  />
                </div>
              )}

              {/* ROI and Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {/* Cost Efficiency */}
                <Card className="text-center p-3 min-h-[90px] flex flex-col justify-center">
                  <DollarSign className="w-4 h-4 mx-auto text-green-600 mb-1" />
                  <Text as="p" className="text-lg font-bold">
                    {insights?.roi_assessment?.cost_efficiency?.toFixed(1) || 'N/A'}
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">Cost Efficiency</Text>
                </Card>

                {/* Audience Reach */}
                <Card className="text-center p-3 min-h-[90px] flex flex-col justify-center">
                  <Users className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                  <Text as="p" className="text-lg font-bold">
                    {insights?.roi_assessment?.audience_reach?.toFixed(1) || 'N/A'}
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">Audience Reach</Text>
                </Card>

                {/* Exposure Quality */}
                <Card className="text-center p-3 min-h-[90px] flex flex-col justify-center">
                  <Target className="w-4 h-4 mx-auto text-pink-600 mb-1" />
                  <Text as="p" className="text-lg font-bold">
                    {insights?.roi_assessment?.exposure_quality?.toFixed(1) || 'N/A'}
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">Quality Score</Text>
                </Card>

                {/* Exposure Time */}
                <Card className="text-center p-3 min-h-[90px] flex flex-col justify-center">
                  <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
                  <Text as="p" className="text-lg font-bold">
                    {formatTime(brand.total_exposure_time || 0)}
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">Screen Time</Text>
                </Card>

                {/* ROI Rating */}
                <Card className="text-center p-3 min-h-[90px] flex flex-col justify-center">
                  <TrendingUp className="w-4 h-4 mx-auto text-green-500 mb-1" />
                  <Text as="p" className="text-lg font-bold">
                    {insights?.roi_projection?.overall_roi_rating?.toFixed(1) || brand.contextual_value_score.toFixed(1)}
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">ROI Rating</Text>
                </Card>

                {/* Est. Impressions */}
                <Card className="text-center p-3 min-h-[90px] flex flex-col justify-center">
                  <MessageSquare className="w-4 h-4 mx-auto text-accent mb-1" />
                  <Text as="p" className="text-lg font-bold">
                    {formatNumber(insights?.roi_projection?.estimated_impressions || brand.estimated_social_mentions)}
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">Est. Impressions</Text>
                </Card>
              </div>

              {/* Key Insights and Recommendations */}
              {insights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Placement Analysis */}
                  <Card className="p-3 bg-background">
                    <Text as="h5" className="text-sm font-medium mb-2 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Placement Analysis
                    </Text>
                    <div className="space-y-2 text-xs">
                      {insights.placement_analysis?.optimal_placements && (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <Text as="p">{insights.placement_analysis.optimal_placements}</Text>
                        </div>
                      )}
                      {insights.placement_analysis?.missed_opportunities?.slice(0, 2).map((opp, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <TrendingDown className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <Text as="p" className="text-muted-foreground">Missed: {opp}</Text>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Immediate Actions */}
                  <Card className="p-3 bg-background">
                    <Text as="h5" className="text-sm font-medium mb-2 flex items-center">
                      <Target className="w-4 h-4 mr-1 text-primary" />
                      Recommended Actions
                    </Text>
                    <div className="space-y-2 text-xs">
                      {insights.recommendations?.immediate_actions?.slice(0, 3).map((action, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1 flex-shrink-0" />
                          <Text as="p">{action}</Text>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Executive Summary */}
              {insights?.executive_summary && (
                <Card className="p-3 mt-4 bg-accent/10 border-accent">
                  <Text as="p" className="text-sm italic">
                    "{insights.executive_summary}"
                  </Text>
                </Card>
              )}
            </Card>
          );
        })}
      </div>
      
      {/* Overall Summary Card */}
      {brandMetrics.length > 0 && brandMetrics[0].ai_insights && (
        <Card className="p-4 mt-4 bg-primary/5 border-primary/20">
          <Text as="h4" className="text-sm font-medium mb-3 flex items-center">
            <Trophy className="w-4 h-4 mr-2" />
            Overall Campaign Assessment
          </Text>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <Text as="h5" className="font-medium text-xs text-muted-foreground mb-1">Optimal Placement Moments</Text>
              <ul className="space-y-1">
                {brandMetrics[0].ai_insights.recommendations?.optimal_moments?.slice(0, 3).map((moment, idx) => (
                  <li key={idx} className="text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {moment}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Text as="h5" className="font-medium text-xs text-muted-foreground mb-1">Future Strategy</Text>
              <ul className="space-y-1">
                {brandMetrics[0].ai_insights.recommendations?.future_strategy?.slice(0, 3).map((strategy, idx) => (
                  <li key={idx} className="text-xs flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-500" />
                    {strategy}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Text as="h5" className="font-medium text-xs text-muted-foreground mb-1">Placements to Avoid</Text>
              <ul className="space-y-1">
                {brandMetrics[0].ai_insights.recommendations?.avoid_these?.slice(0, 3).map((avoid, idx) => (
                  <li key={idx} className="text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    {avoid}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </Card>
  );
};

export default BrandMetricsCard;


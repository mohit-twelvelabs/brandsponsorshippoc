import React from 'react';
import { Card } from '../ui/Card';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Trophy, Target, BarChart3, Zap, Star, AlertTriangle } from 'lucide-react';

interface CompetitiveIntelligenceProps {
  analysisData: any;
}

const CompetitiveIntelligence: React.FC<CompetitiveIntelligenceProps> = ({ analysisData }) => {
  if (!analysisData) {
    return (
      <div className="text-center py-8">
        <Text as="p" className="text-muted-foreground">No analysis data available</Text>
      </div>
    );
  }

  // Calculate real competitive metrics from analysis data
  const totalBrands = analysisData.brand_metrics.length;
  const totalExposureTime = analysisData.brand_metrics.reduce((sum: number, brand: any) => sum + brand.total_exposure_time, 0);
  const topBrand = analysisData.brand_metrics[0];
  
  // Calculate your brand's performance
  const yourBrand = {
    name: topBrand?.brand || 'Your Brand',
    shareOfVoice: Math.round((topBrand?.total_exposure_time / totalExposureTime) * 100),
    prominenceScore: Math.round((topBrand?.avg_prominence || 0) * 10 * 10) / 10,
    categoryDominance: Math.round(((topBrand?.contextual_value_score || 0) / 10) * 150),
    placementQuality: Math.round(((topBrand?.avg_viewer_attention || 0) * 10 + (topBrand?.contextual_value_score || 0)) / 2 * 10) / 10
  };
  
  // Generate competitor analysis from other brands in the data
  const competitors = analysisData.brand_metrics.slice(1, 5).map((brand: any, index: number) => {
    const shareOfVoice = Math.round((brand.total_exposure_time / totalExposureTime) * 100);
    return {
      name: brand.brand,
      shareOfVoice,
      prominenceScore: Math.round(brand.avg_prominence * 10 * 10) / 10,
      placementQuality: Math.round(((brand.avg_viewer_attention * 10 + brand.contextual_value_score) / 2) * 10) / 10,
      screenTime: Math.round(brand.total_exposure_time),
      contextQuality: brand.sentiment_label === 'positive' ? 'Premium' : 
                     brand.sentiment_label === 'neutral' ? 'Standard' : 'Low'
    };
  });
  
  // Add "Others" category if there are more brands
  if (totalBrands > 5) {
    const othersExposure = analysisData.brand_metrics.slice(5).reduce((sum: number, brand: any) => sum + brand.total_exposure_time, 0);
    const othersShareOfVoice = Math.round((othersExposure / totalExposureTime) * 100);
    competitors.push({
      name: 'Others',
      shareOfVoice: othersShareOfVoice,
      prominenceScore: 4.2,
      placementQuality: 4.5,
      screenTime: Math.round(othersExposure),
      contextQuality: 'Mixed'
    });
  }
  
  // Generate threat analysis based on competitor performance
  const threatAnalysis = competitors.slice(0, 2).map((competitor: any) => ({
    competitor: competitor.name,
    threat: competitor.shareOfVoice > 20 ? 'High' : competitor.shareOfVoice > 10 ? 'Medium' : 'Low',
    reason: competitor.shareOfVoice > 20 ? 'High share of voice and screen time' : 
            competitor.placementQuality > 7 ? 'Strong placement quality' : 'Moderate competitive presence',
    recommendation: competitor.shareOfVoice > 20 ? 'Increase placement frequency and quality' :
                   'Monitor placement strategy and optimize timing'
  }));

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getThreatColor = (threat: string) => {
    switch (threat) {
      case 'High': return 'destructive';
      case 'Medium': return 'secondary';
      case 'Low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text as="h3" className="text-xl font-semibold mb-2">Competitive Intelligence</Text>
          <Text as="p" className="text-muted-foreground">
            AI-powered competitive analysis from video understanding and market monitoring
          </Text>
        </div>
      </div>

      {/* Your Brand Performance */}
      <Card className="p-4 border-l-4 border-primary">
        <div className="flex items-center justify-between mb-3">
          <Text as="h4" className="font-medium text-lg">{yourBrand.name} Performance</Text>
          <Trophy className="w-5 h-5 text-primary" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <Text as="p" className="text-2xl font-bold text-primary">#{1}</Text>
            <Text as="p" className="text-xs text-muted-foreground">Market Position</Text>
          </div>
          <div className="text-center">
            <Text as="p" className="text-2xl font-bold">{yourBrand.shareOfVoice}%</Text>
            <Text as="p" className="text-xs text-muted-foreground">Share of Voice</Text>
          </div>
          <div className="text-center">
            <Text as="p" className={`text-2xl font-bold ${getScoreColor(yourBrand.prominenceScore)}`}>
              {yourBrand.prominenceScore}/10
            </Text>
            <Text as="p" className="text-xs text-muted-foreground">Prominence Score</Text>
          </div>
          <div className="text-center">
            <Text as="p" className="text-2xl font-bold text-green-600">{yourBrand.categoryDominance}</Text>
            <Text as="p" className="text-xs text-muted-foreground">Category Index</Text>
          </div>
        </div>
      </Card>

      {/* Competitive Share of Voice */}
      <Card className="p-4">
        <Text as="h4" className="font-medium mb-3">Competitive Share of Voice</Text>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-primary/5 rounded border-l-4 border-primary">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div>
                <Text as="p" className="font-medium">{yourBrand.name}</Text>
                <Text as="p" className="text-xs text-muted-foreground">Leader +6% vs last event</Text>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-24 bg-muted rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full" 
                  style={{ width: `${yourBrand.shareOfVoice}%` }}
                ></div>
              </div>
              <Text as="p" className="text-sm font-bold w-12">{yourBrand.shareOfVoice}%</Text>
            </div>
          </div>

          {competitors.slice(0, 3).map((competitor: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted/10 rounded">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-muted rounded flex items-center justify-center">
                  <span className="text-xs font-medium">#{index + 2}</span>
                </div>
                <div>
                  <Text as="p" className="text-sm font-medium">{competitor.name}</Text>
                  <Text as="p" className="text-xs text-muted-foreground">{competitor.screenTime}s screen time</Text>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-20 bg-muted rounded-full h-2">
                  <div 
                    className="bg-gray-400 h-2 rounded-full" 
                    style={{ width: `${(competitor.shareOfVoice / yourBrand.shareOfVoice) * 100}%` }}
                  ></div>
                </div>
                <Text as="p" className="text-xs font-medium w-8">{competitor.shareOfVoice}%</Text>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Placement Quality Comparison */}
        <Card className="p-4">
          <Text as="h4" className="font-medium mb-3">Placement Quality vs Competitors</Text>
          <div className="space-y-4">
            <div>
              <Text as="h5" className="text-sm font-medium mb-2">Prominence Score Comparison</Text>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm w-20">{yourBrand.name}</span>
                  <div className="flex items-center space-x-2 flex-1">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${(yourBrand.prominenceScore / 10) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-6">{yourBrand.prominenceScore}</span>
                  </div>
                </div>
                {competitors.slice(0, 2).map((competitor: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm w-20">{competitor.name}</span>
                    <div className="flex items-center space-x-2 flex-1">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div 
                          className="bg-gray-400 h-2 rounded-full" 
                          style={{ width: `${(competitor.prominenceScore / 10) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-6">{competitor.prominenceScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Text as="h5" className="text-sm font-medium mb-2">Placement Quality Score</Text>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm w-20">{yourBrand.name}</span>
                  <div className="flex items-center space-x-2 flex-1">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(yourBrand.placementQuality / 10) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-6">{yourBrand.placementQuality}</span>
                  </div>
                </div>
                {competitors.slice(0, 2).map((competitor: any, index: number) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm w-20">{competitor.name}</span>
                    <div className="flex items-center space-x-2 flex-1">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full" 
                          style={{ width: `${(competitor.placementQuality / 10) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium w-6">{competitor.placementQuality}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Threat Analysis */}
        <Card className="p-4">
          <Text as="h4" className="font-medium mb-3">Threat Analysis & Recommendations</Text>
          <div className="space-y-3">
            {threatAnalysis.map((threat: any, index: number) => (
              <div key={index} className="p-3 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <Text as="p" className="font-medium text-sm">{threat.competitor}</Text>
                  </div>
                  <Badge variant={getThreatColor(threat.threat)} className="text-xs">{threat.threat}</Badge>
                </div>
                <Text as="p" className="text-xs text-muted-foreground mb-2">{threat.reason}</Text>
                <div className="p-2 bg-blue-50 rounded text-xs">
                  <span className="font-medium">💡</span> {threat.recommendation}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Category Dominance */}
      <Card className="p-4">
        <Text as="h4" className="font-medium mb-3">Category Dominance Analysis</Text>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-3 bg-green-50 rounded border-l-4 border-green-500">
            <div className="flex items-center space-x-2 mb-2">
              <Star className="w-4 h-4 text-green-500" />
              <Text as="p" className="font-medium text-sm">Market Leader</Text>
            </div>
            <Text as="p" className="text-xl font-bold text-green-600">{yourBrand.categoryDominance}</Text>
            <Text as="p" className="text-xs text-muted-foreground">Category Index Score</Text>
            <Text as="p" className="text-xs text-green-600 mt-1">-40% above category average</Text>
          </div>

          <div className="p-3 bg-blue-50 rounded">
            <Text as="p" className="font-medium mb-2 text-sm">Strengths</Text>
            <ul className="text-xs space-y-1">
              <li className="flex items-center">
                <Zap className="w-3 h-3 text-blue-500 mr-1" />
                Premium placement quality
              </li>
              <li className="flex items-center">
                <Zap className="w-3 h-3 text-blue-500 mr-1" />
                High screen time visibility
              </li>
              <li className="flex items-center">
                <Zap className="w-3 h-3 text-blue-500 mr-1" />
                Consistent brand presence
              </li>
            </ul>
          </div>

          <div className="p-3 bg-yellow-50 rounded">
            <Text as="p" className="font-medium mb-2 text-sm">Opportunities</Text>
            <ul className="text-xs space-y-1">
              <li className="flex items-center">
                <Target className="w-3 h-3 text-yellow-500 mr-1" />
                Increase digital overlays
              </li>
              <li className="flex items-center">
                <Target className="w-3 h-3 text-yellow-500 mr-1" />
                Expand audio mentions
              </li>
              <li className="flex items-center">
                <Target className="w-3 h-3 text-yellow-500 mr-1" />
                Optimize timing strategy
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CompetitiveIntelligence;


import React, { useState } from 'react';
import { BarChart3, Calendar, Target, Download, TrendingUp, AlertTriangle, CheckCircle, Filter, Eye, Heart, Brain, DollarSign, Shield } from 'lucide-react';
import { AnalyticsDashboardProps, TabType, BrandAppearance, AnalysisResponse, MultiVideoAnalysisResponse } from '../types';
import BrandMetricsCard from './BrandMetricsCard';
import TimelineChart from './TimelineChart';
import PlacementTimeline from './PlacementTimeline';
import SponsorshipBreakdownChart from './SponsorshipBreakdownChart';
import ReachAwarenessMetrics from './insights/ReachAwarenessMetrics';
import EngagementMetrics from './insights/EngagementMetrics';
import BrandPerformance from './insights/BrandPerformance';
import BusinessImpact from './insights/BusinessImpact';
import ContentQuality from './insights/ContentQuality';
import ApiService from '../services/api';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Text } from './ui/Text';
import { Badge } from './ui/Badge';

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ analysisData, isLoading, isMultiVideo = false }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [exportLoading, setExportLoading] = useState(false);
  const [sponsorshipFilter, setSponsorshipFilter] = useState<'all' | 'ad_placement' | 'in_game_placement'>('all');

  // Helper functions to normalize data between single and multi-video formats
  const isMultiVideoData = (data: any): data is MultiVideoAnalysisResponse => {
    return data && 'combined_summary' in data;
  };

  const getSummaryData = () => {
    if (!analysisData) return null;
    
    if (isMultiVideoData(analysisData)) {
      return {
        event_title: `Multi-Video Analysis (${analysisData.combined_summary.total_videos} videos)`,
        video_duration_minutes: analysisData.combined_summary.combined_duration_minutes,
        total_brands_detected: analysisData.combined_summary.total_brands_detected,
        total_brand_appearances: analysisData.combined_summary.total_brand_appearances,
        top_performing_brand: analysisData.combined_summary.top_performing_brand,
        top_brand_score: analysisData.combined_summary.top_brand_score,
        analysis_date: analysisData.analysis_timestamp,
        videos_analyzed: analysisData.combined_summary.videos_analyzed
      };
    } else {
      return analysisData.summary;
    }
  };

  const getBrandMetrics = () => {
    if (!analysisData) return [];
    
    if (isMultiVideoData(analysisData)) {
      return analysisData.combined_brand_metrics;
    } else {
      return analysisData.brand_metrics;
    }
  };

  const getRawDetections = () => {
    if (!analysisData) return [];
    
    if (isMultiVideoData(analysisData)) {
      // Combine all raw detections from individual analyses
      return analysisData.individual_analyses.flatMap(analysis => analysis.raw_detections || []);
    } else {
      return analysisData.raw_detections || [];
    }
  };

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: BarChart3 },
    { id: 'timeline' as TabType, label: 'Timeline', icon: Calendar },
    { id: 'context' as TabType, label: 'Context Analysis', icon: Target },
    { id: 'reach-awareness' as TabType, label: 'Reach & Awareness', icon: Eye },
    { id: 'engagement' as TabType, label: 'Engagement', icon: Heart },
    { id: 'brand-performance' as TabType, label: 'Brand Performance', icon: Brain },
    { id: 'business-impact' as TabType, label: 'Business Impact', icon: DollarSign },
    { id: 'content-quality' as TabType, label: 'Content Quality', icon: Shield },
  ];

  const handleExport = async (format: 'pdf' | 'csv') => {
    try {
      setExportLoading(true);
      await ApiService.generateReport(format);
      // In a real app, you'd handle the download here
      alert(`${format.toUpperCase()} report generation initiated. You will receive an email when ready.`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to generate report');
    } finally {
      setExportLoading(false);
    }
  };

  // Filter detections by sponsorship category
  const getFilteredDetections = (detections: BrandAppearance[]) => {
    if (sponsorshipFilter === 'all') return detections;
    return detections.filter(detection => detection.sponsorship_category === sponsorshipFilter);
  };

  // Calculate overall sponsorship breakdown
  const getOverallSponsorshipBreakdown = () => {
    const brandMetrics = getBrandMetrics();
    if (!brandMetrics || brandMetrics.length === 0) return null;

    let totalAdCount = 0;
    let totalInGameCount = 0;
    let totalAdTime = 0;
    let totalInGameTime = 0;

    brandMetrics.forEach(brand => {
      if (brand.sponsorship_breakdown) {
        totalAdCount += brand.sponsorship_breakdown.ad_placements.count;
        totalInGameCount += brand.sponsorship_breakdown.in_game_placements.count;
        totalAdTime += brand.sponsorship_breakdown.ad_placements.exposure_time;
        totalInGameTime += brand.sponsorship_breakdown.in_game_placements.exposure_time;
      }
    });

    const totalTime = totalAdTime + totalInGameTime;
    
    return {
      ad_placements: {
        count: totalAdCount,
        exposure_time: totalAdTime,
        percentage_of_total: totalTime > 0 ? Math.round((totalAdTime / totalTime) * 100 * 10) / 10 : 0
      },
      in_game_placements: {
        count: totalInGameCount,
        exposure_time: totalInGameTime,
        percentage_of_total: totalTime > 0 ? Math.round((totalInGameTime / totalTime) * 100 * 10) / 10 : 0
      }
    };
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!analysisData) {
    return (
      <Card className="p-6 text-center">
        <div className="text-muted-foreground mb-4">📊</div>
        <Text as="h3" className="mb-2">No Analysis Available</Text>
        <Text as="p" className="text-muted-foreground">Upload a video to see brand sponsorship analytics</Text>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card className="p-6">
        <div className="flex justify-between items-start mb-6">
          <Card.Title className="p-0 flex items-center">
            <BarChart3 className="w-6 h-6 mr-2 text-primary" />
            Executive Summary
          </Card.Title>
          
          <div className="flex space-x-2">
            <Button
              onClick={() => handleExport('pdf')}
              disabled={exportLoading}
              size="sm"
              className="flex items-center"
            >
              <Download className="w-4 h-4 mr-1" />
              Export PDF
            </Button>
            <Button
              onClick={() => handleExport('csv')}
              disabled={exportLoading}
              variant="secondary"
              size="sm"
              className="flex items-center"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4 bg-accent/10 min-h-[100px] flex flex-col">
            <Text as="h4" className="text-sm font-medium text-muted-foreground mb-2">
              {isMultiVideoData(analysisData) ? 'Analysis' : 'Event'}
            </Text>
            <Text as="p" className="text-sm font-semibold flex-grow">{getSummaryData()?.event_title}</Text>
          </Card>
          
          <Card className="p-4 bg-accent/10 min-h-[100px] flex flex-col">
            <Text as="h4" className="text-sm font-medium text-muted-foreground mb-2">
              {isMultiVideoData(analysisData) ? 'Total Duration' : 'Duration'}
            </Text>
            <Text as="p" className="text-lg font-bold flex-grow">{getSummaryData()?.video_duration_minutes} min</Text>
          </Card>
          
          <Card className="p-4 bg-accent/10 min-h-[100px] flex flex-col">
            <Text as="h4" className="text-sm font-medium text-muted-foreground mb-2">Brands Detected</Text>
            <Text as="p" className="text-lg font-bold flex-grow">{getSummaryData()?.total_brands_detected}</Text>
          </Card>
          
          <Card className="p-4 bg-accent/10 min-h-[100px] flex flex-col">
            <Text as="h4" className="text-sm font-medium text-muted-foreground mb-2">Total Appearances</Text>
            <Text as="p" className="text-lg font-bold flex-grow">{getSummaryData()?.total_brand_appearances}</Text>
          </Card>
          
          <Card className="p-4 bg-accent/10 min-h-[100px] flex flex-col">
            <Text as="h4" className="text-sm font-medium text-muted-foreground mb-2">Top Brand</Text>
            <div className="flex-grow">
              <Text as="p" className="text-sm font-semibold">{getSummaryData()?.top_performing_brand || 'N/A'}</Text>
              <Text as="p" className="text-xs text-muted-foreground">Score: {getSummaryData()?.top_brand_score}/10</Text>
            </div>
          </Card>
        </div>

        {/* Multi-video specific info */}
        {isMultiVideoData(analysisData) && (
          <Card className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500">
            <Text as="h4" className="text-sm font-medium mb-2 text-blue-800">Videos Analyzed</Text>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {analysisData.combined_summary.videos_analyzed.map((video, index) => (
                <div key={video.video_id} className="text-xs p-2 bg-white rounded border">
                  <Text as="p" className="font-medium">{video.filename}</Text>
                  <Text as="p" className="text-muted-foreground">{video.duration_minutes} min</Text>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* ROI Quick Insights */}
        {getBrandMetrics()[0]?.ai_insights && !getBrandMetrics()[0]?.ai_insights?.error ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {/* Placement Effectiveness */}
            <Card className="p-4 border-l-4 border-green-500">
              <div className="flex items-start justify-between">
                <div>
                  <Text as="h5" className="text-sm font-medium mb-1">Placement Effectiveness</Text>
                  <Text as="p" className="text-2xl font-bold">
                    {Math.round(getBrandMetrics()[0]?.ai_insights?.placement_effectiveness_score || 0)}%
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">
                    {getBrandMetrics()[0]?.ai_insights?.roi_assessment?.value_rating || 'unknown'} value for money
                  </Text>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
            </Card>
            
            {/* Key Opportunity */}
            <Card className="p-4 border-l-4 border-yellow-500">
              <div className="flex items-start justify-between">
                <div>
                  <Text as="h5" className="text-sm font-medium mb-1">Optimization Potential</Text>
                  <Text as="p" className="text-sm font-medium">
                    {getBrandMetrics()[0]?.ai_insights?.recommendations?.immediate_actions?.[0] || "Review placement strategy"}
                  </Text>
                </div>
                <TrendingUp className="w-5 h-5 text-yellow-500" />
              </div>
            </Card>
            
            {/* Alert */}
            <Card className="p-4 border-l-4 border-red-500">
              <div className="flex items-start justify-between">
                <div>
                  <Text as="h5" className="text-sm font-medium mb-1">Missed Opportunities</Text>
                  <Text as="p" className="text-sm font-medium">
                    {getBrandMetrics()[0]?.ai_insights?.placement_analysis?.missed_opportunities?.length || 0} key moments
                  </Text>
                  <Text as="p" className="text-xs text-muted-foreground">
                    Could improve ROI by {Math.round((100 - (getBrandMetrics()[0]?.ai_insights?.placement_effectiveness_score || 0)) * 0.3)}%
                  </Text>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </Card>
          </div>
        ) : getBrandMetrics()[0]?.ai_insights?.error ? (
          <Card className="p-4 mt-4 border-l-4 border-red-500 bg-red-50">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <div>
                <Text as="h5" className="text-sm font-medium">AI Analysis Required</Text>
                <Text as="p" className="text-xs text-red-600 mt-1">
                  {getBrandMetrics()[0]?.ai_insights?.error || "AI-powered insights are required for comprehensive ROI analysis"}
                </Text>
              </div>
            </div>
          </Card>
        ) : null}
      </Card>

      {/* Tabbed Analytics */}
      <Card>
        {/* Tab Headers */}
        <div className="border-b-2">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <BrandMetricsCard brandMetrics={getBrandMetrics()} />
          )}
          
          {activeTab === 'timeline' && (
            <div className="space-y-6">
              <Text as="h3" className="mb-4">Brand Exposure Timeline</Text>
              
              {/* Placement Effectiveness Timeline */}
              {getBrandMetrics()[0]?.ai_insights?.placement_metrics && !getBrandMetrics()[0]?.ai_insights?.error && (
                <PlacementTimeline
                  brandAppearances={getRawDetections()}
                  placementMetrics={getBrandMetrics()[0]?.ai_insights?.placement_metrics!}
                  videoDuration={(getSummaryData()?.video_duration_minutes || 0) * 60}
                  containerId="placementTimeline"
                />
              )}
              
              {/* Original Timeline Chart */}
              <TimelineChart 
                brandAppearances={getRawDetections()} 
                containerId="timelineChart"
                videoBoundaries={isMultiVideoData(analysisData) ? analysisData.combined_summary.videos_analyzed : undefined}
              />
            </div>
          )}
          
          {activeTab === 'context' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <Text as="h3">Contextual Analysis</Text>
                
                {/* Sponsorship Category Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={sponsorshipFilter === 'all' ? 'default' : 'outline'}
                      onClick={() => setSponsorshipFilter('all')}
                      className="text-xs"
                    >
                      All ({getRawDetections().length})
                    </Button>
                    <Button
                      size="sm"
                      variant={sponsorshipFilter === 'ad_placement' ? 'default' : 'outline'}
                      onClick={() => setSponsorshipFilter('ad_placement')}
                      className="text-xs"
                    >
                      📺 Ads ({getRawDetections().filter(d => d.sponsorship_category === 'ad_placement').length})
                    </Button>
                    <Button
                      size="sm"
                      variant={sponsorshipFilter === 'in_game_placement' ? 'default' : 'outline'}
                      onClick={() => setSponsorshipFilter('in_game_placement')}
                      className="text-xs"
                    >
                      🏟️ In-Game ({getRawDetections().filter(d => d.sponsorship_category === 'in_game_placement').length})
                    </Button>
                  </div>
                </div>
              </div>
              
              {getRawDetections().length > 0 ? (
                <div className="space-y-4">
                  {getFilteredDetections(getRawDetections()).slice(0, 10).map((detection, index) => (
                    <Card key={index} className="p-4 bg-muted/10">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">
                            {detection.sponsorship_category === 'ad_placement' ? 
                              (detection.type === 'ctv_ad' ? '📺' :
                               detection.type === 'overlay_ad' ? '🔳' :
                               detection.type === 'squeeze_ad' ? '📐' :
                               detection.type === 'digital_overlay' ? '📱' : '📺') :
                              (detection.type === 'logo' ? '🏷️' : 
                               detection.type === 'jersey_sponsor' ? '👕' :
                               detection.type === 'stadium_signage' ? '🏟️' :
                               detection.type === 'product_placement' ? '📦' :
                               detection.type === 'audio_mention' ? '🎤' : '🏷️')}
                          </span>
                          <div>
                            <Text as="h4">{detection.brand}</Text>
                            <Badge 
                              variant={detection.sponsorship_category === 'ad_placement' ? 'default' : 'secondary'} 
                              className="text-xs mt-1"
                            >
                              {detection.sponsorship_category === 'ad_placement' ? '📺 Ad Placement' : '🏟️ In-Game'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant={
                            detection.sentiment_context === 'positive' ? 'default' :
                            detection.sentiment_context === 'negative' ? 'destructive' :
                            'secondary'
                          }>
                            {detection.sentiment_context}
                          </Badge>
                          
                          {detection.timeline && (
                            <span className="text-sm text-muted-foreground">
                              {Math.floor(detection.timeline[0] / 60)}:{(detection.timeline[0] % 60).toFixed(0).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <Text as="p" className="text-sm">{detection.description}</Text>
                      
                      <div className="mt-2 flex items-center text-xs">
                        <Badge variant="outline" className="mr-2">
                          {detection.type.replace('_', ' ')}
                        </Badge>
                        {detection.location && (
                          <span className="text-muted-foreground">
                            Position: {detection.location[0]}%, {detection.location[1]}%
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                  
                  {getFilteredDetections(getRawDetections()).length > 10 && (
                    <div className="text-center py-4 text-muted-foreground">
                      +{getFilteredDetections(getRawDetections()).length - 10} more {sponsorshipFilter === 'all' ? 'detections' : sponsorshipFilter === 'ad_placement' ? 'ad placements' : 'in-game placements'}
                    </div>
                  )}
                  
                  {getFilteredDetections(getRawDetections()).length === 0 && sponsorshipFilter !== 'all' && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="w-12 h-12 mx-auto text-muted mb-2" />
                      <p>No {sponsorshipFilter === 'ad_placement' ? 'ad placements' : 'in-game placements'} found</p>
                      <p className="text-sm">Try switching to a different category filter</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto text-muted mb-2" />
                  <p>No contextual data available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reach-awareness' && (
            <ReachAwarenessMetrics analysisData={analysisData} />
          )}
          
          {activeTab === 'engagement' && (
            <EngagementMetrics analysisData={analysisData} />
          )}
          
          
          {activeTab === 'brand-performance' && (
            <BrandPerformance analysisData={analysisData} />
          )}
          
          {activeTab === 'business-impact' && (
            <BusinessImpact analysisData={analysisData} />
          )}
          
          {activeTab === 'content-quality' && (
            <ContentQuality analysisData={analysisData} />
          )}
        </div>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;

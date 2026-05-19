import React, { useState } from 'react';
import { BarChart3, Calendar, Target, Download, TrendingUp, AlertTriangle, CheckCircle, Filter, Eye, Heart, Brain, DollarSign, Shield, Zap } from 'lucide-react';
import { AnalyticsDashboardProps, TabType, BrandAppearance, MultiVideoAnalysisResponse } from '../types';
import BrandMetricsCard from './BrandMetricsCard';
import TimelineChart from './TimelineChart';
import PlacementTimeline from './PlacementTimeline';
import ReachAwarenessMetrics from './insights/ReachAwarenessMetrics';
import EngagementMetrics from './insights/EngagementMetrics';
import BrandPerformance from './insights/BrandPerformance';
import BusinessImpact from './insights/BusinessImpact';
import ContentQuality from './insights/ContentQuality';
import SponsorshipIntelTab from './SponsorshipIntelTab';
import ApiService from '../services/api';
import { Badge } from './ui/Badge';
import { formatTime, formatNumber } from '../utils/formatters';

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
    { id: 'sponsorship-intel' as TabType, label: 'Sponsorship Intel', icon: Zap },
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

  // Compute hero KPIs
  const getTotalSponsorSeconds = () => {
    const metrics = getBrandMetrics();
    return metrics.reduce((sum, b) => sum + (b.total_exposure_time || 0), 0);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md">
        <div className="animate-pulse">
          <div className="h-6 bg-muted rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md text-center">
        <p className="text-text-secondary mb-4">No Analysis Available</p>
        <p className="text-text-tertiary text-sm">Upload a video to see brand sponsorship analytics</p>
      </div>
    );
  }

  const summary = getSummaryData();
  const brandMetrics = getBrandMetrics();
  const dominantBrand = summary?.top_performing_brand || 'All Brands';
  const totalImpressions = summary?.total_brand_appearances ?? 0;
  const totalBrands = summary?.total_brands_detected ?? 0;
  const totalVideos = isMultiVideoData(analysisData) ? analysisData.combined_summary.total_videos : 1;
  const sponsorSeconds = getTotalSponsorSeconds();

  return (
    <div className="space-y-8">
      {/* ── Hero Band ── */}
      <div className="rounded-2xl border border-border bg-card shadow-md overflow-hidden">
        {/* Masterbrand stripe */}
        <div className="h-1 w-full rounded-none bg-gradient-to-r from-mb-green via-mb-orange to-mb-pink" />

        <div className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
            {/* Left: eyebrow + H2 + subtitle */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-2">
                INSIGHTS
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                {dominantBrand}
              </h2>
              <p className="text-base text-text-secondary">
                {formatNumber(totalImpressions)} impressions across {totalVideos} video{totalVideos !== 1 ? 's' : ''} &middot; {formatTime(sponsorSeconds)} of on-screen exposure
              </p>
              {/* Export actions (ghost buttons) */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium border border-border disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exportLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium border border-border disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Right: 3 KPI tiles */}
            <div className="flex flex-row gap-3 flex-shrink-0 flex-wrap">
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1 min-w-[120px]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Total Impressions</p>
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatNumber(totalImpressions)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1 min-w-[120px]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Sponsor-Seconds</p>
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatTime(sponsorSeconds)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1 min-w-[120px]">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Unique Brands</p>
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  {totalBrands}
                </p>
              </div>
            </div>
          </div>

          {/* Multi-video info */}
          {isMultiVideoData(analysisData) && (
            <div className="mt-6 pt-5 border-t border-border-light">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">Videos Analyzed</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {analysisData.combined_summary.videos_analyzed.map((video) => (
                  <div key={video.video_id} className="text-xs p-3 rounded-xl border border-border-light bg-background">
                    <p className="font-medium text-foreground">{video.filename}</p>
                    <p className="text-text-tertiary">{video.duration_minutes} min</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ROI Quick Insights (preserved, restyled) */}
          {brandMetrics[0]?.ai_insights && !brandMetrics[0]?.ai_insights?.error ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mb-1">Placement Effectiveness</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                      {Math.round(brandMetrics[0]?.ai_insights?.placement_effectiveness_score || 0)}%
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      {brandMetrics[0]?.ai_insights?.roi_assessment?.value_rating || 'unknown'} value for money
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-mb-green-dark flex-shrink-0" />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mb-1">Optimization Potential</p>
                    <p className="text-sm font-medium text-foreground mt-1">
                      {brandMetrics[0]?.ai_insights?.recommendations?.immediate_actions?.[0] || "Review placement strategy"}
                    </p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-mb-orange flex-shrink-0" />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mb-1">Missed Opportunities</p>
                    <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                      {brandMetrics[0]?.ai_insights?.placement_analysis?.missed_opportunities?.length || 0}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1">
                      key moments
                    </p>
                  </div>
                  <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
                </div>
              </div>
            </div>
          ) : brandMetrics[0]?.ai_insights?.error ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">AI Analysis Required</p>
                <p className="text-xs text-error mt-0.5">
                  {brandMetrics[0]?.ai_insights?.error || "AI-powered insights are required for comprehensive ROI analysis"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Segmented Tab Nav + Content ── */}
      <div className="space-y-8">
        {/* Segmented control */}
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex p-1 rounded-full bg-card border border-border whitespace-nowrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    activeTab === tab.id
                      ? 'px-4 py-1.5 rounded-full text-sm font-semibold bg-foreground text-brand-white transition-colors flex items-center gap-1.5'
                      : 'px-4 py-1.5 rounded-full text-sm font-medium text-text-secondary hover:text-foreground transition-colors flex items-center gap-1.5'
                  }
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'overview' && (
            <BrandMetricsCard brandMetrics={getBrandMetrics()} />
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-8">
              {getBrandMetrics()[0]?.ai_insights?.placement_metrics && !getBrandMetrics()[0]?.ai_insights?.error && (
                <PlacementTimeline
                  brandAppearances={getRawDetections()}
                  placementMetrics={getBrandMetrics()[0]?.ai_insights?.placement_metrics!}
                  videoDuration={(getSummaryData()?.video_duration_minutes || 0) * 60}
                  containerId="placementTimeline"
                />
              )}

              <TimelineChart
                brandAppearances={getRawDetections()}
                containerId="timelineChart"
                videoBoundaries={isMultiVideoData(analysisData) ? analysisData.combined_summary.videos_analyzed : undefined}
              />
            </div>
          )}

          {activeTab === 'context' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold tracking-tight text-foreground">Contextual Analysis</h3>

                {/* Sponsorship Category Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-text-secondary" />
                  <div className="inline-flex p-1 rounded-full bg-card border border-border">
                    <button
                      onClick={() => setSponsorshipFilter('all')}
                      className={sponsorshipFilter === 'all'
                        ? 'px-4 py-1.5 rounded-full text-sm font-semibold bg-foreground text-brand-white transition-colors'
                        : 'px-4 py-1.5 rounded-full text-sm font-medium text-text-secondary hover:text-foreground transition-colors'}
                    >
                      All ({getRawDetections().length})
                    </button>
                    <button
                      onClick={() => setSponsorshipFilter('ad_placement')}
                      className={sponsorshipFilter === 'ad_placement'
                        ? 'px-4 py-1.5 rounded-full text-sm font-semibold bg-foreground text-brand-white transition-colors'
                        : 'px-4 py-1.5 rounded-full text-sm font-medium text-text-secondary hover:text-foreground transition-colors'}
                    >
                      Ads ({getRawDetections().filter(d => d.sponsorship_category === 'ad_placement').length})
                    </button>
                    <button
                      onClick={() => setSponsorshipFilter('in_game_placement')}
                      className={sponsorshipFilter === 'in_game_placement'
                        ? 'px-4 py-1.5 rounded-full text-sm font-semibold bg-foreground text-brand-white transition-colors'
                        : 'px-4 py-1.5 rounded-full text-sm font-medium text-text-secondary hover:text-foreground transition-colors'}
                    >
                      In-Game ({getRawDetections().filter(d => d.sponsorship_category === 'in_game_placement').length})
                    </button>
                  </div>
                </div>
              </div>

              {getRawDetections().length > 0 ? (
                <div className="space-y-4">
                  {getFilteredDetections(getRawDetections()).slice(0, 10).map((detection, index) => (
                    <div key={index} className="rounded-2xl border border-border bg-card p-5">
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
                            <p className="text-sm font-semibold text-foreground">{detection.brand}</p>
                            <Badge
                              variant={detection.sponsorship_category === 'ad_placement' ? 'default' : 'secondary'}
                              className="text-xs mt-1"
                            >
                              {detection.sponsorship_category === 'ad_placement' ? 'Ad Placement' : 'In-Game'}
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
                            <span className="text-sm text-text-tertiary font-mono tabular-nums">
                              {Math.floor(detection.timeline[0] / 60)}:{(detection.timeline[0] % 60).toFixed(0).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-foreground">{detection.description}</p>

                      <div className="mt-2 flex items-center text-xs">
                        <Badge variant="outline" className="mr-2">
                          {detection.type.replace('_', ' ')}
                        </Badge>
                        {detection.location && (
                          <span className="text-text-tertiary">
                            Position: {detection.location[0]}%, {detection.location[1]}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {getFilteredDetections(getRawDetections()).length > 10 && (
                    <div className="text-center py-4 text-text-secondary text-sm">
                      +{getFilteredDetections(getRawDetections()).length - 10} more {sponsorshipFilter === 'all' ? 'detections' : sponsorshipFilter === 'ad_placement' ? 'ad placements' : 'in-game placements'}
                    </div>
                  )}

                  {getFilteredDetections(getRawDetections()).length === 0 && sponsorshipFilter !== 'all' && (
                    <div className="text-center py-8 text-text-secondary">
                      <Target className="w-12 h-12 mx-auto text-text-tertiary mb-2" />
                      <p>No {sponsorshipFilter === 'ad_placement' ? 'ad placements' : 'in-game placements'} found</p>
                      <p className="text-sm text-text-tertiary">Try switching to a different category filter</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-text-secondary">
                  <Target className="w-12 h-12 mx-auto text-text-tertiary mb-2" />
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

          {activeTab === 'sponsorship-intel' && (
            <SponsorshipIntelTab analysisData={analysisData} isMultiVideo={isMultiVideo} />
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;

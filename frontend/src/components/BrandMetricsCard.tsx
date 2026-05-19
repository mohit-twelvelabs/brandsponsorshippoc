import React, { useState } from 'react';
import { Trophy, Clock, Target, MessageSquare, TrendingUp, AlertCircle, CheckCircle, TrendingDown, DollarSign, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { BrandMetricsCardProps } from '../types';
import { formatTime, formatNumber } from '../utils/formatters';
import SponsorshipBreakdownChart from './SponsorshipBreakdownChart';

const BrandMetricsCard: React.FC<BrandMetricsCardProps> = ({ brandMetrics }) => {
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  const toggleExpand = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev);
      if (next.has(brand)) {
        next.delete(brand);
      } else {
        next.add(brand);
      }
      return next;
    });
  };

  if (!brandMetrics || brandMetrics.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-2">BRANDS</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-6">Brand Performance Analysis</h2>
        <div className="text-center py-8">
          <Trophy className="w-10 h-10 mx-auto text-text-tertiary mb-3" />
          <p className="text-foreground font-medium">No brand analysis available</p>
          <p className="text-sm text-text-secondary mt-1">Upload and analyze a video to see brand performance metrics</p>
        </div>
      </div>
    );
  }

  // Compute total exposure for share-of-voice
  const totalExposure = brandMetrics.reduce((sum, b) => sum + (b.total_exposure_time || 0), 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-2">BRANDS</p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Brand Performance Analysis</h2>
      </div>

      <div className="space-y-4">
        {brandMetrics.map((brand) => {
          const insights = brand.ai_insights;
          const isExpanded = expandedBrands.has(brand.brand);

          // Error / no AI state
          if (!insights || insights.error) {
            return (
              <div key={brand.brand} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center mb-2 gap-2">
                  <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                  <p className="text-lg font-bold text-foreground">{brand.brand}</p>
                </div>
                <p className="text-sm text-error">
                  AI analysis is required for comprehensive placement insights.
                </p>
                <p className="text-xs text-text-tertiary mt-1">
                  {insights?.error || "Unable to generate analysis"}
                </p>
              </div>
            );
          }

          const placementScore = insights.placement_effectiveness_score || 0;
          const shareOfVoice = totalExposure > 0
            ? Math.round((brand.total_exposure_time / totalExposure) * 1000) / 10
            : 0;

          return (
            <div key={brand.brand} className="rounded-2xl border border-border bg-card p-5 space-y-4">
              {/* Brand header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-foreground">{brand.brand}</p>
                  <p className="text-sm text-text-secondary">{brand.total_appearances} placements analyzed</p>
                </div>
                <div className="text-right text-sm">
                  <span className={`font-semibold ${
                    placementScore >= 70 ? 'text-mb-green-dark' :
                    placementScore >= 40 ? 'text-mb-orange-dark' :
                    'text-error'
                  }`}>
                    {Math.round(placementScore)}%
                  </span>
                  <p className="text-xs text-text-tertiary">placement score</p>
                </div>
              </div>

              {/* KPI row */}
              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1 min-w-[100px]">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Impressions</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatNumber(insights.roi_projection?.estimated_impressions || brand.estimated_social_mentions)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1 min-w-[100px]">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">On-Screen</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatTime(brand.total_exposure_time || 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1 min-w-[100px]">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Share of Voice</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                    {shareOfVoice}%
                  </p>
                </div>
              </div>

              {/* Share of voice progress bar */}
              <div>
                <div className="flex justify-between text-xs text-text-tertiary mb-1">
                  <span>Share of Voice</span>
                  <span>{shareOfVoice}%</span>
                </div>
                <div className="bg-border-light h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-mb-green rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(shareOfVoice, 100)}%` }}
                  />
                </div>
              </div>

              {/* Sponsorship breakdown (embedded — no extra card wrapper) */}
              {brand.sponsorship_breakdown && (
                <SponsorshipBreakdownChart
                  breakdown={brand.sponsorship_breakdown}
                  appearances={brand.appearances}
                  className=""
                  showDetailedMetrics={true}
                  embedded={true}
                />
              )}

              {/* Ghost toggle for details */}
              <div>
                <button
                  onClick={() => toggleExpand(brand.brand)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>
              </div>

              {/* Collapsible details */}
              {isExpanded && (
                <div className="space-y-4 pt-2 border-t border-border-light">
                  {/* ROI metrics grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                      <div className="flex items-center gap-1 mb-1">
                        <DollarSign className="w-4 h-4 text-mb-green-dark" />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Cost Efficiency</p>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {insights?.roi_assessment?.cost_efficiency?.toFixed(1) || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                      <div className="flex items-center gap-1 mb-1">
                        <Users className="w-4 h-4 text-mb-orange" />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Audience Reach</p>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {insights?.roi_assessment?.audience_reach?.toFixed(1) || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                      <div className="flex items-center gap-1 mb-1">
                        <Target className="w-4 h-4 text-mb-pink" />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Quality Score</p>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {insights?.roi_assessment?.exposure_quality?.toFixed(1) || 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className="w-4 h-4 text-foreground" />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Screen Time</p>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {formatTime(brand.total_exposure_time || 0)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                      <div className="flex items-center gap-1 mb-1">
                        <TrendingUp className="w-4 h-4 text-mb-green-dark" />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">ROI Rating</p>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {insights?.roi_projection?.overall_roi_rating?.toFixed(1) || brand.contextual_value_score.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
                      <div className="flex items-center gap-1 mb-1">
                        <MessageSquare className="w-4 h-4 text-mb-peach" />
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">Est. Impressions</p>
                      </div>
                      <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                        {formatNumber(insights?.roi_projection?.estimated_impressions || brand.estimated_social_mentions)}
                      </p>
                    </div>
                  </div>

                  {/* Key insights */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Placement Analysis
                      </p>
                      <div className="space-y-2 text-xs">
                        {insights.placement_analysis?.optimal_placements && (
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-3 h-3 text-mb-green-dark mt-0.5 flex-shrink-0" />
                            <p className="text-text-secondary">{insights.placement_analysis.optimal_placements}</p>
                          </div>
                        )}
                        {insights.placement_analysis?.missed_opportunities?.slice(0, 2).map((opp, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <TrendingDown className="w-3 h-3 text-mb-orange-dark mt-0.5 flex-shrink-0" />
                            <p className="text-text-secondary">Missed: {opp}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Recommended Actions
                      </p>
                      <div className="space-y-2 text-xs">
                        {insights.recommendations?.immediate_actions?.slice(0, 3).map((action, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-mb-green rounded-full mt-1 flex-shrink-0" />
                            <p className="text-text-secondary">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Executive summary */}
                  {insights?.executive_summary && (
                    <div className="rounded-xl border border-border bg-card p-4">
                      <p className="text-sm italic text-text-secondary">
                        "{insights.executive_summary}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Campaign Assessment */}
      {brandMetrics.length > 0 && brandMetrics[0].ai_insights && !brandMetrics[0].ai_insights.error && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark">Overall Campaign Assessment</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mb-2">Optimal Placement Moments</p>
              <ul className="space-y-1">
                {brandMetrics[0].ai_insights.recommendations?.optimal_moments?.slice(0, 3).map((moment, idx) => (
                  <li key={idx} className="text-xs flex items-center gap-1.5 text-text-secondary">
                    <CheckCircle className="w-3 h-3 text-mb-green-dark flex-shrink-0" />
                    {moment}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mb-2">Future Strategy</p>
              <ul className="space-y-1">
                {brandMetrics[0].ai_insights.recommendations?.future_strategy?.slice(0, 3).map((strategy, idx) => (
                  <li key={idx} className="text-xs flex items-center gap-1.5 text-text-secondary">
                    <TrendingUp className="w-3 h-3 text-mb-orange flex-shrink-0" />
                    {strategy}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mb-2">Placements to Avoid</p>
              <ul className="space-y-1">
                {brandMetrics[0].ai_insights.recommendations?.avoid_these?.slice(0, 3).map((avoid, idx) => (
                  <li key={idx} className="text-xs flex items-center gap-1.5 text-text-secondary">
                    <AlertCircle className="w-3 h-3 text-error flex-shrink-0" />
                    {avoid}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandMetricsCard;

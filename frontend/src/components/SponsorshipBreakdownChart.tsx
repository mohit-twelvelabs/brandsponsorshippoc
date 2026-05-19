import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { SponsorshipBreakdown, BrandAppearance } from '../types';
import { formatTime } from '../utils/formatters';

interface SponsorshipBreakdownChartProps {
  breakdown: SponsorshipBreakdown;
  appearances?: BrandAppearance[];
  className?: string;
  showDetailedMetrics?: boolean;
  /** When true, skip the outer Card wrapper (used when embedded inside BrandMetricsCard) */
  embedded?: boolean;
}

const SponsorshipBreakdownChart: React.FC<SponsorshipBreakdownChartProps> = ({
  breakdown,
  appearances = [],
  className = '',
  showDetailedMetrics = false,
  embedded = false,
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

  const content = (
    <div className={`space-y-4 ${className}`}>
      {/* Header — only shown when not embedded */}
      {!embedded && (
        <div className="mb-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">BREAKDOWN</p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Sponsor Mix</h2>
          <p className="text-base text-text-secondary">% of total impressions</p>
        </div>
      )}

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ad Placements */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">AD PLACEMENTS</p>
              <p className="text-xs text-text-secondary">Commercial &amp; Digital</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-mb-green bg-mb-green-light/40 text-brand-charcoal text-sm font-semibold">
              {breakdown.ad_placements.percentage_of_total}%
            </span>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">
              {breakdown.ad_placements.count}
            </p>
            <p className="text-sm text-text-secondary">placements</p>
          </div>
          <p className="text-base font-semibold text-foreground tabular-nums">{formatTime(breakdown.ad_placements.exposure_time)}</p>
        </div>

        {/* In-Game Placements */}
        <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-orange-dark mb-1">IN-GAME PLACEMENTS</p>
              <p className="text-xs text-text-secondary">Organic &amp; Integrated</p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium">
              {breakdown.in_game_placements.percentage_of_total}%
            </span>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">
              {breakdown.in_game_placements.count}
            </p>
            <p className="text-sm text-text-secondary">placements</p>
          </div>
          <p className="text-base font-semibold text-foreground tabular-nums">{formatTime(breakdown.in_game_placements.exposure_time)}</p>
        </div>
      </div>

      {/* Distribution bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-sm font-medium text-foreground">Distribution by Exposure Time</p>
          <p className="text-sm text-text-secondary tabular-nums">{formatTime(totalTime)} total</p>
        </div>

        <div className="relative h-2 bg-border-light rounded-full overflow-hidden">
          {/* Ad placement segment (green, from left) */}
          {breakdown.ad_placements.percentage_of_total > 0 && (
            <div
              className="absolute left-0 top-0 h-full bg-mb-green transition-all duration-500"
              style={{ width: `${breakdown.ad_placements.percentage_of_total}%` }}
            />
          )}
          {/* In-game placement segment (orange, from right) */}
          {breakdown.in_game_placements.percentage_of_total > 0 && (
            <div
              className="absolute right-0 top-0 h-full bg-mb-orange transition-all duration-500"
              style={{ width: `${breakdown.in_game_placements.percentage_of_total}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-mb-green"></span>
            <span className="text-mb-green-dark font-semibold">Ads ({breakdown.ad_placements.percentage_of_total}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-mb-orange"></span>
            <span className="text-mb-orange-dark font-semibold">In-Game ({breakdown.in_game_placements.percentage_of_total}%)</span>
          </div>
        </div>
      </div>

      {/* Detailed performance metrics */}
      {showDetailedMetrics && detailedMetrics && (
        <div className="rounded-xl border border-border-light bg-card p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Performance Comparison
          </p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded-lg border-l-4 border-mb-green bg-card">
                <span className="text-mb-green-dark font-semibold">Avg Ad Duration:</span>
                <span className="font-bold text-foreground tabular-nums">{formatTime(detailedMetrics.avgAdDuration)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg border-l-4 border-mb-green bg-card">
                <span className="text-mb-green-dark font-semibold">Ad Frequency:</span>
                <span className="font-bold text-foreground tabular-nums flex items-center gap-1">
                  {breakdown.ad_placements.count > breakdown.in_game_placements.count ? (
                    <TrendingUp className="w-3 h-3 text-mb-green-dark" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-error" />
                  )}
                  {((breakdown.ad_placements.count / totalCount) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded-lg border-l-4 border-mb-orange bg-card">
                <span className="text-mb-orange-dark font-semibold">Avg In-Game:</span>
                <span className="font-bold text-foreground tabular-nums">{formatTime(detailedMetrics.avgInGameDuration)}</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg border-l-4 border-mb-orange bg-card">
                <span className="text-mb-orange-dark font-semibold">In-Game Freq:</span>
                <span className="font-bold text-foreground tabular-nums flex items-center gap-1">
                  {breakdown.in_game_placements.count > breakdown.ad_placements.count ? (
                    <TrendingUp className="w-3 h-3 text-mb-green-dark" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-error" />
                  )}
                  {((breakdown.in_game_placements.count / totalCount) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key insight (simple mode only) */}
      {!showDetailedMetrics && (
        <div className="flex items-center justify-center p-3 rounded-xl border border-border-light text-sm text-text-secondary">
          {breakdown.ad_placements.percentage_of_total > breakdown.in_game_placements.percentage_of_total ? (
            <span className="font-semibold text-mb-green-dark">Ad placements dominate exposure time</span>
          ) : breakdown.in_game_placements.percentage_of_total > breakdown.ad_placements.percentage_of_total ? (
            <span className="font-semibold text-mb-orange-dark">In-game placements dominate exposure time</span>
          ) : (
            <span className="font-semibold text-foreground">Balanced exposure time distribution</span>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md">
      {content}
    </div>
  );
};

export default SponsorshipBreakdownChart;

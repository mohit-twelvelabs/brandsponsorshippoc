import React from 'react';
import { LoadingScreenProps, ProgressStage } from '../types';
import { CheckCircle2, CircleDot, Circle, Search, Zap, Loader2, BarChart2, Trophy, Brain, Sparkles } from 'lucide-react';

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress,
  status,
  isVisible,
  stage,
  details,
  brandsFound,
}) => {
  if (!isVisible) return null;

  const stages: {
    id: ProgressStage;
    label: string;
    icon: React.ReactNode;
    description: string;
  }[] = [
    {
      id: 'initialization',
      label: 'Connecting',
      icon: <Zap className="w-4 h-4" />,
      description: 'Establishing connection to TwelveLabs AI',
    },
    {
      id: 'brand_detection',
      label: 'Brand Detection',
      icon: <Search className="w-4 h-4" />,
      description: 'Identifying commercial brands and sponsors',
    },
    {
      id: 'brand_analysis',
      label: 'Deep Analysis',
      icon: <Brain className="w-4 h-4" />,
      description: 'Analyzing logos, mentions, and placements',
    },
    {
      id: 'processing',
      label: 'Processing',
      icon: <Sparkles className="w-4 h-4" />,
      description: 'Extracting brand appearances and contexts',
    },
    {
      id: 'metrics',
      label: 'Metrics',
      icon: <BarChart2 className="w-4 h-4" />,
      description: 'Calculating exposure scores and insights',
    },
    {
      id: 'finalizing',
      label: 'Finalizing',
      icon: <Trophy className="w-4 h-4" />,
      description: 'Generating executive summary',
    },
  ];

  const getStageStatus = (stageId: ProgressStage) => {
    if (!stage) return 'pending';
    const currentIndex = stages.findIndex(s => s.id === stage);
    const stageIndex = stages.findIndex(s => s.id === stageId);

    if (stageIndex < currentIndex) return 'completed';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur flex items-center justify-center z-50">
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md max-w-md w-full mx-4">
        {/* Animated badge */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-mb-green via-mb-orange to-mb-pink flex items-center justify-center">
            <Loader2 className="w-9 h-9 text-brand-white animate-spin" />
          </div>
        </div>

        {/* Status label */}
        <h2 className="text-2xl font-bold tracking-tight text-foreground text-center mb-2">
          {status || 'Initializing analysis…'}
        </h2>

        {details &&
          !details.toLowerCase().includes('processing') &&
          !details.toLowerCase().includes('analyzing') && (
            <p className="text-sm text-text-secondary text-center mb-4">
              {details}
            </p>
          )}

        {/* Progress bar */}
        <div className="mt-4 mb-2">
          <div className="h-2 rounded-full bg-border-light overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-mb-green to-mb-orange transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <p className="text-text-secondary text-sm tabular-nums font-mono text-center mb-6">
          {progress}%
        </p>

        {/* Stage list */}
        {stage && (
          <div className="space-y-2 mb-4">
            {stages.map(stageItem => {
              const stageStatus = getStageStatus(stageItem.id);
              const isActive = stageStatus === 'active';
              const isCompleted = stageStatus === 'completed';

              return (
                <div key={stageItem.id} className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-mb-green-dark" />
                    ) : isActive ? (
                      <CircleDot className="w-4 h-4 text-mb-orange animate-pulse" />
                    ) : (
                      <Circle className="w-4 h-4 text-text-tertiary" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      isCompleted
                        ? 'text-mb-green-dark font-semibold'
                        : isActive
                        ? 'text-foreground font-semibold'
                        : 'text-text-tertiary'
                    }`}
                  >
                    {stageItem.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Brands found celebration pill */}
        {brandsFound && brandsFound.length > 0 && (
          <div className="flex justify-center mt-4">
            <span className="bg-mb-green-light text-mb-green-dark px-3 py-1 rounded-full text-xs font-bold">
              {brandsFound.length} {brandsFound.length === 1 ? 'brand' : 'brands'} found
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;

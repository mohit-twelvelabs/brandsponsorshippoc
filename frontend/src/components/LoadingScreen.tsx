import React from 'react';
import { LoadingScreenProps, ProgressStage } from '../types';
import { Card } from './ui/Card';
import { Text } from './ui/Text';
import { Progress } from './ui/Progress';
import { Loader } from './ui/Loader';
import { CheckCircle2, CircleDot, Circle, Sparkles, Search, Brain, BarChart, Trophy, Zap } from 'lucide-react';

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  progress, 
  status, 
  isVisible, 
  stage,
  details,
  brandsFound 
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
      icon: <Zap className="w-5 h-5" />,
      description: 'Establishing connection to TwelveLabs AI'
    },
    {
      id: 'brand_detection',
      label: 'Brand Detection',
      icon: <Search className="w-5 h-5" />,
      description: 'Identifying commercial brands and sponsors'
    },
    {
      id: 'brand_analysis',
      label: 'Deep Analysis',
      icon: <Brain className="w-5 h-5" />,
      description: 'Analyzing logos, mentions, and placements'
    },
    {
      id: 'processing',
      label: 'Processing',
      icon: <Sparkles className="w-5 h-5" />,
      description: 'Extracting brand appearances and contexts'
    },
    {
      id: 'metrics',
      label: 'Metrics',
      icon: <BarChart className="w-5 h-5" />,
      description: 'Calculating exposure scores and insights'
    },
    {
      id: 'finalizing',
      label: 'Finalizing',
      icon: <Trophy className="w-5 h-5" />,
      description: 'Generating executive summary'
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="p-8 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          {/* Animated loader dots */}
          <div className="mb-4 flex justify-center">
            <Loader size="xl" count={4} duration={0.6} delayStep={150} className="text-primary" />
          </div>
          
          {/* Single consolidated message */}
          <Text as="h3" className="mb-2 text-xl font-semibold">
            {status || 'Initializing analysis...'}
          </Text>
          
          {/* Show details only if significantly different from main status */}
          {details && !details.toLowerCase().includes('processing') && !details.toLowerCase().includes('analyzing') && (
            <Text as="p" className="text-sm text-muted-foreground">
              {details}
            </Text>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={progress} className="mb-2 h-3" />
          <Text as="p" className="text-sm text-muted-foreground text-center">
            {progress}% complete
          </Text>
        </div>

        {/* Stage indicators */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {stages.map((stageItem) => {
            const stageStatus = getStageStatus(stageItem.id);
            const isActive = stageStatus === 'active';
            const isCompleted = stageStatus === 'completed';
            
            return (
              <div 
                key={stageItem.id} 
                className={`p-3 rounded-lg border transition-all ${
                  isActive 
                    ? 'border-primary bg-primary/10' 
                    : isCompleted
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className={`mr-2 ${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-500' : 'text-muted-foreground'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isActive ? (
                      <CircleDot className="w-5 h-5 animate-pulse" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </div>
                  <div className={`${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-500' : 'text-muted-foreground'
                  }`}>
                    {stageItem.icon}
                  </div>
                  <span className={`ml-2 font-medium text-sm ${
                    isActive ? 'text-foreground' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {stageItem.label}
                  </span>
                </div>
                <Text as="p" className="text-xs text-muted-foreground">
                  {stageItem.description}
                </Text>
              </div>
            );
          })}
        </div>

        {/* Parallel processing indicator */}
        {(status?.includes('parallel') || (status?.includes('Completed') && status?.includes('of'))) && (
          <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-orange-50 dark:from-green-950/30 dark:to-orange-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center mb-2">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
              <Text as="p" className="text-sm font-medium text-blue-800 dark:text-blue-200">
                ⚡ Parallel Processing Active
              </Text>
            </div>
            <Text as="p" className="text-xs text-blue-600 dark:text-blue-300">
              Processing up to 4 videos simultaneously for faster analysis
            </Text>
          </div>
        )}

        {/* Brands found section */}
        {brandsFound && brandsFound.length > 0 && (
          <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <Text as="p" className="text-sm font-medium mb-2">
              Brands Detected: {brandsFound.length}
            </Text>
            <div className="flex flex-wrap gap-2">
              {brandsFound.map((brand, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 bg-primary/10 rounded-full text-xs font-medium text-primary"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="mt-6 text-center">
          <Text as="p" className="text-xs text-muted-foreground">
            Powered by TwelveLabs Multimodal AI
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoadingScreen;

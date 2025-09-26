import React, { useState } from 'react';
import { BarChart3, ArrowLeft } from 'lucide-react';
import BrandSearch from './components/BrandSearch';
import VideoSelector from './components/VideoSelector';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import LoadingScreen from './components/LoadingScreen';
import Alert from './components/Alert';
import { Button } from './components/ui/Button';
import { useAnalysis } from './hooks/useAnalysis';
import { Text } from './components/ui/Text';
import { Switch } from './components/ui/Switch';
import { AppStep } from './types';

function App() {
  const { 
    analyzeVideo, 
    analyzeMultipleVideos,
    data: analysisData, 
    loading: analysisLoading, 
    progress, 
    status,
    stage,
    details,
    brandsFound,
    isMultiVideo
  } = useAnalysis();
  
  // App flow state
  const [currentStep, setCurrentStep] = useState<AppStep>('brand-search');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [multiVideoMode, setMultiVideoMode] = useState(false);
  
  const [alertState, setAlertState] = useState<{
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    isVisible: boolean;
  }>({
    type: 'info',
    message: '',
    isVisible: false
  });

  const showAlert = (type: 'success' | 'error' | 'info' | 'warning', message: string) => {
    setAlertState({ type, message, isVisible: true });
  };

  const hideAlert = () => {
    setAlertState(prev => ({ ...prev, isVisible: false }));
  };

  // Handler for brand selection
  const handleBrandsSelect = (brands: string[]) => {
    setSelectedBrands(brands);
  };

  // Handler for proceeding from brand search to video selection
  const handleBrandSearchNext = () => {
    if (selectedBrands.length > 0) {
      setCurrentStep('video-selection');
      showAlert('success', `${selectedBrands.length} brand${selectedBrands.length > 1 ? 's' : ''} selected. Now choose a video to analyze.`);
    }
  };

  // Handler for single video selection
  const handleVideoSelect = (videoId: string) => {
    if (multiVideoMode) return; // Ignore single selection in multi-video mode
    
    setSelectedVideoIds([videoId]); // Store selected video ID
    showAlert('success', 'Video selected! Click "Analyze Video" to start analysis.');
  };

  // Handler for starting single video analysis
  const handleStartSingleAnalysis = async () => {
    if (selectedVideoIds.length === 0) {
      showAlert('error', 'Please select a video for analysis');
      return;
    }

    const videoId = selectedVideoIds[0];
    setCurrentStep('analysis');
    showAlert('success', 'Starting analysis...');
    
    try {
      // Pass selected brands to the analysis
      await analyzeVideo(videoId, selectedBrands);
      setCurrentStep('results');
      showAlert('success', 'Analysis completed successfully!');
    } catch (error: any) {
      showAlert('error', error.message || 'Analysis failed');
      // Stay on analysis step to allow retry
    }
  };

  // Handler for multi-video selection
  const handleVideosSelect = (videoIds: string[]) => {
    setSelectedVideoIds(videoIds);
  };

  // Handler for starting multi-video analysis
  const handleStartMultiVideoAnalysis = async () => {
    if (selectedVideoIds.length === 0) {
      showAlert('error', 'Please select at least one video for analysis');
      return;
    }

    setCurrentStep('analysis');
    showAlert('success', `${selectedVideoIds.length} videos selected! Starting multi-video analysis...`);
    
    try {
      // Pass selected brands to the multi-video analysis
      await analyzeMultipleVideos(selectedVideoIds, selectedBrands);
      setCurrentStep('results');
      showAlert('success', 'Multi-video analysis completed successfully!');
    } catch (error: any) {
      showAlert('error', error.message || 'Multi-video analysis failed');
      // Stay on analysis step to allow retry
    }
  };

  const handleVideoError = (error: string) => {
    showAlert('error', error);
  };

  // Handler for going back to previous step
  const handleGoBack = () => {
    if (currentStep === 'video-selection') {
      setCurrentStep('brand-search');
    } else if (currentStep === 'analysis' || currentStep === 'results') {
      setCurrentStep('video-selection');
      setSelectedVideoIds([]);
    }
  };

  // Handler for starting a new analysis
  const handleStartNew = () => {
    setCurrentStep('brand-search');
    setSelectedBrands([]);
    setSelectedVideoIds([]);
    setMultiVideoMode(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-500 via-orange-500 to-pink-500 border-b-2 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <BarChart3 className="w-8 h-8 text-white mr-3" />
              <div>
                <Text as="h1" className="text-xl text-white font-bold">Brand ROI Analytics</Text>
                <Text as="p" className="text-sm text-white/80">Powered by TwelveLabs AI</Text>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Back button for non-initial steps */}
              {currentStep !== 'brand-search' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGoBack}
                  className="flex items-center bg-orange-500 text-white hover:bg-orange-600 border-orange-500 hover:border-orange-600"
                  disabled={analysisLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              
              {/* Start New button for results step */}
              {currentStep === 'results' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleStartNew}
                  className="flex items-center"
                >
                  Start New Analysis
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {['brand-search', 'video-selection', 'analysis', 'results'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step 
                    ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white' 
                    : index < ['brand-search', 'video-selection', 'analysis', 'results'].indexOf(currentStep)
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`w-8 h-0.5 mx-2 ${
                    index < ['brand-search', 'video-selection', 'analysis', 'results'].indexOf(currentStep)
                      ? 'bg-green-500'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 'brand-search' && (
            <div className="animate-fade-in">
              <BrandSearch 
                onBrandsSelect={handleBrandsSelect}
                onNext={handleBrandSearchNext}
                isLoading={analysisLoading}
              />
            </div>
          )}

          {currentStep === 'video-selection' && (
            <div className="animate-fade-in">
              {/* Multi-video mode toggle */}
              <div className="mb-6 flex justify-center">
                <div className="flex items-center space-x-4 p-4 bg-accent/10 rounded-lg border">
                  <Text as="p" className="text-sm font-medium">Single Video</Text>
                  <Switch
                    id="analysis-mode"
                    checked={multiVideoMode}
                    onCheckedChange={(checked: boolean) => {
                      setMultiVideoMode(checked);
                      if (!checked) {
                        setSelectedVideoIds([]);
                      }
                    }}
                    disabled={analysisLoading}
                  />
                  <Text as="p" className="text-sm font-medium">Multiple Videos</Text>
                </div>
              </div>

              <VideoSelector 
                onVideoSelect={multiVideoMode ? undefined : handleVideoSelect}
                onVideosSelect={multiVideoMode ? handleVideosSelect : undefined}
                onStartSingleAnalysis={!multiVideoMode ? handleStartSingleAnalysis : undefined}
                onError={handleVideoError}
                isAnalyzing={analysisLoading}
                selectedBrands={selectedBrands}
                multiSelect={multiVideoMode}
                selectedVideoIds={selectedVideoIds}
              />

              {/* Start analysis button for multi-video mode */}
              {multiVideoMode && selectedVideoIds.length > 0 && (
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={handleStartMultiVideoAnalysis}
                    disabled={analysisLoading}
                    size="lg"
                    className="px-8"
                  >
                    {analysisLoading 
                      ? 'Starting Analysis...' 
                      : `Analyze ${selectedVideoIds.length} Video${selectedVideoIds.length > 1 ? 's' : ''}`
                    }
                  </Button>
                </div>
              )}
            </div>
          )}

          {(currentStep === 'analysis' || currentStep === 'results') && (
            <div className="animate-fade-in">
              <AnalyticsDashboard 
                analysisData={analysisData}
                isLoading={analysisLoading}
                isMultiVideo={isMultiVideo}
              />
            </div>
          )}
        </div>

      </main>



      {/* Loading Screen Overlay */}
      <LoadingScreen 
        progress={progress} 
        status={status} 
        isVisible={analysisLoading}
        stage={stage}
        details={details}
        brandsFound={brandsFound}
      />

      {/* Alert Notifications */}
      <Alert 
        type={alertState.type}
        message={alertState.message}
        isVisible={alertState.isVisible}
        onClose={hideAlert}
      />
    </div>
  );
}

export default App;

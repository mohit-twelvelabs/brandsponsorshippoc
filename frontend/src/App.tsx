import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plug } from 'lucide-react';
import TwelveLabsWordmark from './components/TwelveLabsWordmark';
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
import { useAccounts } from './lib/AccountContext';
import { setRecentBrands } from './lib/accountStorage';
import ConnectAccount from './components/ConnectAccount';

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

  const { activeAccount } = useAccounts();

  // App flow state
  const [currentStep, setCurrentStep] = useState<AppStep>(() =>
    activeAccount ? 'brand-search' : 'connect'
  );
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [multiVideoMode, setMultiVideoMode] = useState(false);

  // Auth-recovery: listen for 401-driven account clears (dispatched by the
  // axios response interceptor) and route the viewer to Connect. We listen
  // for the explicit event rather than watching activeAccount, because the
  // "Use default demo account" flow intentionally sets activeAccount to null
  // and stays on brand-search — watching the state would trap that flow.
  useEffect(() => {
    const handler = () => setCurrentStep('connect');
    window.addEventListener('tl-auth-required', handler);
    return () => window.removeEventListener('tl-auth-required', handler);
  }, []);
  
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
    if (activeAccount && selectedBrands.length > 0) {
      setRecentBrands(activeAccount.id, selectedBrands);
    }
    showAlert('success', 'Starting analysis...');

    try {
      // Pass selected brands to the analysis
      await analyzeVideo(videoId, selectedBrands);
      setCurrentStep('results');
      showAlert('success', 'Analysis completed successfully!');
    } catch (error: any) {
      showAlert('error', error.message || 'Analysis failed');
      // Route back to video selection so the user can retry, swap videos,
      // or switch index via the header chip instead of staring at an empty dashboard.
      setCurrentStep('video-selection');
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
    if (activeAccount && selectedBrands.length > 0) {
      setRecentBrands(activeAccount.id, selectedBrands);
    }
    showAlert('success', `${selectedVideoIds.length} videos selected! Starting multi-video analysis...`);

    try {
      // Pass selected brands to the multi-video analysis
      await analyzeMultipleVideos(selectedVideoIds, selectedBrands);
      setCurrentStep('results');
      showAlert('success', 'Multi-video analysis completed successfully!');
    } catch (error: any) {
      showAlert('error', error.message || 'Multi-video analysis failed');
      // Route back to video selection so the user can retry, swap videos,
      // or switch index via the header chip instead of staring at an empty dashboard.
      setCurrentStep('video-selection');
    }
  };

  const handleVideoError = (error: string) => {
    showAlert('error', error);
  };

  // Handler for going back to previous step
  const handleGoBack = () => {
    if (currentStep === 'brand-search') {
      setCurrentStep('connect');
    } else if (currentStep === 'video-selection') {
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
      {/* Header — TwelveLabs masterbrand gradient (green → orange → pink) */}
      <header className="border-b border-brand-charcoal/10 sticky top-0 z-40 shadow-sm"
              style={{ background: 'linear-gradient(90deg, #60E21B 0%, #FABA17 50%, #FFB0CD 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <TwelveLabsWordmark className="h-5 w-auto text-brand-charcoal" aria-label="TwelveLabs" />
              <div className="hidden sm:block w-px h-8 bg-brand-charcoal/20" />
              <div>
                <Text as="h1" className="text-xl text-brand-charcoal font-bold leading-tight">Brand ROI Analytics</Text>
                <Text as="p" className="text-xs text-brand-charcoal/70 leading-tight">Sponsorship intelligence powered by Marengo</Text>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {activeAccount && currentStep !== 'connect' && (
                <button
                  type="button"
                  onClick={() => setCurrentStep('connect')}
                  className="flex items-center text-xs bg-brand-charcoal/10 hover:bg-brand-charcoal/20 text-brand-charcoal px-3 py-1.5 rounded-full font-medium"
                  title="Switch account or index"
                >
                  <Plug className="w-3 h-3 mr-1" />
                  <span className="font-medium mr-1">{activeAccount.nickname}</span>
                  <span className="opacity-80">· {activeAccount.indexName}</span>
                  <span className="ml-2 underline">switch</span>
                </button>
              )}

              {currentStep !== 'brand-search' && currentStep !== 'connect' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGoBack}
                  className="flex items-center bg-brand-charcoal text-brand-white hover:bg-brand-charcoal/85 border-brand-charcoal"
                  disabled={analysisLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}

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
            {['connect', 'brand-search', 'video-selection', 'analysis', 'results'].map((step, index) => {
              const currentIdx = ['connect', 'brand-search', 'video-selection', 'analysis', 'results'].indexOf(currentStep);
              const isActive = currentStep === step;
              const isComplete = index < currentIdx;
              return (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive
                      ? 'bg-mb-green text-brand-charcoal ring-2 ring-mb-green/30'
                      : isComplete
                        ? 'bg-mb-green-dark text-brand-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  {index < 4 && (
                    <div className={`w-8 h-0.5 mx-2 ${isComplete ? 'bg-mb-green-dark' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 'connect' && (
            <div className="animate-fade-in">
              <ConnectAccount onConnected={() => setCurrentStep('brand-search')} />
            </div>
          )}

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

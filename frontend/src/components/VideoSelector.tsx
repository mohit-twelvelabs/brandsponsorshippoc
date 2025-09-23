import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Clock, Calendar, AlertCircle } from 'lucide-react';
import { VideoSelectorProps, Video } from '../types';
import ApiService from '../services/api';
import { formatTime } from '../utils/formatters';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';
import { Loader } from './ui/Loader';
import { Text } from './ui/Text';
import VideoPreview from './VideoPreview';

const VideoSelector: React.FC<VideoSelectorProps> = ({ 
  onVideoSelect, 
  onVideosSelect, 
  onStartSingleAnalysis,
  onError, 
  isAnalyzing = false, 
  selectedBrands,
  multiSelect = false,
  selectedVideoIds = []
}) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<string[]>(selectedVideoIds);
  const [error, setError] = useState<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchVideos = useCallback(async () => {
    // Prevent fetching if analysis is in progress
    if (isAnalyzing) {
      console.log('Skipping video fetch - analysis in progress');
      return;
    }

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce the fetch
    fetchTimeoutRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await ApiService.getVideos();
        
        if (ApiService.isApiError(response)) {
          throw new Error(response.error);
        }
        
        setVideos(response.videos);
        
        if (response.videos.length === 0 && response.message) {
          setError(response.message);
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch videos';
        setError(errorMessage);
        onError(errorMessage);
      } finally {
        setLoading(false);
      }
    }, 500); // 500ms debounce
  }, [onError, isAnalyzing]);

  useEffect(() => {
    // Only fetch videos on mount if not analyzing
    if (!isAnalyzing) {
      fetchVideos();
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []); // Remove fetchVideos from dependencies to prevent re-fetching

  // Sync selectedVideos with selectedVideoIds prop
  useEffect(() => {
    setSelectedVideos(selectedVideoIds);
  }, [selectedVideoIds]);

  const handleVideoSelect = (video: Video) => {
    if (multiSelect) {
      const newSelectedVideos = selectedVideos.includes(video.id)
        ? selectedVideos.filter(id => id !== video.id)
        : [...selectedVideos, video.id];
      
      setSelectedVideos(newSelectedVideos);
      onVideosSelect?.(newSelectedVideos);
    } else {
      setSelectedVideo(video.id);
      onVideoSelect?.(video.id);
    }
  };

  const handleSelectAll = () => {
    if (selectedVideos.length === videos.length) {
      setSelectedVideos([]);
      onVideosSelect?.([]);
    } else {
      // Preserve the order of videos as they appear in the grid
      const allVideoIds = videos.map(v => v.id);
      setSelectedVideos(allVideoIds);
      onVideosSelect?.(allVideoIds);
    }
  };

  // Function to get the selection order number for a video
  const getSelectionOrder = (videoId: string) => {
    const index = selectedVideos.indexOf(videoId);
    return index !== -1 ? index + 1 : null;
  };

  // Function to sort videos for display - selected videos first in selection order, then unselected
  const getSortedVideosForDisplay = () => {
    if (!multiSelect) {
      return videos;
    }

    const selectedInOrder = selectedVideos
      .map(id => videos.find(v => v.id === id))
      .filter(Boolean) as Video[];
    
    const unselected = videos.filter(v => !selectedVideos.includes(v.id));
    
    return [...selectedInOrder, ...unselected];
  };

  if (loading) {
    return (
      <Card className="w-full p-6">
        <Card.Header className="p-0 mb-4">
          <Card.Title className="flex items-center">
            <Play className="w-6 h-6 mr-2 text-primary" />
            Select Video for Analysis
          </Card.Title>
        </Card.Header>
        
        <div className="flex items-center justify-center py-12">
          <Loader size="lg" count={3} className="mr-3 text-primary" />
          <span className="text-muted-foreground">Loading videos from TwelveLabs index...</span>
        </div>
      </Card>
    );
  }

  if (error) {
  return (
      <Card className="w-full p-6">
        <Card.Header className="p-0 mb-4">
          <Card.Title className="flex items-center">
            <Play className="w-6 h-6 mr-2 text-primary" />
            Select Video for Analysis
          </Card.Title>
        </Card.Header>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <Text as="h3" className="mb-2">Unable to Load Videos</Text>
            <Text as="p" className="text-muted-foreground mb-4">{error}</Text>
            <Button onClick={fetchVideos} variant="default" disabled={isAnalyzing}>
              {isAnalyzing ? 'Analysis in progress...' : 'Retry'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (videos.length === 0) {
    return (
      <Card className="w-full p-6">
        <Card.Header className="p-0 mb-4">
          <Card.Title className="flex items-center">
            <Play className="w-6 h-6 mr-2 text-primary" />
            Select Video for Analysis
          </Card.Title>
        </Card.Header>
        
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-4xl mb-4">📹</div>
            <Text as="h3" className="mb-2">No Videos Found</Text>
            <Text as="p" className="text-muted-foreground mb-4">
              No videos were found in your TwelveLabs index. Please upload some videos to the index first.
            </Text>
            <Button onClick={fetchVideos} variant="default" disabled={isAnalyzing}>
              {isAnalyzing ? 'Analysis in progress...' : 'Refresh'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <Card.Title className="p-0 flex items-center">
          <Play className="w-6 h-6 mr-2 text-primary" />
          {multiSelect ? 'Select Videos for Analysis' : 'Select Video for Analysis'}
        </Card.Title>
        
        <div className="flex items-center text-sm">
          {multiSelect && (
            <Button
              onClick={handleSelectAll}
              variant="outline"
              size="sm"
              className="mr-3"
              disabled={isAnalyzing}
            >
              {selectedVideos.length === videos.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
          <Button
            onClick={fetchVideos}
            variant="outline"
            size="sm"
            className="ml-3"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analysis in progress...' : 'Refresh'}
          </Button>
        </div>
      </div>
      
      {/* Show selected brands */}
      {selectedBrands && selectedBrands.length > 0 && (
        <div className="mb-6 p-3 bg-accent/20 rounded-lg border border-accent">
          <Text as="p" className="text-sm font-medium text-foreground mb-2">
            Selected Brands to Analyze:
          </Text>
          <div className="flex flex-wrap gap-2">
            {selectedBrands.map((brand: string) => (
              <Badge key={brand} variant="default" className="text-xs">
                {brand}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {getSortedVideosForDisplay().map((video) => {
              const isSelected = multiSelect 
                ? selectedVideos.includes(video.id)
                : selectedVideo === video.id;
              const selectionOrder = getSelectionOrder(video.id);
              
              return (
          <Card
                key={video.id}
            className={`transition-all duration-200 p-4 relative ${
              isAnalyzing 
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer'
            } ${
              isSelected
                ? 'border-primary bg-accent/10 ring-2 ring-primary/20'
                : !isAnalyzing ? 'hover:border-primary/50' : ''
            }`}
            onClick={() => !isAnalyzing && handleVideoSelect(video)}
          >

            
            {/* Video preview */}
            <div className="relative mb-3">
              <VideoPreview
                video={video}
                onError={(error) => console.warn(`Video preview error for ${video.id}:`, error)}
              />
              
              {/* Duration badge */}
              {video.duration > 0 && (
                <Badge className="absolute bottom-2 right-2" variant="default">
                  {formatTime(video.duration)}
                </Badge>
              )}
                  </div>

            {/* Video info */}
            <div>
              <Text as="h3" className="text-sm mb-2 line-clamp-2">
                {video.filename}
              </Text>
              
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  <span>{video.duration > 0 ? formatTime(video.duration) : 'Unknown duration'}</span>
                </div>
                
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span>
                    {video.created_at !== 'Unknown' 
                      ? new Date(video.created_at).toLocaleDateString()
                      : 'Unknown date'
                    }
                  </span>
                </div>
                
                    <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-1 ${
                    video.status === 'ready' ? 'bg-green-500' : 'bg-yellow-500'
                  }`} />
                  <span className="capitalize">{video.status}</span>
                </div>
                    </div>
                  </div>
                  
            {/* Selected indicator */}
            {isSelected && (
              <div className="mt-3 flex items-center justify-center">
                <Badge variant="default">
                  {multiSelect 
                    ? `Selected (#${selectionOrder})`
                    : 'Selected for Analysis'
                  }
                </Badge>
              </div>
            )}
          </Card>
              );
            })}
      </div>
      
      {((multiSelect && selectedVideos.length > 0) || (!multiSelect && selectedVideo)) && (
        <Alert className="mt-6" variant="default">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-primary rounded-full mr-2 animate-pulse" />
              <span className="font-medium">
                {multiSelect 
                  ? `Ready to analyze ${selectedVideos.length} selected video${selectedVideos.length > 1 ? 's' : ''} in order`
                  : 'Ready to analyze selected video'
                }
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              Click "Start Analysis" to proceed
            </span>
          </div>
        </Alert>
      )}

      {/* Start analysis button for single video mode */}
      {!multiSelect && selectedVideo && onStartSingleAnalysis && (
        <div className="mt-6 flex justify-center">
          <Button
            onClick={onStartSingleAnalysis}
            disabled={isAnalyzing}
            size="lg"
            className="px-8"
          >
            {isAnalyzing ? 'Starting Analysis...' : 'Analyze Video'}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default VideoSelector;

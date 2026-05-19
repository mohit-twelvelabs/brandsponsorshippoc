import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Film, Check, AlertCircle } from 'lucide-react';
import { VideoSelectorProps, Video } from '../types';
import ApiService from '../services/api';
import { formatTime } from '../utils/formatters';

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

  // Loading state
  if (loading) {
    return (
      <div className="w-full space-y-8">
        {/* Header skeleton */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">
            STEP 3 · VIDEOS
          </p>
          <div className="h-12 w-80 bg-gray-100 rounded-xl animate-pulse mb-3" />
          <div className="h-5 w-40 bg-gray-100 rounded-lg animate-pulse" />
        </div>
        {/* Skeleton grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="aspect-video bg-gray-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && videos.length === 0) {
    return (
      <div className="w-full space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">
            STEP 3 · VIDEOS
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.05]">
            {multiSelect ? 'Choose videos to analyze.' : 'Choose a video to analyze.'}
          </h1>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-4">
          <AlertCircle className="w-12 h-12 text-error" />
          <h2 className="text-2xl font-bold tracking-tight text-error">
            Could not load videos
          </h2>
          <p className="text-base text-text-secondary max-w-md">{error}</p>
          <button
            type="button"
            onClick={fetchVideos}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium border border-border disabled:opacity-50"
          >
            {isAnalyzing ? 'Analysis in progress...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (videos.length === 0) {
    return (
      <div className="w-full space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">
            STEP 3 · VIDEOS
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.05]">
            {multiSelect ? 'Choose videos to analyze.' : 'Choose a video to analyze.'}
          </h1>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center justify-center text-center gap-4">
          <Film className="w-12 h-12 text-text-tertiary" />
          <p className="text-base text-text-secondary">No videos in this index.</p>
          <button
            type="button"
            onClick={fetchVideos}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isAnalyzing ? 'Analysis in progress...' : 'Refresh'}
          </button>
        </div>
      </div>
    );
  }

  const sortedVideos = getSortedVideosForDisplay();
  return (
    <div className="w-full space-y-8">
      {/* Section header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">
          STEP 3 · VIDEOS
        </p>
        <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.05] mb-3">
          {multiSelect ? 'Choose videos to analyze.' : 'Choose a video to analyze.'}
        </h1>
        <p className="text-base lg:text-lg text-text-secondary max-w-2xl">
          {videos.length} {videos.length === 1 ? 'video' : 'videos'}
        </p>
      </div>

      {/* Toolbar: Select All + Refresh */}
      <div className="flex items-center gap-2">
        {multiSelect && (
          <button
            type="button"
            onClick={handleSelectAll}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium disabled:opacity-50"
          >
            {selectedVideos.length === videos.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
        <button
          type="button"
          onClick={fetchVideos}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium disabled:opacity-50"
        >
          {isAnalyzing ? 'Analysis in progress...' : 'Refresh'}
        </button>
      </div>

      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedVideos.map((video) => {
          const isSelected = multiSelect
            ? selectedVideos.includes(video.id)
            : selectedVideo === video.id;
          const selectionOrder = getSelectionOrder(video.id);

          // Thumbnail source: prefer direct thumbnail_url, fall back to first HLS thumbnail
          const thumbnailSrc = video.thumbnail_url
            || (video.hls?.thumbnail_urls && video.hls.thumbnail_urls.length > 0
              ? video.hls.thumbnail_urls[0]
              : null);

          return (
            <div
              key={video.id}
              onClick={() => !isAnalyzing && handleVideoSelect(video)}
              className={`rounded-2xl border bg-card overflow-hidden transition hover:shadow-md ${
                isAnalyzing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'border-2 border-mb-green ring-4 ring-mb-green/20'
                  : 'border-border hover:border-mb-green/50'
              }`}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video">
                {thumbnailSrc ? (
                  <img
                    src={thumbnailSrc}
                    alt={video.filename}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <Film className="w-10 h-10 text-gray-400" />
                  </div>
                )}

                {/* Duration badge */}
                {video.duration > 0 && (
                  <span className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-brand-charcoal/85 text-brand-white text-xs font-mono tabular-nums">
                    {formatTime(video.duration)}
                  </span>
                )}

                {/* Multi-select checkbox */}
                {multiSelect && (
                  <div
                    className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 ${
                      isSelected
                        ? 'bg-mb-green border-mb-green'
                        : 'bg-card/80 border-border'
                    } flex items-center justify-center`}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-brand-charcoal" strokeWidth={2.5} />
                    )}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-sm font-semibold text-foreground line-clamp-2 mb-2">
                  {video.filename}
                </p>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  {video.created_at !== 'Unknown' && (
                    <span>{new Date(video.created_at).toLocaleDateString()}</span>
                  )}
                  {video.status && (
                    <span className="flex items-center gap-1">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          video.status === 'ready' ? 'bg-mb-green' : 'bg-mb-orange'
                        }`}
                      />
                      <span className="capitalize">{video.status}</span>
                    </span>
                  )}
                  {multiSelect && isSelected && selectionOrder !== null && (
                    <span className="ml-auto text-mb-green-dark font-semibold">
                      #{selectionOrder}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analyze Video CTA — single-select mode */}
      {!multiSelect && selectedVideo && onStartSingleAnalysis && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onStartSingleAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-mb-green text-brand-charcoal text-base font-semibold hover:bg-mb-green-dark hover:text-brand-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? 'Starting Analysis...' : 'Analyze Video'}
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoSelector;

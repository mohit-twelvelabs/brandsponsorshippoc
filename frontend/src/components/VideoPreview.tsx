import React, { useState, useRef, useEffect } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { Video } from '../types';

interface VideoPreviewProps {
  video: Video;
  className?: string;
  onError?: (error: string) => void;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  video,
  className = '',
  onError
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasHLS = video.hls?.video_url && video.hls.status === 'COMPLETE';

  useEffect(() => {
    if (videoRef.current && hasHLS) {
      const videoElement = videoRef.current;
      
      const handleLoadedData = () => {
        setIsLoading(false);
        setHasError(false);
      };

      const handleError = (e: Event) => {
        console.error('Video preview error:', e);
        setIsLoading(false);
        setHasError(true);
        onError?.('Failed to load video preview');
      };

      videoElement.addEventListener('loadeddata', handleLoadedData);
      videoElement.addEventListener('error', handleError);

      return () => {
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('error', handleError);
      };
    }
  }, [hasHLS, onError]);

  // Show error message if HLS is not available
  if (!hasHLS) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full h-32 rounded bg-gray-200 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <div className="text-sm">HLS video unavailable</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Video element with full controls */}
      <video
        ref={videoRef}
        className="w-full h-32 object-cover rounded bg-gray-100"
        controls
        playsInline
        preload="metadata"
        muted
      >
        {video.hls?.video_url && (
          <>
            <source src={video.hls.video_url} type="application/x-mpegURL" />
            <source src={video.hls.video_url} type="video/mp4" />
          </>
        )}
        Your browser does not support the video tag.
      </video>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 rounded flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
            <div className="text-xs text-gray-500">Loading video...</div>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-200 rounded flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
            <div className="text-xs text-gray-500">Video failed to load</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPreview;

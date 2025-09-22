import { useState, useCallback } from 'react';
import { UseVideosReturn, Video } from '../types';
import ApiService from '../services/api';

/**
 * Hook for handling video list from TwelveLabs index
 */
export function useVideos(): UseVideosReturn {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await ApiService.getVideos();
      
      if (ApiService.isApiError(response)) {
        throw new Error(response.error);
      }

      setVideos(response.videos);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch videos';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    videos,
    loading,
    error,
    fetchVideos
  };
}

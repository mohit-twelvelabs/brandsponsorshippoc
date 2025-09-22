import { useState, useCallback, useRef, useEffect } from 'react';
import { UseAnalysisReturn, AnalysisResponse, MultiVideoAnalysisResponse, ProgressStage } from '../types';
import ApiService from '../services/api';

/**
 * Hook for handling video analysis
 */
export function useAnalysis(): UseAnalysisReturn {
  const [data, setData] = useState<AnalysisResponse | MultiVideoAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [stage, setStage] = useState<ProgressStage | undefined>();
  const [details, setDetails] = useState<string | undefined>();
  const [brandsFound, setBrandsFound] = useState<string[] | undefined>();
  const [isMultiVideo, setIsMultiVideo] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const analyzeVideo = useCallback(async (videoId: string, selectedBrands?: string[]): Promise<AnalysisResponse> => {
    return new Promise(async (resolve, reject) => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setData(null);
      setStage(undefined);
      setDetails(undefined);
      setBrandsFound(undefined);
      setIsMultiVideo(false);

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      try {
        // Start analysis
        const { job_id } = await ApiService.startAnalysis(videoId, selectedBrands);
        console.log('Analysis started with job ID:', job_id);

        // Poll for status updates
        intervalRef.current = setInterval(async () => {
          try {
            const status = await ApiService.getAnalysisStatus(job_id);
            console.log('Status update:', status);

            // Update state
            setProgress(status.progress || 0);
            setStatus(status.message || 'Processing...');
            setStage(status.stage);
            setDetails(status.details);
            if (status.brands_found) {
              setBrandsFound(status.brands_found);
            }

            // Check if complete
            if (status.status === 'completed' && status.data) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setData(status.data);
              setLoading(false);
              // Type assertion for single video analysis
              if ('summary' in status.data) {
                resolve(status.data as AnalysisResponse);
              } else {
                reject(new Error('Invalid response format for single video analysis'));
              }
            } else if (status.status === 'failed') {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              const errorMessage = status.error || 'Analysis failed';
              setError(errorMessage);
              setLoading(false);
              reject(new Error(errorMessage));
            }
          } catch (err: any) {
            console.error('Error polling status:', err);
            
            // If job not found (404), stop polling
            if (err.response?.status === 404) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setError('Analysis job expired or not found');
              setLoading(false);
              reject(new Error('Analysis job expired or not found'));
            }
          }
        }, 1000); // Poll every second

      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to start analysis';
        setError(errorMessage);
        setLoading(false);
        reject(new Error(errorMessage));
      }
    });
  }, []);

  const analyzeMultipleVideos = useCallback(async (videoIds: string[], selectedBrands?: string[]): Promise<MultiVideoAnalysisResponse> => {
    return new Promise(async (resolve, reject) => {
      setLoading(true);
      setError(null);
      setProgress(0);
      setData(null);
      setStage(undefined);
      setDetails(undefined);
      setBrandsFound(undefined);
      setIsMultiVideo(true);

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      try {
        // Start multi-video analysis
        const { job_id } = await ApiService.startMultiVideoAnalysis(videoIds, selectedBrands);
        console.log('Multi-video analysis started with job ID:', job_id);

        // Poll for status updates
        intervalRef.current = setInterval(async () => {
          try {
            const status = await ApiService.getAnalysisStatus(job_id);
            console.log('Multi-video status update:', status);

            // Update state
            setProgress(status.progress || 0);
            setStatus(status.message || 'Processing...');
            setStage(status.stage);
            setDetails(status.details);
            if (status.brands_found) {
              setBrandsFound(status.brands_found);
            }

            // Check if complete
            if (status.status === 'completed' && status.data) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setData(status.data);
              setLoading(false);
              // Type assertion for multi-video analysis
              if ('combined_summary' in status.data) {
                resolve(status.data as MultiVideoAnalysisResponse);
              } else {
                reject(new Error('Invalid response format for multi-video analysis'));
              }
            } else if (status.status === 'failed') {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              const errorMessage = status.error || 'Multi-video analysis failed';
              setError(errorMessage);
              setLoading(false);
              reject(new Error(errorMessage));
            }
          } catch (err: any) {
            console.error('Error polling multi-video status:', err);
            
            // If job not found (404), stop polling
            if (err.response?.status === 404) {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              setError('Multi-video analysis job expired or not found');
              setLoading(false);
              reject(new Error('Multi-video analysis job expired or not found'));
            }
          }
        }, 1000); // Poll every second

      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to start multi-video analysis';
        setError(errorMessage);
        setLoading(false);
        reject(new Error(errorMessage));
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    analyzeVideo,
    analyzeMultipleVideos,
    data,
    loading,
    error,
    progress,
    status,
    stage,
    details,
    brandsFound,
    isMultiVideo
  };
}

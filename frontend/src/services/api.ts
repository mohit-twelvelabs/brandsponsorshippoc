import axios, { AxiosResponse } from 'axios';
import {
  AnalysisResponse,
  MultiVideoAnalysisResponse,
  VideosResponse,
  SearchResponse,
  ApiError,
  AnalysisStatus
} from '../types';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'https://brc.up.railway.app/api',
  timeout: 300000, // 5 minutes for video processing
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export class ApiService {
  /**
   * Health check endpoint
   */
  static async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response: AxiosResponse = await api.get('/health');
    return response.data;
  }

  /**
   * Get all videos from TwelveLabs index
   */
  static async getVideos(): Promise<VideosResponse> {
    const response: AxiosResponse<VideosResponse> = await api.get('/videos');
    return response.data;
  }

  /**
   * Analyze video for brand sponsorships
   */
  static async analyzeVideo(videoId: string): Promise<AnalysisResponse> {
    const response: AxiosResponse<AnalysisResponse> = await api.get(`/analyze/${videoId}`);
    return response.data;
  }

  /**
   * Start video analysis and return job ID
   */
  static async startAnalysis(videoId: string, selectedBrands?: string[]): Promise<{ job_id: string }> {
    const response: AxiosResponse = await api.post(`/analyze/${videoId}/start`, {
      brands: selectedBrands || []
    });
    return response.data;
  }

  /**
   * Get analysis job status
   */
  static async getAnalysisStatus(jobId: string): Promise<AnalysisStatus> {
    const response: AxiosResponse<AnalysisStatus> = await api.get(`/analyze/status/${jobId}`);
    return response.data;
  }

  /**
   * Start multi-video analysis and return job ID
   */
  static async startMultiVideoAnalysis(videoIds: string[], selectedBrands?: string[]): Promise<{ job_id: string }> {
    const response: AxiosResponse = await api.post('/analyze/multi/start', {
      video_ids: videoIds,
      brands: selectedBrands || []
    });
    return response.data;
  }

  /**
   * Analyze multiple videos for brand sponsorships
   */
  static async analyzeMultipleVideos(videoIds: string[]): Promise<MultiVideoAnalysisResponse> {
    const response: AxiosResponse<MultiVideoAnalysisResponse> = await api.post('/analyze/multi', {
      video_ids: videoIds
    });
    return response.data;
  }

  /**
   * Search for brands across videos
   */
  static async searchBrands(query: string): Promise<SearchResponse> {
    const response: AxiosResponse<SearchResponse> = await api.get('/search', {
      params: { query }
    });
    return response.data;
  }

  /**
   * Get video details including thumbnail
   */
  static async getVideoDetails(videoId: string): Promise<any> {
    const response: AxiosResponse<any> = await api.get(`/video/${videoId}/details`);
    return response.data;
  }

  /**
   * Get video thumbnail URL
   */
  static async getVideoThumbnail(videoId: string): Promise<{ thumbnail_url: string }> {
    const response: AxiosResponse<{ thumbnail_url: string }> = await api.get(`/video/${videoId}/thumbnail`);
    return response.data;
  }

  /**
   * Generate report in specified format
   */
  static async generateReport(format: 'pdf' | 'csv' | 'json'): Promise<{ message: string; status: string; estimated_completion: string }> {
    const response: AxiosResponse = await api.get(`/report/${format}`);
    return response.data;
  }

  /**
   * Check if response is an error
   */
  static isApiError(response: any): response is ApiError {
    return response && typeof response.error === 'string';
  }
}

export default ApiService;

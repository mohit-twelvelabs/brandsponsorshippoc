// API Response Types
export interface AnalysisSummary {
  event_title: string;
  analysis_date: string;
  video_duration_minutes: number;
  total_brands_detected: number;
  total_brand_appearances: number;
  top_performing_brand: string | null;
  top_brand_score: number;
}

export interface BrandAppearance {
  timeline: [number, number];
  brand: string;
  type: 'logo' | 'jersey_sponsor' | 'stadium_signage' | 'digital_overlay' | 'audio_mention' | 'product_placement' | 'commercial' | 'ctv_ad' | 'overlay_ad' | 'squeeze_ad';
  sponsorship_category: 'ad_placement' | 'in_game_placement';
  location: [number, number, number, number];
  prominence: 'primary' | 'secondary' | 'background';
  context: 'game_action' | 'replay' | 'celebration' | 'interview' | 'crowd_shot' | 'commercial' | 'transition';
  description: string;
  sentiment_context: 'positive' | 'neutral' | 'negative';
  viewer_attention: 'high' | 'medium' | 'low';
}

export interface PlacementMetrics {
  optimal_placements: number;
  suboptimal_placements: number;
  missed_opportunities: string[];
  placement_score: number;
  visibility_metrics: {
    average_duration: number;
    total_screen_time: number;
    screen_time_percentage: number;
  };
  engagement_windows: Array<{
    time_range: [number, number];
    duration: number;
    type: string;
    quality: 'optimal' | 'suboptimal';
    context: string;
  }>;
}

export interface ROIAssessment {
  value_rating: 'excellent' | 'good' | 'fair' | 'poor';
  cost_efficiency: number;
  exposure_quality: number;
  audience_reach: number;
}

export interface PlacementAnalysis {
  optimal_placements: string;
  suboptimal_placements: string;
  missed_opportunities: string[];
  timing_effectiveness: string;
}

export interface PlacementRecommendations {
  immediate_actions: string[];
  future_strategy: string[];
  optimal_moments: string[];
  avoid_these: string[];
}

export interface CompetitiveInsights {
  market_position: string;
  unique_advantages: string;
  gaps_to_address: string;
}

export interface ROIProjection {
  estimated_impressions: number;
  cost_per_impression: string;
  brand_recall_likelihood: 'high' | 'medium' | 'low';
  purchase_intent_impact: 'positive' | 'neutral' | 'negative';
  overall_roi_rating: number;
}

export interface AIInsights {
  placement_effectiveness_score?: number;
  roi_assessment?: ROIAssessment;
  placement_analysis?: PlacementAnalysis;
  recommendations?: PlacementRecommendations;
  competitive_insights?: CompetitiveInsights;
  roi_projection?: ROIProjection;
  executive_summary?: string;
  placement_metrics?: PlacementMetrics;
  brand_intelligence?: any;
  error?: string;
  scoring_factors?: {
    visibility_impact: number;
    context_quality: number;
    engagement_potential: number;
    sentiment_alignment: number;
    strategic_placement: number;
    audience_alignment: number;
    brand_fit: number;
  };
}

export interface SponsorshipCategoryMetrics {
  count: number;
  exposure_time: number;
  percentage_of_total: number;
}

export interface SponsorshipBreakdown {
  ad_placements: SponsorshipCategoryMetrics;
  in_game_placements: SponsorshipCategoryMetrics;
}

export interface BrandMetrics {
  brand: string;
  total_exposure_time: number;
  total_appearances: number;
  contextual_value_score: number;
  high_impact_moments: number;
  sentiment_score: number;
  sentiment_label: 'positive' | 'neutral' | 'negative';
  avg_prominence: number;
  avg_viewer_attention: number;
  contexts: string[];
  estimated_social_mentions: number;
  appearances: BrandAppearance[];
  ai_insights?: AIInsights;
  sponsorship_breakdown: SponsorshipBreakdown;
  ad_placements: BrandAppearance[];
  in_game_placements: BrandAppearance[];
}

export interface AnalysisResponse {
  summary: AnalysisSummary;
  brand_metrics: BrandMetrics[];
  raw_detections: BrandAppearance[];
  video_id: string;
  analysis_timestamp: string;
}

export interface MultiVideoAnalysisResponse {
  combined_summary: CombinedAnalysisSummary;
  combined_brand_metrics: BrandMetrics[];
  raw_detections: BrandAppearance[];
  individual_analyses: AnalysisResponse[];
  video_ids: string[];
  analysis_timestamp: string;
}

export interface CombinedAnalysisSummary {
  total_videos: number;
  combined_duration_minutes: number;
  total_brands_detected: number;
  total_brand_appearances: number;
  top_performing_brand: string | null;
  top_brand_score: number;
  videos_analyzed: {
    video_id: string;
    filename: string;
    duration_minutes: number;
    start_time_seconds: number;
    end_time_seconds: number;
  }[];
}

export interface Video {
  id: string;
  filename: string;
  duration: number;
  created_at: string;
  thumbnail_url: string | null;
  status: string;
  hls?: {
    video_url: string | null;
    thumbnail_urls: string[];
    status: string | null;
  };
}

export interface VideosResponse {
  videos: Video[];
  total_count: number;
  index_id: string;
  message?: string;
}

export interface SearchResult {
  video_id: string;
  start: number;
  end: number;
  confidence: number;
  metadata: Record<string, any>;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total_results: number;
}

export interface ApiError {
  error: string;
}

// Component Props Types
export interface BrandSearchProps {
  onBrandsSelect: (brands: string[]) => void;
  onNext: () => void;
  isLoading?: boolean;
}

export interface VideoSelectorProps {
  onVideoSelect?: (videoId: string) => void;
  onVideosSelect?: (videoIds: string[]) => void;
  onError: (error: string) => void;
  isAnalyzing?: boolean;
  selectedBrands?: string[];
  multiSelect?: boolean;
  selectedVideoIds?: string[];
}

export interface AnalyticsDashboardProps {
  analysisData: AnalysisResponse | MultiVideoAnalysisResponse | null;
  isLoading: boolean;
  isMultiVideo?: boolean;
}

export interface BrandMetricsCardProps {
  brandMetrics: BrandMetrics[];
}

export interface TimelineChartProps {
  brandAppearances: BrandAppearance[];
  containerId: string;
  videoBoundaries?: {
    video_id: string;
    filename: string;
    start_time_seconds: number;
    end_time_seconds: number;
  }[];
}

export interface LoadingScreenProps {
  progress: number;
  status: string;
  isVisible: boolean;
  stage?: ProgressStage;
  details?: string;
  brandsFound?: string[];
}

export type ProgressStage = 
  | 'initialization'
  | 'brand_detection' 
  | 'brand_analysis'
  | 'processing'
  | 'metrics'
  | 'finalizing';

export interface AnalysisStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  stage?: ProgressStage;
  details?: string;
  brands_found?: string[];
  data?: AnalysisResponse | MultiVideoAnalysisResponse;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface AlertProps {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

// Hook Types
export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: any[]) => Promise<void>;
}

export interface UseVideosReturn {
  videos: Video[];
  loading: boolean;
  error: string | null;
  fetchVideos: () => Promise<void>;
}

export interface UseAnalysisReturn {
  analyzeVideo: (videoId: string, selectedBrands?: string[]) => Promise<AnalysisResponse>;
  analyzeMultipleVideos: (videoIds: string[], selectedBrands?: string[]) => Promise<MultiVideoAnalysisResponse>;
  data: AnalysisResponse | MultiVideoAnalysisResponse | null;
  loading: boolean;
  error: string | null;
  progress: number;
  status: string;
  stage?: ProgressStage;
  details?: string;
  brandsFound?: string[];
  isMultiVideo: boolean;
}

// Utility Types
export type TabType = 'overview' | 'timeline' | 'context' | 'reach-awareness' | 'engagement' | 'brand-performance' | 'business-impact' | 'content-quality';
export type AppStep = 'brand-search' | 'video-selection' | 'analysis' | 'results';

export interface TabItem {
  id: TabType;
  label: string;
  icon: string;
}

export interface ChartData {
  x: number[];
  y: number[];
  type: string;
  mode: string;
  name: string;
  line?: {
    width: number;
  };
}

export interface ChartLayout {
  title: string;
  xaxis: {
    title: string;
  };
  yaxis: {
    title: string;
  };
  hovermode: string;
}

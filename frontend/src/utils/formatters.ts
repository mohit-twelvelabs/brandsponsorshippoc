/**
 * Utility functions for formatting data
 */

/**
 * Format seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format sentiment score to readable text
 */
export function formatSentiment(score: number): string {
  if (score > 0.5) return 'Very Positive';
  if (score > 0.2) return 'Positive';
  if (score > -0.2) return 'Neutral';
  if (score > -0.5) return 'Negative';
  return 'Very Negative';
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Format file size to readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get sentiment color based on score
 */
export function getSentimentColor(score: number): string {
  if (score > 0.5) return 'text-green-600';
  if (score > 0.2) return 'text-green-500';
  if (score > -0.2) return 'text-gray-500';
  if (score > -0.5) return 'text-orange-500';
  return 'text-red-600';
}

/**
 * Get brand type icon
 */
export function getBrandTypeIcon(type: string): string {
  switch (type) {
    case 'logo': return '🏷️';
    case 'jersey_sponsor': return '👕';
    case 'stadium_signage': return '🏟️';
    case 'digital_overlay': return '📺';
    case 'audio_mention': return '🎤';
    default: return '🏷️';
  }
}

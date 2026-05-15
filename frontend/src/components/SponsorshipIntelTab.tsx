import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Zap, Search, Download, Play, Pause, AlertCircle, AlertTriangle } from 'lucide-react';
import { AnalysisResponse, BrandAppearance, MultiVideoAnalysisResponse } from '../types';
import ApiService from '../services/api';

interface SponsorshipIntelTabProps {
  analysisData: AnalysisResponse | MultiVideoAnalysisResponse;
  isMultiVideo?: boolean;
}

interface Impression {
  id: number;
  sponsor: string;
  location: string;
  start: number;
  end: number;
  duration: number;
  ctx: string;
  isInGame: boolean;
  prominence: 'primary' | 'secondary' | 'background';
  legibility: number;
  confidence: 'high' | 'medium' | 'low';
  confidenceRank: number; // 3=high, 2=medium, 1=low — for sorting
  flagged: boolean;
  flagReason: string | null;
  videoId: string;
}

const PROMINENCE_TO_LEG: Record<string, number> = { primary: 92, secondary: 78, background: 60 };
const ATTENTION_TO_LEG: Record<string, number> = { high: 90, medium: 75, low: 55 };
const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const CTX_LABEL: Record<string, string> = {
  ad_placement: 'AD',
  in_game_placement: 'IN-GAME',
};

const hhmmss = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return [h, m, sec].map(x => x.toString().padStart(2, '0')).join(':');
};

const fmtDur = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

// Tailwind classes for quality-tier coloring — kept light-themed.
const legText = (v: number) =>
  v >= 80 ? 'text-green-600' : v >= 70 ? 'text-lime-600' : v >= 60 ? 'text-amber-600' : 'text-red-600';
const legBg = (v: number) =>
  v >= 80 ? 'bg-green-500' : v >= 70 ? 'bg-lime-500' : v >= 60 ? 'bg-amber-500' : 'bg-red-500';

const confText = (c: string) =>
  c === 'high' ? 'text-green-600' : c === 'medium' ? 'text-amber-600' : 'text-red-600';
const confDot = (c: string) =>
  c === 'high' ? 'bg-green-500' : c === 'medium' ? 'bg-amber-500' : 'bg-red-500';

const titleCase = (s: string) =>
  s.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');

const SponsorshipIntelTab: React.FC<SponsorshipIntelTabProps> = ({ analysisData, isMultiVideo }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [filterCtx, setFilterCtx] = useState<'all' | 'in-game' | 'ad' | 'flagged'>('all');
  const [filterSponsor, setFilterSponsor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Default sort: confidence DESC (most reliable hits first), tiebreak on legibility.
  const [sortKey, setSortKey] = useState<keyof Impression>('confidenceRank');
  const [sortAsc, setSortAsc] = useState(false);

  // ────────────────────────────────────────────
  // Data shaping
  // ────────────────────────────────────────────

  const primaryVideoId: string = useMemo(() => {
    const single = analysisData as AnalysisResponse;
    if (single.video_id) return single.video_id;
    const multi = analysisData as MultiVideoAnalysisResponse;
    return multi.individual_analyses?.[0]?.video_id || multi.video_ids?.[0] || '';
  }, [analysisData]);

  const totalDuration: number = useMemo(() => {
    if (duration > 0) return duration; // Prefer the actual video's reported duration when loaded.
    if ('summary' in analysisData && (analysisData as AnalysisResponse).summary?.video_duration_minutes) {
      return (analysisData as AnalysisResponse).summary.video_duration_minutes * 60;
    }
    const multi = analysisData as MultiVideoAnalysisResponse;
    if (multi.combined_summary?.combined_duration_minutes) {
      return multi.combined_summary.combined_duration_minutes * 60;
    }
    const all: BrandAppearance[] = (analysisData as any).raw_detections || [];
    const maxEnd = all.reduce((m, a) => Math.max(m, a.timeline?.[1] || 0), 0);
    return maxEnd || 60;
  }, [analysisData, duration]);

  const impressions: Impression[] = useMemo(() => {
    const raw: BrandAppearance[] = (analysisData as any).raw_detections || [];
    return raw
      .filter(a => a.timeline && a.timeline.length === 2 && a.timeline[1] > a.timeline[0])
      .map((a, i) => {
        const start = a.timeline[0];
        const end = a.timeline[1];
        const cat = a.sponsorship_category || 'in_game_placement';
        const marengoConf: string | undefined = (a as any).marengo_confidence;
        const confidence = (marengoConf as 'high' | 'medium' | 'low') ||
          (a.prominence === 'primary' ? 'high' : a.prominence === 'secondary' ? 'medium' : 'low');
        const legibility = Math.round(
          PROMINENCE_TO_LEG[a.prominence] ?? ATTENTION_TO_LEG[a.viewer_attention] ?? 65,
        );
        const flagged = legibility < 60;
        return {
          id: i,
          sponsor: a.brand,
          location: titleCase(a.type || 'logo'),
          start,
          end,
          duration: end - start,
          ctx: CTX_LABEL[cat] || cat,
          isInGame: cat === 'in_game_placement',
          prominence: a.prominence,
          legibility,
          confidence,
          confidenceRank: CONFIDENCE_RANK[confidence] || 1,
          flagged,
          flagReason: flagged
            ? 'Low legibility — small or peripheral placement; close-up exposure would help'
            : null,
          videoId: (a as any).video_id || primaryVideoId,
        };
      });
  }, [analysisData, primaryVideoId]);

  // ────────────────────────────────────────────
  // Video bootstrap (HLS) + state listeners
  // ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    if (!primaryVideoId) return;
    ApiService.getVideoDetails(primaryVideoId)
      .then((details: any) => {
        if (cancelled) return;
        const url = details?.hls?.video_url || details?.video_url || null;
        if (url) setVideoUrl(url);
        else setVideoError('No HLS stream available for this video.');
      })
      .catch(() => {
        if (!cancelled) setVideoError('Could not fetch video details.');
      });
    return () => {
      cancelled = true;
    };
  }, [primaryVideoId]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoUrl) return;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false, lowLatencyMode: false });
      hlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(v);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = videoUrl;
    }
    const onTime = () => setCurrentTime(v.currentTime);
    const onDuration = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onProgress = () => {
      try {
        if (v.buffered.length > 0) {
          setBuffered(v.buffered.end(v.buffered.length - 1));
        }
      } catch {
        // ignore
      }
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onDuration);
    v.addEventListener('durationchange', onDuration);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('progress', onProgress);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onDuration);
      v.removeEventListener('durationchange', onDuration);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('progress', onProgress);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(totalDuration, t));
    v.play().catch(() => undefined);
  };

  const scrubFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    seek((x / r.width) * totalDuration);
  };

  // ────────────────────────────────────────────
  // KPIs
  // ────────────────────────────────────────────

  const kpis = useMemo(() => {
    const n = impressions.length;
    const totalSec = impressions.reduce((a, b) => a + b.duration, 0);
    const uniq = new Set(impressions.map(i => i.sponsor)).size;
    const avgLeg = n > 0 ? Math.round(impressions.reduce((a, b) => a + b.legibility, 0) / n) : 0;
    const adPct = n > 0 ? Math.round((impressions.filter(i => !i.isInGame).length / n) * 100) : 0;
    const flagged = new Set(impressions.filter(i => i.flagged).map(i => i.sponsor)).size;
    return { n, totalSec, uniq, avgLeg, adPct, flagged };
  }, [impressions]);

  // ────────────────────────────────────────────
  // Filtering + sorting
  // ────────────────────────────────────────────

  const filtered = useMemo(() => {
    let d = [...impressions];
    if (filterCtx === 'in-game') d = d.filter(i => i.isInGame);
    else if (filterCtx === 'ad') d = d.filter(i => !i.isInGame);
    else if (filterCtx === 'flagged') d = d.filter(i => i.flagged);
    if (filterSponsor) d = d.filter(i => i.sponsor === filterSponsor);
    if (search) {
      const q = search.toLowerCase();
      d = d.filter(i => i.sponsor.toLowerCase().includes(q) || i.location.toLowerCase().includes(q));
    }
    d.sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      // Tie-break confidence sorts on legibility so the most reliable + most visible bubble up.
      if (sortKey === 'confidenceRank' && av === bv) {
        av = a.legibility;
        bv = b.legibility;
      }
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = bv.toLowerCase();
      }
      return sortAsc ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
    return d;
  }, [impressions, filterCtx, filterSponsor, search, sortKey, sortAsc]);

  // ────────────────────────────────────────────
  // Per-sponsor aggregates
  // ────────────────────────────────────────────

  const sponsorAggs = useMemo(() => {
    const m: Record<string, {
      sponsor: string;
      count: number;
      totalDur: number;
      inGame: number;
      legSum: number;
      placements: Set<string>;
    }> = {};
    impressions.forEach(i => {
      if (!m[i.sponsor]) {
        m[i.sponsor] = { sponsor: i.sponsor, count: 0, totalDur: 0, inGame: 0, legSum: 0, placements: new Set() };
      }
      const agg = m[i.sponsor];
      agg.count++;
      agg.totalDur += i.duration;
      if (i.isInGame) agg.inGame++;
      agg.legSum += i.legibility;
      agg.placements.add(i.location);
    });
    return Object.values(m).map(a => ({
      ...a,
      avgLeg: a.count > 0 ? Math.round(a.legSum / a.count) : 0,
      inGamePct: a.count > 0 ? Math.round((a.inGame / a.count) * 100) : 0,
      topPlacement: a.placements.size > 0 ? Array.from(a.placements)[0] : 'Unknown',
    })).sort((a, b) => b.totalDur - a.totalDur);
  }, [impressions]);

  // ────────────────────────────────────────────
  // Live feed at playhead — sort by confidence DESC, then legibility DESC
  // ────────────────────────────────────────────

  const liveImpressions = useMemo(() => {
    const hits = impressions.filter(i => currentTime >= i.start && currentTime < i.end);
    return hits.sort((a, b) => {
      if (b.confidenceRank !== a.confidenceRank) return b.confidenceRank - a.confidenceRank;
      return b.legibility - a.legibility;
    });
  }, [impressions, currentTime]);

  // ────────────────────────────────────────────
  // Export
  // ────────────────────────────────────────────

  const exportCsv = () => {
    const hdr =
      'Sponsor,Placement,Start (HH:MM:SS),End (HH:MM:SS),Start (s),End (s),Duration (s),Context,In-Game,Legibility,Confidence,Flagged,Flag Reason\n';
    const rows = filtered.map(i =>
      `"${i.sponsor}","${i.location}","${hhmmss(i.start)}","${hhmmss(i.end)}",${i.start.toFixed(1)},${i.end.toFixed(1)},${Math.round(i.duration)},"${i.ctx}",${i.isInGame},${i.legibility},"${i.confidence}",${i.flagged},"${i.flagReason || ''}"`,
    ).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([hdr + rows], { type: 'text/csv' }));
    a.download = 'sponsorship-intel.csv';
    a.click();
  };

  const doSort = (k: keyof Impression) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      // Sensible default direction per column: text ascending, numbers descending.
      setSortAsc(k === 'sponsor' || k === 'location' || k === 'ctx' || k === 'start');
    }
  };

  const sortArrow = (k: keyof Impression) => (sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : '');

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* HEADER + KPIs */}
      <div className="flex items-start justify-between flex-wrap gap-3 pb-4 border-b">
        <div className="flex items-start gap-2">
          <Zap className="w-5 h-5 text-orange-500 mt-0.5" />
          <div>
            <div className="text-base font-bold tracking-tight">Sponsorship Intelligence</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {isMultiVideo ? 'Multi-video composite' : 'Single video analysis'}
              <span className="mx-1.5">·</span>Duration {hhmmss(totalDuration)}
              <span className="mx-1.5">·</span>Powered by TwelveLabs Marengo
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { v: kpis.n, l: 'Impressions' },
            { v: `${Math.round(kpis.totalSec)}s`, l: 'Sponsor-Seconds' },
            { v: kpis.uniq, l: 'Sponsors' },
            { v: kpis.avgLeg, l: 'Avg Legibility' },
            { v: `${kpis.adPct}%`, l: 'Ad-Placement %' },
            { v: kpis.flagged, l: 'Flagged' },
          ].map(k => (
            <div key={k.l} className="rounded-md px-3 py-1.5 text-center bg-gray-50 border min-w-[78px]">
              <div className={`text-lg font-bold leading-tight ${k.l === 'Flagged' && kpis.flagged > 0 ? 'text-red-500' : 'text-orange-500'}`}>{k.v}</div>
              <div className="text-[9px] uppercase tracking-wider text-gray-500">{k.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PLAYER + LIVE FEED */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
        <div className="rounded-lg overflow-hidden border bg-black relative" style={{ minHeight: 260 }}>
          {videoError ? (
            <div className="flex items-center justify-center text-white/80 text-sm gap-2 py-20 px-6 text-center">
              <AlertCircle className="w-4 h-4" /> {videoError}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                controls={false}
                onClick={togglePlay}
                className="w-full block cursor-pointer"
                style={{ height: 280, objectFit: 'contain', background: '#000' }}
              />
              {/* Custom controls overlay */}
              <div className="absolute inset-x-0 bottom-0 px-3 pt-8 pb-2"
                   style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))' }}>
                {/* Scrubber */}
                <div
                  onClick={scrubFromEvent}
                  className="relative w-full cursor-pointer group select-none"
                  style={{ height: 18, paddingTop: 7, paddingBottom: 7 }}
                >
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/25" />
                  {totalDuration > 0 && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/40"
                      style={{ width: `${Math.min(100, (buffered / totalDuration) * 100)}%` }}
                    />
                  )}
                  {totalDuration > 0 && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-orange-500"
                      style={{ width: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
                    />
                  )}
                  {totalDuration > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-orange-500 ring-2 ring-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `calc(${Math.min(100, (currentTime / totalDuration) * 100)}% - 6px)` }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 mt-1 text-white text-xs">
                  <button
                    onClick={togglePlay}
                    className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <span className="font-mono tabular-nums text-[11px]">
                    {hhmmss(currentTime)} / {hhmmss(totalDuration)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
        {/* Live Sponsor Feed sidebar */}
        <div className="rounded-lg border bg-card flex flex-col" style={{ height: 280 }}>
          <div className="flex justify-between items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b">
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-orange-500" /> Live Sponsor Feed</span>
            <span className="text-xs font-normal normal-case text-gray-700 font-mono tabular-nums">{hhmmss(currentTime)}</span>
          </div>
          <div className="flex-1 overflow-y-auto sponsorship-feed-scroll p-1.5">
            {liveImpressions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-gray-400">
                {videoUrl ? 'No tracked brands at this moment' : 'Loading video…'}
              </div>
            ) : (
              liveImpressions.map(i => (
                <button
                  key={i.id}
                  onClick={() => seek(i.start)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded mb-0.5 hover:bg-accent/20 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">{i.sponsor}</div>
                    <div className="text-[10px] text-gray-500 truncate">{i.location}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${confDot(i.confidence)}`} />
                      <span className={`text-[9px] uppercase tracking-wider font-bold ${confText(i.confidence)}`}>{i.confidence}</span>
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 flex-shrink-0 ${legText(i.legibility)}`}
                       style={{ borderColor: 'currentColor' }}>
                    {i.legibility}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PER-SPONSOR TRACKS */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex justify-between items-center mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <span>Sponsor Impression Tracks — click any segment to jump</span>
          <span className="text-[10px] font-normal normal-case text-gray-500 flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-green-500" /> In-Game</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-500" /> Ad</span>
          </span>
        </div>
        <div className="space-y-1">
          {sponsorAggs.map(agg => {
            const tracks = impressions.filter(i => i.sponsor === agg.sponsor);
            const isFiltered = filterSponsor === agg.sponsor;
            return (
              <div key={agg.sponsor} className="flex items-center" style={{ height: 22 }}>
                <button
                  onClick={() => setFilterSponsor(isFiltered ? null : agg.sponsor)}
                  className={`text-[11px] text-left truncate pr-2 hover:underline ${isFiltered ? 'text-orange-500 font-semibold' : 'text-gray-700'}`}
                  style={{ width: 150, flexShrink: 0 }}
                  title={`Filter by ${agg.sponsor}`}
                >{agg.sponsor}</button>
                <div
                  className="flex-1 relative rounded cursor-pointer bg-gray-100 border"
                  style={{ height: 16 }}
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    seek(((e.clientX - r.left) / r.width) * totalDuration);
                  }}
                >
                  {tracks.map(t => {
                    const x = (t.start / totalDuration) * 100;
                    const w = Math.max((t.duration / totalDuration) * 100, 0.3);
                    return (
                      <div
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); seek(t.start); }}
                        className={`absolute top-px h-3.5 rounded-sm cursor-pointer hover:brightness-125 ${t.isInGame ? 'bg-green-500' : 'bg-amber-500'}`}
                        style={{ left: `${x}%`, width: `${w}%`, minWidth: 2 }}
                        title={`${t.sponsor} · ${hhmmss(t.start)}–${hhmmss(t.end)} · ${t.ctx}`}
                      />
                    );
                  })}
                  {totalDuration > 0 && (
                    <div
                      className="absolute top-0 w-px h-full bg-orange-500/80 pointer-events-none"
                      style={{ left: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {sponsorAggs.length === 0 && (
            <div className="text-xs py-5 text-center text-gray-400">No tracked impressions yet.</div>
          )}
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="rounded-lg border bg-card flex items-center gap-2 px-3 py-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Context:</span>
        {([
          { key: 'all', label: 'All' },
          { key: 'in-game', label: 'In-Game' },
          { key: 'ad', label: 'Ad' },
        ] as const).map(b => (
          <button
            key={b.key}
            onClick={() => setFilterCtx(b.key)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              filterCtx === b.key
                ? 'border-orange-500 bg-orange-50 text-orange-600'
                : 'border-gray-300 bg-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >{b.label}</button>
        ))}
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Quality:</span>
        <button
          onClick={() => setFilterCtx(filterCtx === 'flagged' ? 'all' : 'flagged')}
          className={`px-3 py-1 rounded-full text-xs border flex items-center gap-1 ${
            filterCtx === 'flagged'
              ? 'border-red-500 bg-red-50 text-red-600'
              : 'border-gray-300 bg-transparent text-gray-600 hover:bg-gray-50'
          }`}
        ><AlertTriangle className="w-3 h-3" /> Flagged Only</button>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sponsor or placement…"
              className="pl-7 pr-2 py-1 rounded text-xs border outline-none focus:border-orange-500 w-56 bg-card"
            />
          </div>
          <button
            onClick={exportCsv}
            className="px-2 py-1 rounded text-xs border bg-card text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          ><Download className="w-3 h-3" /> CSV</button>
        </div>
      </div>

      {/* SPONSOR CARDS */}
      <div className="rounded-lg border bg-card">
        <div className="flex gap-2 overflow-x-auto sponsorship-cards-scroll p-3">
          {sponsorAggs.map(agg => {
            const isActive = filterSponsor === agg.sponsor;
            return (
              <button
                key={agg.sponsor}
                onClick={() => setFilterSponsor(isActive ? null : agg.sponsor)}
                className={`rounded-lg px-3 py-2 min-w-[190px] flex-shrink-0 text-left transition-colors border ${
                  isActive ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-card hover:border-gray-300'
                }`}
              >
                <div className="font-bold text-sm truncate" title={agg.sponsor}>{agg.sponsor}</div>
                <div className="text-[10px] text-gray-500 mb-2 truncate">{agg.topPlacement}</div>
                <div className="flex gap-3 mb-2">
                  <div>
                    <div className="text-base font-bold leading-none">{agg.count}</div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-500">Imps</div>
                  </div>
                  <div>
                    <div className="text-base font-bold leading-none">{fmtDur(agg.totalDur)}</div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-500">On-Screen</div>
                  </div>
                  <div>
                    <div className="text-base font-bold leading-none">{agg.inGamePct}%</div>
                    <div className="text-[9px] uppercase tracking-wider text-gray-500">In-Game</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded overflow-hidden bg-gray-200">
                    <div className={`h-full ${legBg(agg.avgLeg)}`} style={{ width: `${agg.avgLeg}%` }} />
                  </div>
                  <span className={`text-xs font-bold ${legText(agg.avgLeg)}`}>{agg.avgLeg}</span>
                </div>
              </button>
            );
          })}
          {sponsorAggs.length === 0 && (
            <div className="text-xs py-3 text-gray-400">No sponsor data.</div>
          )}
        </div>
      </div>

      {/* DETAILED TABLE */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto sponsorship-table-scroll">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                {([
                  { k: 'sponsor', l: 'Sponsor' },
                  { k: 'location', l: 'Placement' },
                  { k: 'start', l: 'Start' },
                  { k: 'end', l: 'End' },
                  { k: 'duration', l: 'Duration' },
                  { k: 'ctx', l: 'Context' },
                  { k: 'legibility', l: 'Legibility' },
                  { k: 'confidenceRank', l: 'Confidence' },
                ] as const).map(({ k, l }) => (
                  <th
                    key={k}
                    onClick={() => doSort(k as keyof Impression)}
                    className={`text-[10px] uppercase tracking-wider font-bold px-3 py-2 cursor-pointer select-none whitespace-nowrap border-b ${sortKey === k ? 'text-orange-500' : 'text-gray-500 hover:text-gray-700'}`}
                  >{l}{sortArrow(k as keyof Impression)}</th>
                ))}
                <th className="text-[10px] uppercase tracking-wider font-bold px-3 py-2 text-gray-500 border-b">Flag</th>
                <th className="border-b" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-7 text-xs text-gray-400">No impressions match this filter.</td></tr>
              ) : (
                filtered.map(i => {
                  const inWindow = currentTime >= i.start && currentTime < i.end;
                  return (
                    <tr
                      key={i.id}
                      onClick={() => seek(i.start)}
                      className={`cursor-pointer border-b last:border-b-0 transition-colors ${
                        inWindow ? 'bg-orange-50' : !i.isInGame ? 'bg-amber-50/30' : 'bg-card'
                      } hover:bg-gray-50`}
                    >
                      <td className="px-3 py-2 text-xs"><strong>{i.sponsor}</strong></td>
                      <td className="px-3 py-2 text-xs text-gray-600">{i.location}</td>
                      <td className="px-3 py-2 text-xs font-mono tabular-nums">{hhmmss(i.start)}</td>
                      <td className="px-3 py-2 text-xs font-mono tabular-nums">{hhmmss(i.end)}</td>
                      <td className="px-3 py-2 text-xs">{fmtDur(i.duration)}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${i.isInGame ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {i.ctx}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`font-bold ${legText(i.legibility)}`}>{i.legibility}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${confDot(i.confidence)}`} />
                        <span className={`uppercase font-semibold ${confText(i.confidence)}`}>{i.confidence}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {i.flagged ? (
                          <span title={i.flagReason || 'Flagged'} className="text-orange-500">⚠</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <button
                          onClick={e => { e.stopPropagation(); seek(i.start); }}
                          className="px-2 py-0.5 rounded text-[10px] border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 inline-flex items-center gap-1"
                        ><Play className="w-2.5 h-2.5" /> Jump</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SponsorshipIntelTab;

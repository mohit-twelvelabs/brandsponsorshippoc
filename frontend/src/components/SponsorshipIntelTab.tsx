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

// Strand-token color helpers
const legText = (v: number) =>
  v >= 80 ? 'text-mb-green-dark' : v >= 70 ? 'text-mb-green-dark' : v >= 60 ? 'text-mb-orange-dark' : 'text-error';
const legBg = (v: number) =>
  v >= 80 ? 'bg-mb-green' : v >= 70 ? 'bg-mb-green' : v >= 60 ? 'bg-mb-orange' : 'bg-error';

const confText = (c: string) =>
  c === 'high' ? 'text-mb-green-dark' : c === 'medium' ? 'text-mb-orange-dark' : 'text-error';
const confDot = (c: string) =>
  c === 'high' ? 'bg-mb-green' : c === 'medium' ? 'bg-mb-orange' : 'bg-error';

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

  // Derived values for Share of Voice bar (plain const — no hook needed)
  const maxSponsorDur = sponsorAggs.reduce((m, a) => Math.max(m, a.totalDur), 1) || 1;

  // Top 12 sponsors for the cards grid
  const topSponsors = sponsorAggs.slice(0, 12);

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  return (
    <div className="space-y-12 lg:space-y-16">

      {/* ── 1. HERO KPI BAND ── */}
      <section>
        {/* Masterbrand stripe */}
        <div className="h-1 w-full rounded-full bg-gradient-to-r from-mb-green via-mb-orange to-mb-pink mb-8" />

        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">
            LIVE INTEL
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Sponsorship intelligence
          </h2>
          <p className="text-base text-text-secondary mt-1">
            {isMultiVideo ? 'Multi-video composite' : 'Single video'}
            {' · '}{hhmmss(totalDuration)}
            {' · '}Powered by TwelveLabs Marengo
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { v: kpis.n, l: 'Impressions' },
            { v: `${Math.round(kpis.totalSec)}s`, l: 'Sponsor-Seconds' },
            { v: kpis.uniq, l: 'Brands' },
            { v: kpis.avgLeg, l: 'Avg Quality' },
          ].map(k => (
            <div key={k.l} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-1">
              <span className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground tabular-nums">
                {k.v}
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary">
                {k.l}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. PLAYER + LIVE FEED ── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">

        {/* Player */}
        <div className="rounded-2xl border border-border bg-brand-charcoal overflow-hidden relative" style={{ minHeight: 280 }}>
          {videoError ? (
            <div className="flex items-center justify-center text-brand-white/80 text-sm gap-2 py-20 px-6 text-center">
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
                style={{ height: 400, objectFit: 'contain', background: '#000' }}
              />
              {/* Custom controls overlay */}
              <div
                className="absolute inset-x-0 bottom-0 px-3 pt-10 pb-3"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.90), rgba(0,0,0,0))' }}
              >
                {/* Scrubber */}
                <div
                  onClick={scrubFromEvent}
                  className="relative w-full cursor-pointer group select-none"
                  style={{ height: 20, paddingTop: 8, paddingBottom: 8 }}
                >
                  {/* Track background */}
                  <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-brand-white/15" />
                  {/* Buffered */}
                  {totalDuration > 0 && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-brand-white/30"
                      style={{ width: `${Math.min(100, (buffered / totalDuration) * 100)}%` }}
                    />
                  )}
                  {/* Progress fill */}
                  {totalDuration > 0 && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-mb-green"
                      style={{ width: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
                    />
                  )}
                  {/* Playhead dot */}
                  {totalDuration > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-mb-green ring-2 ring-brand-white shadow opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `calc(${Math.min(100, (currentTime / totalDuration) * 100)}% - 6px)` }}
                    />
                  )}
                </div>

                {/* Sponsor markers row — below scrubber */}
                {totalDuration > 0 && impressions.length > 0 && (
                  <div className="relative w-full" style={{ height: 6, marginTop: 3 }}>
                    {impressions.map(i => (
                      <div
                        key={i.id}
                        onClick={(e) => { e.stopPropagation(); seek(i.start); }}
                        title={`${i.sponsor} · ${i.location} · ${hhmmss(i.start)}`}
                        className={`absolute top-0 rounded-full cursor-pointer opacity-80 hover:opacity-100 transition-opacity ${confDot(i.confidence)}`}
                        style={{
                          left: `${(i.start / totalDuration) * 100}%`,
                          width: `${Math.max(0.4, (i.duration / totalDuration) * 100)}%`,
                          minWidth: 4,
                          height: 6,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Controls row */}
                <div className="flex items-center justify-between gap-3 mt-2 text-brand-white">
                  <button
                    onClick={togglePlay}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-mb-green/15 hover:bg-mb-green/30 text-mb-green transition-colors"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                  </button>
                  <span className="font-mono tabular-nums text-brand-white/80 text-sm">
                    {hhmmss(currentTime)} / {hhmmss(totalDuration)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Live Sponsor Feed sidebar */}
        <div className="rounded-2xl border border-border bg-card flex flex-col min-h-[280px] lg:h-[440px]">
          <div className="flex justify-between items-center px-4 py-3 border-b border-border flex-shrink-0">
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-mb-green" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark">
                Live Sponsor Feed
              </span>
            </span>
            <span className="font-mono tabular-nums text-sm text-foreground">{hhmmss(currentTime)}</span>
          </div>
          <div className="flex-1 overflow-y-auto sponsorship-feed-scroll p-2 min-h-0">
            {liveImpressions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-text-tertiary">
                {videoUrl ? 'No tracked brands at this moment' : 'Loading video…'}
              </div>
            ) : (
              liveImpressions.map(i => (
                <button
                  key={i.id}
                  onClick={() => seek(i.start)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl mb-1 hover:bg-mb-green-light/20 text-left transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground truncate">{i.sponsor}</div>
                    <div className="text-xs text-text-secondary truncate">{i.location}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${confDot(i.confidence)}`} />
                      <span className={`text-xs uppercase tracking-wider font-semibold ${confText(i.confidence)}`}>
                        {i.confidence}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${legText(i.legibility)}`}
                    style={{ borderColor: 'currentColor' }}
                  >
                    {i.legibility}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── 3. CONTROL BAR ── */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">Context:</span>
        {([
          { key: 'all', label: 'All' },
          { key: 'in-game', label: 'In-Game' },
          { key: 'ad', label: 'Ad' },
        ] as const).map(b => (
          <button
            key={b.key}
            onClick={() => setFilterCtx(b.key)}
            className={
              filterCtx === b.key
                ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-mb-green bg-mb-green-light/40 text-brand-charcoal text-sm font-semibold'
                : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium hover:border-mb-green-dark transition-colors'
            }
          >
            {b.label}
          </button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setFilterCtx(filterCtx === 'flagged' ? 'all' : 'flagged')}
          className={
            filterCtx === 'flagged'
              ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-error bg-error-light text-error text-sm font-semibold'
              : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card text-foreground text-sm font-medium hover:border-mb-green-dark transition-colors'
          }
        >
          <AlertTriangle className="w-3.5 h-3.5" /> Flagged Only
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sponsor or placement…"
              className="pl-9 pr-3 py-2 rounded-xl border border-border bg-card text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-mb-green-dark focus:ring-2 focus:ring-mb-green/30 transition text-sm w-64"
            />
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-transparent border border-border text-foreground font-semibold hover:bg-card transition-colors text-sm"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* ── 4. TOP SPONSORS GRID ── */}
      <section>
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">
            TOP SPONSORS
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Brand performance</h2>
        </div>

        {topSponsors.length === 0 ? (
          <p className="text-sm text-text-tertiary">No sponsor data.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topSponsors.map(agg => {
              const isActive = filterSponsor === agg.sponsor;
              const sovPct = Math.round((agg.totalDur / maxSponsorDur) * 100);
              return (
                <button
                  key={agg.sponsor}
                  onClick={() => setFilterSponsor(isActive ? null : agg.sponsor)}
                  className={`rounded-2xl border bg-card p-5 shadow-md text-left transition-colors ${
                    isActive
                      ? 'border-2 border-mb-green bg-mb-green-light/30'
                      : 'border-border hover:border-mb-green-dark'
                  }`}
                >
                  <div className="font-bold text-lg text-foreground truncate" title={agg.sponsor}>
                    {agg.sponsor}
                  </div>
                  <div className="text-sm text-text-secondary mb-4 truncate">{agg.topPlacement}</div>

                  <div className="flex gap-4 mb-4">
                    <div>
                      <div className="text-xl font-bold text-foreground tabular-nums leading-none">{agg.count}</div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mt-0.5">Imps</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground tabular-nums leading-none">{fmtDur(agg.totalDur)}</div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mt-0.5">On-Screen</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground tabular-nums leading-none">{agg.inGamePct}%</div>
                      <div className="text-xs font-bold uppercase tracking-[0.16em] text-text-secondary mt-0.5">In-Game</div>
                    </div>
                  </div>

                  {/* Share of Voice bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-border-light overflow-hidden">
                      <div className="h-full bg-mb-green rounded-full" style={{ width: `${sovPct}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-text-secondary font-medium">{sovPct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 5. IMPRESSIONS TABLE ── */}
      <section>
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">
            ALL IMPRESSIONS
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Every detection</h2>
          <p className="text-base text-text-secondary mt-1">Sorted by confidence, then legibility</p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto sponsorship-table-scroll">
            <table className="w-full text-left">
              <thead>
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
                      className={`px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-left border-b border-border cursor-pointer select-none whitespace-nowrap ${
                        sortKey === k ? 'text-mb-green-dark' : 'text-text-secondary hover:text-foreground'
                      }`}
                    >
                      {l}{sortArrow(k as keyof Impression)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-text-secondary text-left border-b border-border">
                    Flag
                  </th>
                  <th className="border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-sm text-text-tertiary">
                      No impressions match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map(i => {
                    const inWindow = currentTime >= i.start && currentTime < i.end;
                    return (
                      <tr
                        key={i.id}
                        onClick={() => seek(i.start)}
                        className={`hover:bg-mb-green-light/20 transition-colors cursor-pointer ${
                          inWindow ? 'bg-mb-green-light/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          <strong>{i.sponsor}</strong>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          {i.location}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light font-mono tabular-nums">
                          {hhmmss(i.start)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light font-mono tabular-nums">
                          {hhmmss(i.end)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          {fmtDur(i.duration)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            i.isInGame
                              ? 'bg-mb-green-light text-mb-green-dark'
                              : 'bg-mb-orange-light text-mb-orange-dark'
                          }`}>
                            {i.ctx}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          <span className="flex items-center gap-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${legBg(i.legibility)}`} />
                            <span className="text-foreground tabular-nums font-semibold">
                              {i.legibility}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          <span className="flex items-center gap-1.5">
                            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${confDot(i.confidence)}`} />
                            <span className={`uppercase font-semibold ${confText(i.confidence)}`}>
                              {i.confidence}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          {i.flagged ? (
                            <span title={i.flagReason || 'Flagged'} className="text-mb-orange-dark text-base">
                              ⚠
                            </span>
                          ) : (
                            <span className="text-text-tertiary">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground border-b border-border-light">
                          <button
                            onClick={e => { e.stopPropagation(); seek(i.start); }}
                            className="bg-mb-green-light text-mb-green-dark hover:bg-mb-green hover:text-brand-charcoal px-2 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <Play className="w-2.5 h-2.5" /> Jump
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Small footer stats */}
          <div className="px-4 py-2.5 border-t border-border-light flex items-center gap-4 text-xs text-text-tertiary">
            <span>Ad-Placement: <strong className="text-foreground">{kpis.adPct}%</strong></span>
            <span>Flagged sponsors: <strong className={kpis.flagged > 0 ? 'text-error' : 'text-foreground'}>{kpis.flagged}</strong></span>
          </div>
        </div>
      </section>

    </div>
  );
};

export default SponsorshipIntelTab;

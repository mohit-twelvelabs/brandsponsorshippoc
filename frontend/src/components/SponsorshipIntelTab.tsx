import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Zap, Search, Download, Play, AlertCircle } from 'lucide-react';
import { AnalysisResponse, BrandAppearance, MultiVideoAnalysisResponse } from '../types';
import ApiService from '../services/api';

interface SponsorshipIntelTabProps {
  analysisData: AnalysisResponse | MultiVideoAnalysisResponse;
  isMultiVideo?: boolean;
}

// Internal shape — one row per detected impression with all the display fields.
interface Impression {
  id: number;
  sponsor: string;
  location: string;
  start: number;
  end: number;
  duration: number;
  ctx: string; // sponsorship_category label
  ctxColor: string;
  isInGame: boolean;
  prominence: 'primary' | 'secondary' | 'background';
  legibility: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  flagged: boolean;
  flagReason: string | null;
  videoId: string;
}

const PROMINENCE_TO_LEG: Record<string, number> = { primary: 92, secondary: 78, background: 60 };
const ATTENTION_TO_LEG: Record<string, number> = { high: 90, medium: 75, low: 55 };
const CTX_LABEL: Record<string, string> = {
  ad_placement: 'AD',
  in_game_placement: 'IN-GAME',
};
const CTX_COLOR: Record<string, string> = {
  ad_placement: '#f59e0b',
  in_game_placement: '#22c55e',
};

const hhmmss = (s: number) => {
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

const qualityColor = (v: number) => {
  if (v >= 80) return '#22c55e';
  if (v >= 70) return '#a3e635';
  if (v >= 60) return '#f59e0b';
  return '#ef4444';
};

const confColor = (c: string) =>
  c === 'high' ? '#22c55e' : c === 'medium' ? '#f59e0b' : '#ef4444';

const titleCase = (s: string) =>
  s.split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');

const SponsorshipIntelTab: React.FC<SponsorshipIntelTabProps> = ({ analysisData, isMultiVideo }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [filterCtx, setFilterCtx] = useState<'all' | 'in-game' | 'ad' | 'flagged'>('all');
  const [filterSponsor, setFilterSponsor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof Impression>('start');
  const [sortAsc, setSortAsc] = useState(true);

  // ──────────────────────────────────────────────────────────────────
  // Data shaping
  // ──────────────────────────────────────────────────────────────────

  const primaryVideoId: string = useMemo(() => {
    const single = analysisData as AnalysisResponse;
    if (single.video_id) return single.video_id;
    const multi = analysisData as MultiVideoAnalysisResponse;
    return multi.individual_analyses?.[0]?.video_id || multi.video_ids?.[0] || '';
  }, [analysisData]);

  const totalDuration: number = useMemo(() => {
    const single = analysisData as AnalysisResponse;
    if ('summary' in analysisData && analysisData.summary?.video_duration_minutes) {
      return analysisData.summary.video_duration_minutes * 60;
    }
    const multi = analysisData as MultiVideoAnalysisResponse;
    if (multi.combined_summary?.combined_duration_minutes) {
      return multi.combined_summary.combined_duration_minutes * 60;
    }
    // Fall back to the latest appearance end time
    const all: BrandAppearance[] = (analysisData as any).raw_detections || [];
    const maxEnd = all.reduce((m, a) => Math.max(m, a.timeline?.[1] || 0), 0);
    return maxEnd || 60;
  }, [analysisData]);

  const impressions: Impression[] = useMemo(() => {
    const raw: BrandAppearance[] = (analysisData as any).raw_detections || [];
    return raw
      .filter(a => a.timeline && a.timeline.length === 2 && a.timeline[1] > a.timeline[0])
      .map((a, i) => {
        const start = a.timeline[0];
        const end = a.timeline[1];
        const cat = a.sponsorship_category || 'in_game_placement';
        // Legibility heuristic — Marengo carries `marengo_confidence` per appearance
        // (string 'high'/'medium'/'low'). Fall back to prominence / viewer_attention.
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
          ctxColor: CTX_COLOR[cat] || '#6b7280',
          isInGame: cat === 'in_game_placement',
          prominence: a.prominence,
          legibility,
          confidence,
          flagged,
          flagReason: flagged
            ? 'Low legibility — likely a small or peripheral placement; consider close-up exposure'
            : null,
          videoId: (a as any).video_id || primaryVideoId,
        };
      });
  }, [analysisData, primaryVideoId]);

  // ──────────────────────────────────────────────────────────────────
  // Video URL fetch + HLS bootstrap
  // ──────────────────────────────────────────────────────────────────

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
    v.addEventListener('timeupdate', onTime);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl]);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    v.play().catch(() => undefined);
  };

  // ──────────────────────────────────────────────────────────────────
  // KPIs
  // ──────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const n = impressions.length;
    const totalSec = impressions.reduce((a, b) => a + b.duration, 0);
    const uniq = new Set(impressions.map(i => i.sponsor)).size;
    const avgLeg = n > 0 ? Math.round(impressions.reduce((a, b) => a + b.legibility, 0) / n) : 0;
    const adPct = n > 0 ? Math.round((impressions.filter(i => !i.isInGame).length / n) * 100) : 0;
    const flagged = new Set(impressions.filter(i => i.flagged).map(i => i.sponsor)).size;
    return { n, totalSec, uniq, avgLeg, adPct, flagged };
  }, [impressions]);

  // ──────────────────────────────────────────────────────────────────
  // Filtering + sorting
  // ──────────────────────────────────────────────────────────────────

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
      if (typeof av === 'string') {
        av = av.toLowerCase();
        bv = bv.toLowerCase();
      }
      return sortAsc ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
    return d;
  }, [impressions, filterCtx, filterSponsor, search, sortKey, sortAsc]);

  // ──────────────────────────────────────────────────────────────────
  // Per-sponsor aggregates for cards + tracks
  // ──────────────────────────────────────────────────────────────────

  const sponsorAggs = useMemo(() => {
    const m: Record<string, {
      sponsor: string;
      count: number;
      totalDur: number;
      inGame: number;
      avgLeg: number;
      topContext: string;
      placements: Set<string>;
    }> = {};
    impressions.forEach(i => {
      if (!m[i.sponsor]) {
        m[i.sponsor] = {
          sponsor: i.sponsor,
          count: 0,
          totalDur: 0,
          inGame: 0,
          avgLeg: 0,
          topContext: '',
          placements: new Set(),
        };
      }
      const agg = m[i.sponsor];
      agg.count++;
      agg.totalDur += i.duration;
      if (i.isInGame) agg.inGame++;
      agg.avgLeg += i.legibility;
      agg.placements.add(i.location);
    });
    return Object.values(m).map(a => ({
      ...a,
      avgLeg: a.count > 0 ? Math.round(a.avgLeg / a.count) : 0,
      inGamePct: a.count > 0 ? Math.round((a.inGame / a.count) * 100) : 0,
      topPlacement: a.placements.size > 0 ? Array.from(a.placements)[0] : 'Unknown',
    })).sort((a, b) => b.totalDur - a.totalDur);
  }, [impressions]);

  // ──────────────────────────────────────────────────────────────────
  // Live feed at playhead
  // ──────────────────────────────────────────────────────────────────

  const liveImpressions = useMemo(
    () => impressions.filter(i => currentTime >= i.start && currentTime < i.end),
    [impressions, currentTime],
  );

  // ──────────────────────────────────────────────────────────────────
  // CSV export
  // ──────────────────────────────────────────────────────────────────

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
      setSortAsc(true);
    }
  };

  // ──────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg overflow-hidden border" style={{ background: '#070b16', color: '#e2e8f5' }}>
      {/* HEADER + KPIs */}
      <div className="flex items-start justify-between flex-wrap gap-3 px-5 py-3" style={{ background: '#0e1422', borderBottom: '1px solid #26334d' }}>
        <div>
          <div className="text-base font-bold tracking-tight">Sponsorship Intelligence</div>
          <div className="text-[10px] mt-0.5" style={{ color: '#5c6f92' }}>
            {isMultiVideo ? 'Multi-video composite' : 'Single video analysis'}
            {' · '}
            Duration {hhmmss(totalDuration)}
            {' · '}
            Powered by TwelveLabs Marengo
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { v: kpis.n, l: 'Impressions' },
            { v: `${kpis.totalSec.toFixed(0)}s`, l: 'Sponsor-Seconds' },
            { v: kpis.uniq, l: 'Sponsors' },
            { v: kpis.avgLeg, l: 'Avg Legibility' },
            { v: `${kpis.adPct}%`, l: 'Ad-Placement %' },
            { v: kpis.flagged, l: 'Flagged' },
          ].map(k => (
            <div key={k.l} className="rounded-md px-3 py-1 text-center" style={{ background: '#161d2e', border: '1px solid #26334d' }}>
              <span className="block text-[17px] font-bold leading-tight" style={{ color: k.l === 'Flagged' && kpis.flagged > 0 ? '#ef4444' : '#4da3ff' }}>{k.v}</span>
              <span className="text-[9px] uppercase tracking-wider" style={{ color: '#5c6f92' }}>{k.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PLAYER + LIVE FEED */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 260px' }}>
        <div className="relative" style={{ background: '#000', minHeight: 220 }}>
          {videoError ? (
            <div className="flex items-center justify-center h-full text-sm gap-2" style={{ color: '#5c6f92' }}>
              <AlertCircle className="w-4 h-4" /> {videoError}
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              controls
              className="w-full h-full block"
              style={{ height: 220, objectFit: 'contain', background: '#000' }}
            />
          )}
        </div>
        <div className="flex flex-col" style={{ background: '#0e1422', borderLeft: '1px solid #26334d', height: 220 }}>
          <div className="flex justify-between items-center px-3 py-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#5c6f92', borderBottom: '1px solid #26334d' }}>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Live Sponsor Feed</span>
            <span className="text-[10px]" style={{ color: '#e2e8f5' }}>{hhmmss(currentTime)}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5">
            {liveImpressions.length === 0 ? (
              <div className="px-2 py-3 text-[10px]" style={{ color: '#5c6f92' }}>
                {videoUrl ? 'No tracked brands at this moment' : 'Loading video…'}
              </div>
            ) : (
              liveImpressions.map(i => {
                const c = qualityColor(i.legibility);
                return (
                  <div
                    key={i.id}
                    onClick={() => seek(i.start)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded mb-0.5 cursor-pointer hover:opacity-90"
                    style={{ background: 'rgba(22,29,46,0.5)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[11px] truncate">{i.sponsor}</div>
                      <div className="text-[9px]" style={{ color: '#5c6f92' }}>{i.location}</div>
                    </div>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold border-2 flex-shrink-0"
                      style={{ color: c, borderColor: c }}
                    >{i.legibility}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* PER-SPONSOR TIMELINE TRACKS */}
      <div className="px-5 py-3" style={{ background: '#070b16', borderBottom: '1px solid #26334d' }}>
        <div className="flex justify-between items-center mb-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: '#5c6f92' }}>
          <span>Sponsor Impression Tracks — click any segment to jump</span>
          <span className="text-[9px]" style={{ color: '#5c6f92' }}>
            <span style={{ color: '#22c55e' }}>▬ IN-GAME</span>{' '}
            <span style={{ color: '#f59e0b' }}>▬ AD</span>
          </span>
        </div>
        <div className="space-y-1">
          {sponsorAggs.map(agg => {
            const tracks = impressions.filter(i => i.sponsor === agg.sponsor);
            return (
              <div key={agg.sponsor} className="flex items-center" style={{ height: 22 }}>
                <div
                  className="text-[9px] truncate pr-2"
                  style={{ width: 150, flexShrink: 0, color: filterSponsor === agg.sponsor ? '#4da3ff' : '#a3aec5' }}
                >
                  <button
                    onClick={() => setFilterSponsor(filterSponsor === agg.sponsor ? null : agg.sponsor)}
                    className="text-left w-full truncate hover:underline"
                    title={`Click to filter on ${agg.sponsor}`}
                  >{agg.sponsor}</button>
                </div>
                <div
                  className="flex-1 relative rounded cursor-pointer"
                  style={{ height: 14, background: '#161d2e' }}
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
                        className="absolute top-px h-3 rounded-sm cursor-pointer hover:brightness-125"
                        style={{ left: `${x}%`, width: `${w}%`, background: t.ctxColor, minWidth: 2 }}
                        title={`${t.sponsor} · ${hhmmss(t.start)}–${hhmmss(t.end)} · ${t.ctx}`}
                      />
                    );
                  })}
                  {/* Playhead */}
                  <div
                    className="absolute top-0 w-px h-full pointer-events-none"
                    style={{
                      left: `${(currentTime / totalDuration) * 100}%`,
                      background: 'rgba(255,255,255,0.6)',
                      zIndex: 5,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {sponsorAggs.length === 0 && (
            <div className="text-[10px] py-5 text-center" style={{ color: '#5c6f92' }}>No tracked impressions yet.</div>
          )}
        </div>
      </div>

      {/* CONTROL BAR */}
      <div className="flex items-center gap-2 px-5 py-2 flex-wrap" style={{ background: '#0e1422', borderBottom: '1px solid #26334d' }}>
        <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#5c6f92' }}>Context:</span>
        {([
          { key: 'all', label: 'All' },
          { key: 'in-game', label: 'In-Game' },
          { key: 'ad', label: 'Ad' },
        ] as const).map(b => (
          <button
            key={b.key}
            onClick={() => setFilterCtx(b.key)}
            className="px-2.5 py-0.5 rounded-full text-[10px] border transition-colors"
            style={
              filterCtx === b.key
                ? { borderColor: '#4da3ff', background: 'rgba(77,163,255,0.12)', color: '#4da3ff' }
                : { borderColor: '#26334d', background: 'transparent', color: '#5c6f92' }
            }
          >{b.label}</button>
        ))}
        <div className="w-px h-3.5" style={{ background: '#26334d' }} />
        <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: '#5c6f92' }}>Quality:</span>
        <button
          onClick={() => setFilterCtx('flagged')}
          className="px-2.5 py-0.5 rounded-full text-[10px] border"
          style={
            filterCtx === 'flagged'
              ? { borderColor: '#ef4444', background: 'rgba(239,68,68,0.12)', color: '#ef4444' }
              : { borderColor: '#26334d', background: 'transparent', color: '#5c6f92' }
          }
        >⚠ Flagged Only</button>
        <div className="flex items-center gap-1 ml-auto">
          <Search className="w-3 h-3" style={{ color: '#5c6f92' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sponsor or placement…"
            className="px-2 py-1 rounded text-[10px] outline-none"
            style={{ background: '#161d2e', border: '1px solid #26334d', color: '#e2e8f5', width: 180 }}
          />
          <button
            onClick={exportCsv}
            className="px-2 py-1 rounded text-[10px] border flex items-center gap-1 hover:opacity-90"
            style={{ borderColor: '#26334d', background: 'transparent', color: '#5c6f92' }}
          ><Download className="w-3 h-3" /> CSV</button>
        </div>
      </div>

      {/* SPONSOR CARDS */}
      <div className="flex gap-2 overflow-x-auto px-5 py-2.5" style={{ background: '#0e1422', borderBottom: '1px solid #26334d' }}>
        {sponsorAggs.map(agg => {
          const c = qualityColor(agg.avgLeg);
          const isActive = filterSponsor === agg.sponsor;
          return (
            <div
              key={agg.sponsor}
              onClick={() => setFilterSponsor(isActive ? null : agg.sponsor)}
              className="rounded-lg px-3 py-2 min-w-[180px] flex-shrink-0 cursor-pointer transition-colors"
              style={{
                background: '#161d2e',
                border: `1px solid ${isActive ? '#4da3ff' : '#26334d'}`,
              }}
            >
              <div className="font-bold text-[11px] truncate" title={agg.sponsor}>{agg.sponsor}</div>
              <div className="text-[9px] mb-1.5" style={{ color: '#5c6f92' }}>{agg.topPlacement}</div>
              <div className="flex gap-2 mb-1.5">
                <div>
                  <div className="text-[14px] font-bold leading-none">{agg.count}</div>
                  <div className="text-[8px] uppercase tracking-wider" style={{ color: '#5c6f92' }}>Imps</div>
                </div>
                <div>
                  <div className="text-[14px] font-bold leading-none">{fmtDur(agg.totalDur)}</div>
                  <div className="text-[8px] uppercase tracking-wider" style={{ color: '#5c6f92' }}>On-Screen</div>
                </div>
                <div>
                  <div className="text-[14px] font-bold leading-none">{agg.inGamePct}%</div>
                  <div className="text-[8px] uppercase tracking-wider" style={{ color: '#5c6f92' }}>In-Game</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 rounded overflow-hidden" style={{ background: '#1e2840' }}>
                  <div className="h-full" style={{ width: `${agg.avgLeg}%`, background: c }} />
                </div>
                <span className="text-[9px] font-bold" style={{ color: c }}>{agg.avgLeg}</span>
              </div>
            </div>
          );
        })}
        {sponsorAggs.length === 0 && (
          <div className="text-[10px] py-3" style={{ color: '#5c6f92' }}>No sponsor data.</div>
        )}
      </div>

      {/* DETAILED TABLE */}
      <div className="px-5 py-3" style={{ background: '#070b16' }}>
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
                { k: 'confidence', l: 'Confidence' },
              ] as const).map(({ k, l }) => (
                <th
                  key={k}
                  onClick={() => doSort(k as keyof Impression)}
                  className="text-[9px] uppercase tracking-wider font-bold px-2 py-1.5 cursor-pointer select-none whitespace-nowrap"
                  style={{ color: sortKey === k ? '#4da3ff' : '#5c6f92', borderBottom: '1px solid #26334d' }}
                >{l} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}</th>
              ))}
              <th className="text-[9px] uppercase tracking-wider font-bold px-2 py-1.5" style={{ color: '#5c6f92', borderBottom: '1px solid #26334d' }}>Flag</th>
              <th style={{ borderBottom: '1px solid #26334d' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-7 text-[10px]" style={{ color: '#5c6f92' }}>No impressions match this filter.</td></tr>
            ) : (
              filtered.map(i => {
                const inWindow = currentTime >= i.start && currentTime < i.end;
                return (
                  <tr
                    key={i.id}
                    onClick={() => seek(i.start)}
                    className="cursor-pointer hover:opacity-95"
                    style={{
                      background: inWindow ? 'rgba(77,163,255,0.08)' : !i.isInGame ? 'rgba(249,115,22,0.02)' : 'transparent',
                    }}
                  >
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}><strong>{i.sponsor}</strong></td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ color: '#5c6f92', borderBottom: '1px solid rgba(38,51,77,0.4)' }}>{i.location}</td>
                    <td className="px-2 py-1.5 text-[10px] font-mono" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>{hhmmss(i.start)}</td>
                    <td className="px-2 py-1.5 text-[10px] font-mono" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>{hhmmss(i.end)}</td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>{fmtDur(i.duration)}</td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>
                      <span className="inline-flex items-center px-1.5 py-px rounded-full text-[8px] font-bold" style={{ background: `${i.ctxColor}1a`, color: i.ctxColor, border: `1px solid ${i.ctxColor}33` }}>{i.ctx}</span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>
                      <span style={{ color: qualityColor(i.legibility), fontWeight: 700 }}>{i.legibility}</span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ background: confColor(i.confidence) }} />
                      <span style={{ textTransform: 'uppercase' }}>{i.confidence}</span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>
                      {i.flagged ? (
                        <span title={i.flagReason || 'Flagged'} style={{ color: '#f97316' }}>⚠</span>
                      ) : <span style={{ color: '#5c6f92' }}>—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-[10px]" style={{ borderBottom: '1px solid rgba(38,51,77,0.4)' }}>
                      <button
                        onClick={e => { e.stopPropagation(); seek(i.start); }}
                        className="px-2 py-0.5 rounded text-[9px] border inline-flex items-center gap-1"
                        style={{ borderColor: '#26334d', background: 'transparent', color: '#4da3ff' }}
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
  );
};

export default SponsorshipIntelTab;

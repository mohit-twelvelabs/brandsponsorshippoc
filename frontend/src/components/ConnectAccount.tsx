import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, Zap, Search, Download } from 'lucide-react';
import ApiService from '../services/api';
import { useAccounts } from '../lib/AccountContext';
import { generateAccountId } from '../lib/accountStorage';
import { TLAccount, TLIndex } from '../types';

interface ConnectAccountProps {
  onConnected: () => void;
}

const ConnectAccount: React.FC<ConnectAccountProps> = ({ onConnected }) => {
  const { accounts, addAccount, removeAccount, setActive } = useAccounts();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [indexes, setIndexes] = useState<TLIndex[] | null>(null);
  const [pickedIndexId, setPickedIndexId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  const [hasDefault, setHasDefault] = useState(false);

  useEffect(() => {
    ApiService.getHealth()
      .then(h => setHasDefault(!!h.has_default_account))
      .catch(() => setHasDefault(false));
  }, []);

  const pickedIndex = useMemo(
    () => indexes?.find(i => i.id === pickedIndexId) || null,
    [indexes, pickedIndexId],
  );

  useEffect(() => {
    if (pickedIndex && !nickname) {
      setNickname(pickedIndex.name);
    }
  }, [pickedIndex, nickname]);

  const handleConnect = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      setError('Paste your TwelveLabs API key first.');
      return;
    }
    setValidating(true);
    setError(null);
    try {
      const { indexes: raw } = await ApiService.listIndexes(trimmed);
      const mapped: TLIndex[] = raw.map(i => ({
        id: i.id,
        name: i.name || '(unnamed index)',
        videoCount: i.video_count ?? 0,
        models: i.models ?? [],
        supportsAnalyze: i.supports_analyze ?? false,
      }));
      if (mapped.length === 0) {
        setError('This account has no indexes. Create one at twelvelabs.io first.');
      } else {
        setIndexes(mapped);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMsg = err?.response?.data?.error;
      if (status === 401) {
        setError('Invalid API key. Check the tlk_ prefix and try again.');
      } else if (apiMsg) {
        setError(apiMsg);
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
      setIndexes(null);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = () => {
    if (!pickedIndex) return;
    const account: TLAccount = {
      id: generateAccountId(),
      nickname: nickname.trim() || pickedIndex.name,
      apiKey: apiKeyInput.trim(),
      indexId: pickedIndex.id,
      indexName: pickedIndex.name,
      createdAt: new Date().toISOString(),
    };
    addAccount(account);
    setActive(account.id);
    onConnected();
  };

  const handleUseDefault = () => {
    setActive(null);
    onConnected();
  };

  const handleSwitchTo = (accountId: string) => {
    setActive(accountId);
    onConnected();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Masterbrand stripe */}
      <div className="h-1 w-full rounded-full bg-gradient-to-r from-mb-green via-mb-orange to-mb-pink" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16 w-full">
        {/* Eyebrow + Hero */}
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-3">
            STEP 1 · CONNECT
          </p>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight leading-[1.05] mb-4">
            <span className="bg-gradient-to-r from-mb-green via-mb-orange to-mb-pink bg-clip-text text-transparent">
              Bring your TwelveLabs account.
            </span>
          </h1>
          <p className="text-base lg:text-lg text-text-secondary max-w-2xl">
            Connect your API key and pick the index you want to analyze. Your credentials stay in this browser.
          </p>
        </div>

        {/* Saved accounts */}
        {accounts.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary mb-3">
              Saved accounts
            </p>
            <div className="space-y-2">
              {accounts.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.nickname}</p>
                    <p className="text-xs text-text-secondary">{a.indexName}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSwitchTo(a.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium border border-border"
                    >
                      <RotateCcw className="w-3 h-3" /> Switch
                    </button>
                    <button
                      onClick={() => removeAccount(a.id)}
                      aria-label="Remove account"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-text-secondary hover:text-foreground hover:bg-card transition-colors text-sm font-medium border border-border"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 1: API key entry */}
        {!indexes && (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
            {/* Left: Form */}
            <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md space-y-6">
              <div>
                <label
                  htmlFor="api-key-input"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  TwelveLabs API key
                </label>
                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="tlk_..."
                    disabled={validating}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-mb-green-dark focus:ring-2 focus:ring-mb-green/30 transition pr-12 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    disabled={validating}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                    aria-pressed={showKey}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-text-tertiary hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && (
                  <p className="mt-2 text-sm text-error">{error}</p>
                )}
              </div>

              <button
                onClick={handleConnect}
                disabled={validating || !apiKeyInput.trim()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-mb-green text-brand-charcoal font-semibold hover:bg-mb-green-dark hover:text-brand-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
              >
                {validating ? 'Connecting…' : 'Connect'}
              </button>

              {hasDefault && accounts.length === 0 && (
                <div className="pt-2 border-t border-border-light text-center">
                  <button
                    onClick={handleUseDefault}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-transparent border border-border text-foreground font-semibold hover:bg-card transition-colors"
                  >
                    Use default demo account
                  </button>
                  <p className="mt-2 text-xs text-text-secondary">
                    Or try with our sample sponsorship index — read-only.
                  </p>
                </div>
              )}
            </div>

            {/* Right: Value prop */}
            <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 space-y-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                Why connect?
              </p>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mb-green-light flex items-center justify-center">
                    <Zap className="w-4 h-4 text-mb-green-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Real-time brand detection</p>
                    <p className="text-sm text-text-secondary">
                      Marengo embeds find every mention, including unbranded scenes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mb-green-light flex items-center justify-center">
                    <Search className="w-4 h-4 text-mb-green-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Insights in minutes</p>
                    <p className="text-sm text-text-secondary">
                      Bring your own index. No re-ingest, no waiting.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mb-green-light flex items-center justify-center">
                    <Download className="w-4 h-4 text-mb-green-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Export-ready</p>
                    <p className="text-sm text-text-secondary">
                      CSV + dashboards your customers can act on tomorrow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Index picker */}
        {indexes && (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-start">
            {/* Left: Index list + nickname */}
            <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-md space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-mb-green-dark mb-1">
                  STEP 2 · PICK AN INDEX
                </p>
                <p className="text-sm text-text-secondary">
                  Brand detection runs on Marengo search. Any index with a Marengo model (2.7, 3.0, …) works.
                </p>
              </div>

              <div className="space-y-3">
                {indexes.map(i => {
                  const disabled = !i.supportsAnalyze;
                  const isSelected = pickedIndexId === i.id;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setPickedIndexId(i.id)}
                      className={[
                        'w-full text-left rounded-xl border p-4 transition-all',
                        disabled
                          ? 'opacity-50 cursor-not-allowed border-border bg-card'
                          : isSelected
                          ? 'border-2 border-mb-green bg-mb-green-light/40'
                          : 'border-border bg-card hover:border-mb-green-dark cursor-pointer',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-semibold ${isSelected ? 'text-brand-charcoal' : 'text-foreground'}`}>
                            {i.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {i.models.length > 0 ? (
                              i.models.map((m, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-card text-foreground text-xs font-medium"
                                >
                                  {m}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-text-tertiary">no models reported</span>
                            )}
                          </div>
                          {disabled && (
                            <p className="mt-1.5 text-xs text-error">
                              Marengo not enabled — analysis requires Marengo embeddings.
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary ml-4 flex-shrink-0">
                          {i.videoCount} videos
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div>
                <label
                  htmlFor="nickname-input"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Nickname
                </label>
                <input
                  id="nickname-input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Prospect A"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-mb-green-dark focus:ring-2 focus:ring-mb-green/30 transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIndexes(null);
                    setPickedIndexId(null);
                    setNickname('');
                    setError(null);
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-transparent border border-border text-foreground font-semibold hover:bg-card transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!pickedIndexId}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-mb-green text-brand-charcoal font-semibold hover:bg-mb-green-dark hover:text-brand-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
                >
                  Save & Continue
                </button>
              </div>
            </div>

            {/* Right: Value prop (same as phase 1) */}
            <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 space-y-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-secondary">
                Why connect?
              </p>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mb-green-light flex items-center justify-center">
                    <Zap className="w-4 h-4 text-mb-green-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Real-time brand detection</p>
                    <p className="text-sm text-text-secondary">
                      Marengo embeds find every mention, including unbranded scenes.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mb-green-light flex items-center justify-center">
                    <Search className="w-4 h-4 text-mb-green-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Insights in minutes</p>
                    <p className="text-sm text-text-secondary">
                      Bring your own index. No re-ingest, no waiting.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mb-green-light flex items-center justify-center">
                    <Download className="w-4 h-4 text-mb-green-dark" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">Export-ready</p>
                    <p className="text-sm text-text-secondary">
                      CSV + dashboards your customers can act on tomorrow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectAccount;

import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Plug, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Text } from './ui/Text';
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
    <Card className="w-full p-6">
      <Card.Header className="p-0 mb-6">
        <Card.Title className="flex items-center">
          <Plug className="w-6 h-6 mr-2" />
          Connect TwelveLabs Account
        </Card.Title>
        <Text as="p" className="text-black mt-2">
          Paste an API key from your TwelveLabs dashboard, pick an index, and we'll remember it for this browser.
        </Text>
      </Card.Header>

      {accounts.length > 0 && (
        <div className="mb-6">
          <Text as="h3" className="text-sm font-medium mb-2">Saved accounts</Text>
          <div className="space-y-2">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Text as="p" className="font-medium">{a.nickname}</Text>
                  <Text as="p" className="text-xs text-black/70">{a.indexName}</Text>
                </div>
                <div className="flex space-x-2">
                  <Button variant="secondary" size="sm" onClick={() => handleSwitchTo(a.id)}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Switch
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => removeAccount(a.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!indexes && (
        <>
          <div className="mb-3">
            <label className="text-sm font-medium block mb-1">TwelveLabs API key</label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="tlk_..."
                disabled={validating}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 h-6 w-6"
                type="button"
              >
                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {error && (
            <Text as="p" className="text-sm text-red-600 mb-3">{error}</Text>
          )}

          <div className="flex items-center justify-between">
            <Button onClick={handleConnect} disabled={validating}>
              {validating ? 'Connecting…' : 'Connect'}
            </Button>
            {hasDefault && accounts.length === 0 && (
              <Button variant="secondary" onClick={handleUseDefault}>
                Use default demo account
              </Button>
            )}
          </div>
        </>
      )}

      {indexes && (
        <>
          <Text as="h3" className="text-sm font-medium mb-2">Pick an index</Text>
          <div className="space-y-2 mb-4">
            {indexes.map(i => (
              <label
                key={i.id}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                  pickedIndexId === i.id ? 'border-orange-500 bg-orange-50' : ''
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="tl-index"
                    className="mr-3"
                    checked={pickedIndexId === i.id}
                    onChange={() => setPickedIndexId(i.id)}
                  />
                  <Text as="p" className="font-medium">{i.name}</Text>
                </div>
                <Text as="p" className="text-xs text-black/70">{i.videoCount} videos</Text>
              </label>
            ))}
          </div>

          <div className="mb-3">
            <label className="text-sm font-medium block mb-1">Nickname (so you can find it later)</label>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Prospect A"
            />
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setIndexes(null); setPickedIndexId(null); }}>
              Back
            </Button>
            <Button onClick={handleSave} disabled={!pickedIndexId}>
              Save & Continue
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default ConnectAccount;

// Stores TwelveLabs API keys + index selections in browser localStorage.
// Demo posture: keys are visible to anything with DOM access on this origin.
// Don't reuse this pattern for production multi-tenant code.
import { TLAccount } from '../types';

const ACCOUNTS_KEY = 'tl-brc-accounts';
const ACTIVE_KEY = 'tl-brc-active-account';
const RECENT_BRANDS_PREFIX = 'tl-brc-recent-brands:';

function readAccountsRaw(): TLAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listAccounts(): TLAccount[] {
  return readAccountsRaw();
}

export function saveAccount(account: TLAccount): void {
  const accounts = readAccountsRaw().filter(a => a.id !== account.id);
  accounts.push(account);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function removeAccount(id: string): void {
  const accounts = readAccountsRaw().filter(a => a.id !== id);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  if (getActiveAccountId() === id) {
    setActiveAccountId(null);
  }
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveAccountId(id: string | null): void {
  if (id === null) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    localStorage.setItem(ACTIVE_KEY, id);
  }
}

export function getActiveAccount(): TLAccount | null {
  const id = getActiveAccountId();
  if (!id) return null;
  return readAccountsRaw().find(a => a.id === id) || null;
}

export function getRecentBrands(accountId: string | null): string[] {
  if (!accountId) return [];
  try {
    const raw = localStorage.getItem(RECENT_BRANDS_PREFIX + accountId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(b => typeof b === 'string') : [];
  } catch {
    return [];
  }
}

export function setRecentBrands(accountId: string | null, brands: string[]): void {
  if (!accountId) return;
  localStorage.setItem(RECENT_BRANDS_PREFIX + accountId, JSON.stringify(brands));
}

export function generateAccountId(): string {
  // crypto.randomUUID is available in all modern browsers we target
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto & { randomUUID: () => string }).randomUUID();
  }
  return 'acc-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

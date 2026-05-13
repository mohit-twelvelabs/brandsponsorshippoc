import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { TLAccount } from '../types';
import {
  getActiveAccount,
  listAccounts,
  removeAccount as storageRemove,
  saveAccount as storageSave,
  setActiveAccountId as storageSetActive,
} from './accountStorage';

interface AccountContextValue {
  accounts: TLAccount[];
  activeAccount: TLAccount | null;
  refresh: () => void;
  addAccount: (a: TLAccount) => void;
  removeAccount: (id: string) => void;
  setActive: (id: string | null) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accounts, setAccounts] = useState<TLAccount[]>(() => listAccounts());
  const [activeAccount, setActiveAccount] = useState<TLAccount | null>(() => getActiveAccount());

  const refresh = useCallback(() => {
    setAccounts(listAccounts());
    setActiveAccount(getActiveAccount());
  }, []);

  const addAccount = useCallback((a: TLAccount) => {
    storageSave(a);
    refresh();
  }, [refresh]);

  const removeAccount = useCallback((id: string) => {
    storageRemove(id);
    refresh();
  }, [refresh]);

  const setActive = useCallback((id: string | null) => {
    storageSetActive(id);
    refresh();
  }, [refresh]);

  // The api.ts response interceptor dispatches this event on 401.
  useEffect(() => {
    const handler = () => {
      storageSetActive(null);
      refresh();
    };
    window.addEventListener('tl-auth-required', handler);
    return () => window.removeEventListener('tl-auth-required', handler);
  }, [refresh]);

  const value = useMemo(
    () => ({ accounts, activeAccount, refresh, addAccount, removeAccount, setActive }),
    [accounts, activeAccount, refresh, addAccount, removeAccount, setActive],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export function useAccounts(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccounts must be used inside <AccountProvider>');
  return ctx;
}

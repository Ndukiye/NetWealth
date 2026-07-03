'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, Landmark } from 'lucide-react';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import { AccountIcon } from '@/components/account-icon';
import { api, ApiError } from '@/lib/api';
import { ACCOUNT_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/format';
import { Account, AccountType, Institution } from '@/lib/types';

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[];

function AccountsContent() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [showManualForm, setShowManualForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('CASH');
  const [balance, setBalance] = useState('');

  async function loadAccounts() {
    const data = await api.get<Account[]>('/accounts');
    setAccounts(data);
  }

  useEffect(() => {
    Promise.all([loadAccounts(), api.get<Institution[]>('/bank/institutions').then(setInstitutions)])
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function connectBank(institutionId: string) {
    setConnecting(true);
    setError('');
    try {
      await api.post('/bank/connect', { institutionId });
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to connect bank');
    } finally {
      setConnecting(false);
    }
  }

  async function syncAccount(id: string) {
    setSyncingId(id);
    try {
      await api.post(`/bank/accounts/${id}/sync`);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  }

  async function addManualAccount(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/accounts', { name, type, balance: Number(balance) });
      setName('');
      setBalance('');
      setShowManualForm(false);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add account');
    }
  }

  async function removeAccount(id: string) {
    await api.delete(`/accounts/${id}`);
    await loadAccounts();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounts"
        subtitle="Bank connections and manually tracked assets & liabilities"
        action={
          <Button variant="secondary" onClick={() => setShowManualForm((s) => !s)}>
            <Plus size={15} />
            {showManualForm ? 'Cancel' : 'Add manual account'}
          </Button>
        }
      />

      <ErrorText>{error}</ErrorText>

      {showManualForm && (
        <Card>
          <form onSubmit={addManualAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ACCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Balance (NGN)">
              <Input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
              />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit">Save account</Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Landmark size={15} className="text-slate-400 dark:text-slate-500" />
          <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Connect a bank (mock provider)
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {institutions.map((inst) => (
            <Button
              key={inst.id}
              variant="secondary"
              disabled={connecting}
              onClick={() => connectBank(inst.id)}
            >
              {inst.name}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                  <AccountIcon type={account.type} />
                </span>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{account.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {ACCOUNT_TYPE_LABELS[account.type]} · {account.kind}
                  </p>
                </div>
              </div>
              <p
                className={`text-lg font-semibold ${
                  account.kind === 'LIABILITY'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {formatCurrency(account.balance, account.currency)}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              {account.provider ? (
                <span>
                  {account.lastSyncedAt
                    ? `Synced ${formatDate(account.lastSyncedAt)}`
                    : 'Not yet synced'}
                </span>
              ) : (
                <span>Manual account</span>
              )}
              <div className="flex gap-3">
                {account.provider && (
                  <button
                    onClick={() => syncAccount(account.id)}
                    disabled={syncingId === account.id}
                    className="flex items-center gap-1 text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    <RefreshCw size={12} className={syncingId === account.id ? 'animate-spin' : ''} />
                    {syncingId === account.id ? 'Syncing...' : 'Sync'}
                  </button>
                )}
                <button
                  onClick={() => removeAccount(account.id)}
                  className="flex items-center gap-1 text-red-600 hover:underline dark:text-red-400"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
            </div>
          </Card>
        ))}
        {accounts.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">
            No accounts yet. Add one or connect a bank above.
          </p>
        )}
      </div>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Protected>
      <AccountsContent />
    </Protected>
  );
}

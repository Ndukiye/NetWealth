'use client';

import { FormEvent, useState } from 'react';
import { CheckCircle2, HelpCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button, Card, Input, Select } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { AffordCheckResult, Category } from '@/lib/types';

const VERDICT_STYLE = {
  affordable: {
    icon: CheckCircle2,
    className: 'text-emerald-600 dark:text-emerald-400 border-l-emerald-500/60',
  },
  tight: {
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400 border-l-amber-500/60',
  },
  not_affordable: {
    icon: XCircle,
    className: 'text-red-600 dark:text-red-400 border-l-red-500/60',
  },
};

export function AffordCheck({ categories }: { categories: Category[] }) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [result, setResult] = useState<AffordCheckResult | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setChecking(true);
    try {
      const res = await api.post<AffordCheckResult>('/simulator/afford-check', {
        amount: Number(amount),
        categoryId: categoryId || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check affordability');
      setResult(null);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">
          Can I afford this?
        </h2>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Amount (NGN)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">No specific category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={checking}>
          {checking ? 'Checking...' : 'Check'}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div
          className={`mt-4 flex gap-3 rounded-lg border-l-2 bg-slate-50 px-3.5 py-3 dark:bg-white/[0.02] ${VERDICT_STYLE[result.verdict].className}`}
        >
          {(() => {
            const Icon = VERDICT_STYLE[result.verdict].icon;
            return <Icon size={16} className="mt-0.5 shrink-0" />;
          })()}
          <p className="text-sm text-slate-700 dark:text-slate-300">{result.message}</p>
        </div>
      )}
    </Card>
  );
}

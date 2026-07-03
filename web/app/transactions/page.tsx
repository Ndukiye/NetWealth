'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Account, Category, Transaction, TransactionType } from '@/lib/types';

function TransactionsContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [accountFilter, setAccountFilter] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10));

  async function loadTransactions(filterAccountId?: string) {
    const query = filterAccountId ? `?accountId=${filterAccountId}` : '';
    const data = await api.get<Transaction[]>(`/transactions${query}`);
    setTransactions(data);
  }

  useEffect(() => {
    Promise.all([
      loadTransactions(),
      api.get<Account[]>('/accounts').then((a) => {
        setAccounts(a);
        if (a[0]) setAccountId(a[0].id);
      }),
      api.get<Category[]>('/categories').then(setCategories),
    ])
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function onFilterChange(id: string) {
    setAccountFilter(id);
    await loadTransactions(id || undefined);
  }

  async function addTransaction(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/transactions', {
        accountId,
        description,
        amount: Number(amount),
        type,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      setDescription('');
      setAmount('');
      setShowForm(false);
      await loadTransactions(accountFilter || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add transaction');
    }
  }

  async function recategorize(id: string, categoryId: string) {
    await api.patch(`/transactions/${id}/category`, { categoryId });
    await loadTransactions(accountFilter || undefined);
  }

  async function removeTransaction(id: string) {
    await api.delete(`/transactions/${id}`);
    await loadTransactions(accountFilter || undefined);
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        subtitle="Auto-categorized from your accounts — recategorize anything that looks off"
        action={
          <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} />
            {showForm ? 'Cancel' : 'Add transaction'}
          </Button>
        }
      />

      <ErrorText>{error}</ErrorText>

      {showForm && (
        <Card>
          <form onSubmit={addTransaction} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Account">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </Field>
            <Field label="Amount (NGN)">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
                <option value="TRANSFER">Transfer</option>
              </Select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit">Save transaction</Button>
            </div>
          </form>
        </Card>
      )}

      <Field label="Filter by account">
        <Select value={accountFilter} onChange={(e) => onFilterChange(e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      <Card padding="p-0" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-white/5 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {formatDate(txn.occurredAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-900 dark:text-white">{txn.description}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={txn.categoryId ?? ''}
                      onChange={(e) => recategorize(txn.id, e.target.value)}
                      className="py-1 text-xs"
                    >
                      <option value="" disabled>
                        Uncategorized
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      txn.type === 'INCOME'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {txn.type === 'EXPENSE' ? '-' : '+'}
                    {formatCurrency(txn.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeTransaction(txn.id)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      <Trash2 size={12} />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-400 dark:text-slate-500"
                  >
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Protected>
      <TransactionsContent />
    </Protected>
  );
}

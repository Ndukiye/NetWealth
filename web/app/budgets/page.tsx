'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Field, Input, PageHeader, ProgressBar, Select, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Budget, Category } from '@/lib/types';

const now = new Date();

function BudgetsContent() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [limit, setLimit] = useState('');

  async function loadBudgets() {
    const data = await api.get<Budget[]>(
      `/budgets?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
    );
    setBudgets(data);
  }

  useEffect(() => {
    Promise.all([
      loadBudgets(),
      api.get<Category[]>('/categories').then((c) => {
        setCategories(c);
        if (c[0]) setCategoryId(c[0].id);
      }),
    ])
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function addBudget(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/budgets', {
        categoryId,
        limit: Number(limit),
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
      setLimit('');
      setShowForm(false);
      await loadBudgets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add budget');
    }
  }

  async function removeBudget(id: string) {
    await api.delete(`/budgets/${id}`);
    await loadBudgets();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-56" />
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
        title={`Budgets — ${now.toLocaleString('en-NG', { month: 'long', year: 'numeric' })}`}
        subtitle="Monthly spend limits per category, tracked against your transactions"
        action={
          <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} />
            {showForm ? 'Cancel' : 'Add budget'}
          </Button>
        }
      />

      <ErrorText>{error}</ErrorText>

      {showForm && (
        <Card>
          <form onSubmit={addBudget} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Category">
              <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Monthly limit (NGN)">
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                required
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Save budget</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {budgets.map((budget) => {
          const pct = (budget.spent / Number(budget.limit)) * 100;
          const over = budget.spent > Number(budget.limit);
          return (
            <Card key={budget.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900 dark:text-white">
                  {budget.category.name}
                </p>
                <button
                  onClick={() => removeBudget(budget.id)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
              <div className="mt-3">
                <ProgressBar pct={pct} tone={over ? 'red' : 'emerald'} />
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{formatCurrency(budget.spent)} spent</span>
                <span>{formatCurrency(budget.limit)} limit</span>
              </div>
            </Card>
          );
        })}
        {budgets.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">No budgets set for this month yet.</p>
        )}
      </div>
    </div>
  );
}

export default function BudgetsPage() {
  return (
    <Protected>
      <BudgetsContent />
    </Protected>
  );
}

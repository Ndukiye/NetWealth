'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Field, Input, PageHeader, ProgressBar, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { Goal } from '@/lib/types';

function GoalsContent() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  async function loadGoals() {
    const data = await api.get<Goal[]>('/goals');
    setGoals(data);
  }

  useEffect(() => {
    loadGoals()
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function addGoal(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/goals', {
        name,
        targetAmount: Number(targetAmount),
        targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
      });
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setShowForm(false);
      await loadGoals();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add goal');
    }
  }

  async function removeGoal(id: string) {
    await api.delete(`/goals/${id}`);
    await loadGoals();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Goals"
        subtitle="Track progress toward what you're saving for"
        action={
          <Button variant="secondary" onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} />
            {showForm ? 'Cancel' : 'Add goal'}
          </Button>
        }
      />

      <ErrorText>{error}</ErrorText>

      {showForm && (
        <Card>
          <form onSubmit={addGoal} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Goal name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Target amount (NGN)">
              <Input
                type="number"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="Target date (optional)">
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit">Save goal</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {goals.map((goal) => {
          const pct = Math.min(
            100,
            (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100,
          );
          return (
            <Card key={goal.id}>
              <div className="flex items-center justify-between">
                <p className="font-medium text-slate-900 dark:text-white">{goal.name}</p>
                <button
                  onClick={() => removeGoal(goal.id)}
                  className="flex items-center gap-1 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  <Trash2 size={12} />
                  Remove
                </button>
              </div>
              <div className="mt-3">
                <ProgressBar pct={pct} />
              </div>
              <div className="mt-2 flex justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{formatCurrency(goal.currentAmount)} saved</span>
                <span>{formatCurrency(goal.targetAmount)} target</span>
              </div>
              {goal.targetDate && (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  By {formatDate(goal.targetDate)}
                </p>
              )}
            </Card>
          );
        })}
        {goals.length === 0 && (
          <p className="text-slate-500 dark:text-slate-400">No goals yet.</p>
        )}
      </div>
    </div>
  );
}

export default function GoalsPage() {
  return (
    <Protected>
      <GoalsContent />
    </Protected>
  );
}

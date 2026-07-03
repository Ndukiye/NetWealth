'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Button, Card, Field, Input, ErrorText } from '@/components/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@netwealth.app');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 flex justify-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950">
          <Wallet size={22} strokeWidth={2.5} />
        </span>
      </div>
      <Card>
        <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-white">
          Log in to NetWealth
        </h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Log in'}
          </Button>
        </form>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          No account?{' '}
          <Link href="/signup" className="text-emerald-600 hover:underline dark:text-emerald-400">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          Demo login is pre-filled: demo@netwealth.app / password123
        </p>
      </Card>
    </div>
  );
}

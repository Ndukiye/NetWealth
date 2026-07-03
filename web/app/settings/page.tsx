'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Bell, Send, RefreshCw } from 'lucide-react';
import { Protected } from '@/components/protected';
import { Button, Card, ErrorText, Field, Input, PageHeader, Skeleton } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Alert, AlertSettings } from '@/lib/types';

function SettingsContent() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAlerts() {
    const data = await api.get<Alert[]>('/alerts');
    setAlerts(data);
  }

  useEffect(() => {
    Promise.all([api.get<AlertSettings>('/alerts/settings'), loadAlerts()])
      .then(([s]) => {
        setAlertsEnabled(s.alertsEnabled);
        setTelegramChatId(s.telegramChatId ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await api.patch<AlertSettings>('/alerts/settings', {
        alertsEnabled,
        telegramChatId: telegramChatId || undefined,
      });
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setError('');
    setMessage('');
    try {
      await api.post('/alerts/test');
      setMessage('Test alert sent — check the list below.');
      await loadAlerts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send test alert');
    }
  }

  async function checkNow() {
    setError('');
    setMessage('');
    try {
      const result = await api.post<{ sent: number }>('/alerts/check');
      setMessage(
        result.sent > 0
          ? `Sent ${result.sent} new alert(s).`
          : 'No new warnings to alert on right now.',
      );
      await loadAlerts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to check for alerts');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        subtitle="Configure spending alerts sent to Telegram when something needs attention"
      />

      <ErrorText>{error}</ErrorText>
      {message && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400">
          {message}
        </p>
      )}

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Bell size={16} className="text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Spending alerts
          </h2>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Mocked for this MVP — alerts are logged and recorded below instead of actually sent.
          Swap in a real Telegram Bot API integration behind the same interface when ready (see{' '}
          <code className="text-xs">AlertChannel</code> in the backend).
        </p>
        <form onSubmit={saveSettings} className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-500 dark:border-white/10"
            />
            Enable spending alerts
          </label>
          <Field label="Telegram chat ID">
            <Input
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="e.g. 123456789"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
            <Button type="button" variant="secondary" onClick={sendTest}>
              <Send size={14} />
              Send test alert
            </Button>
            <Button type="button" variant="secondary" onClick={checkNow}>
              <RefreshCw size={14} />
              Check for alerts now
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          Recent alerts
        </h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No alerts sent yet. Try &quot;Send test alert&quot; above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg bg-slate-50 px-3.5 py-3 text-sm dark:bg-white/[0.02]"
              >
                <p className="text-slate-700 dark:text-slate-300">{a.message}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {formatDate(a.sentAt)} via {a.channel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Protected>
      <SettingsContent />
    </Protected>
  );
}

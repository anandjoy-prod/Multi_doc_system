'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';

export function DeleteConfirmDialog({
  open,
  onClose,
  userId,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  userEmail: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (!userId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Failed to delete');
        setLoading(false);
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete user?"
      description={
        userEmail
          ? `${userEmail} will lose access immediately. This cannot be undone.`
          : 'This cannot be undone.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete user'}
          </Button>
        </>
      }
    >
      {error ? (
        <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2 text-xs text-accent-error">
          {error}
        </div>
      ) : (
        <p className="text-sm text-fg-secondary">
          Their chat sessions and messages will also be deleted (the
          <code className="font-mono"> ON DELETE CASCADE </code>
          on <code className="font-mono">chat_sessions.user_id</code> takes care of it).
        </p>
      )}
    </Modal>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
};

export function Modal({ open, title, children, confirmLabel, cancelLabel = 'Cancel', onConfirm, onClose }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl border border-app-border bg-white shadow-panel">
        <div className="border-b border-app-border bg-app-navBg px-5 py-3">
          <h2 className="text-sm font-semibold text-app-navActive">{title}</h2>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className="flex justify-end gap-3 border-t border-app-border bg-app-toolbar px-5 py-3">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          {onConfirm ? <Button onClick={onConfirm}>{confirmLabel || 'Confirm'}</Button> : null}
        </div>
      </div>
    </div>
  );
}

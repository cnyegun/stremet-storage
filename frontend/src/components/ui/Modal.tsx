'use client';

import type { ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MuiButton from '@mui/material/Button';

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
};

export function Modal({ open, title, children, confirmLabel, confirmDisabled = false, cancelLabel = 'Cancel', onConfirm, onClose }: ModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth disableEnforceFocus disableAutoFocus>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions>
        <MuiButton onClick={onClose}>{cancelLabel}</MuiButton>
        {onConfirm ? (
          <MuiButton variant="contained" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel || 'Confirm'}
          </MuiButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

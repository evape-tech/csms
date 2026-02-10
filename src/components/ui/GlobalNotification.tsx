"use client";
import React from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useNotificationStore } from '../../stores/notificationStore';

/**
 * Renders a stack of MUI Snackbar/Alert notifications driven by the
 * global notificationStore. Place this once at the top of the component tree
 * (e.g. in ClientLayout).
 */
export default function GlobalNotification() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);

  if (notifications.length === 0) return null;

  return (
    <>
      {notifications.map((n, idx) => (
        <Snackbar
          key={n.id}
          open
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          // Stack multiple toasts vertically
          sx={{ bottom: { xs: `${24 + idx * 64}px !important` } }}
          onClose={() => dismiss(n.id)}
        >
          <Alert
            severity={n.severity}
            variant="filled"
            onClose={() => dismiss(n.id)}
            sx={{ width: '100%' }}
          >
            {n.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}

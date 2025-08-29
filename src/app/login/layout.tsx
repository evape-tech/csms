import React from 'react';

// Route-level layout for /login
// This layout visually covers the root layout so the login page appears full-screen and centered.
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(250,250,250,1)',
      zIndex: 1400,
      padding: 16,
    }}>
      {/* allow wider login card (matches internal login page maxWidth) */}
      <div style={{ width: '100%', maxWidth: 1000, padding: 12 }}>
        {children}
      </div>
    </div>
  );
}

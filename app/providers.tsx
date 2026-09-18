'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

// Thay chuỗi này bằng Client ID bạn lấy từ Google Cloud Console
const GOOGLE_CLIENT_ID = '1028413427983-uis0qgn2kn4cr6fn99dpmj1ecuu9l12t.apps.googleusercontent.com';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
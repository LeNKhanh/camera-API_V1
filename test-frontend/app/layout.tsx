import React from 'react';

export const metadata = {
  title: 'Camera API Test Frontend',
  description: 'Test streaming endpoints with SSO authentication',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}

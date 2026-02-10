import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Case Management System',
  description: 'Manage your cases efficiently',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

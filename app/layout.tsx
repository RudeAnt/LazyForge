import type { Metadata } from 'next'
import { Fira_Code } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const firaCode = Fira_Code({ 
  subsets: ["latin", "cyrillic"],
  variable: '--font-fira-code'
})

export const metadata: Metadata = {
  title: 'LazyForge-AI v1.2',
  description: 'MLOps Workspace',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="bg-[#1a1b26]">
      <body className={`${firaCode.className} antialiased`}>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

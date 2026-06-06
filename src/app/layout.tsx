import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Affluent Academy Dashboard',
  description: 'Sales and setter performance dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        <NextTopLoader color="#9a8fe8" height={2} showSpinner={false} shadow={false} />
        {children}
      </body>
    </html>
  )
}

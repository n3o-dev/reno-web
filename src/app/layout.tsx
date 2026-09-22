import type { Metadata } from 'next'
import { DM_Sans, Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans', display: 'swap' })

/*
 * No site name here. The root layout wraps the client link too, and a
 * tokenised page for one site must not carry another's name in its title.
 * The dashboard sets the fuller title for the Reno surface; the client
 * layout shows the label its own token carries.
 */
export const metadata: Metadata = {
  title: 'Reno',
  description: 'Cleaning operations, reported from the site WhatsApp group.',
}

interface RootLayoutProps {
  readonly children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}

import { RkbScreen } from '@/components/screens/RkbScreen'
import { resolveToken } from '@/services/tokens'
import { unauthorized } from 'next/navigation'

interface PageProps {
  readonly params: Promise<{ readonly token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params
  const link = await resolveToken(token)
  if (link === null) unauthorized()
  return <RkbScreen basePath={`/c/${token}/rkb`} siteId={link.site_id} />
}

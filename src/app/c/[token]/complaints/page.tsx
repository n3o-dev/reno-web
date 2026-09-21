import { ComplaintsScreen } from '@/components/screens/ComplaintsScreen'
import { resolveToken } from '@/services/tokens'
import { unauthorized } from 'next/navigation'

interface PageProps {
  readonly params: Promise<{ readonly token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params
  const link = await resolveToken(token)
  if (link === null) unauthorized()
  return <ComplaintsScreen siteId={link.site_id} />
}

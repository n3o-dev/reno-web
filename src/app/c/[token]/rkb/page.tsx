import { RkbScreen } from '@/components/screens/RkbScreen'

interface PageProps {
  readonly params: Promise<{ readonly token: string }>
}

export default async function Page({ params }: PageProps) {
  const { token } = await params
  return <RkbScreen basePath={`/c/${token}/rkb`} />
}

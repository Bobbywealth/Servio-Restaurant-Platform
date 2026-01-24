import Head from 'next/head'
import DashboardLayout from '../../components/Layout/DashboardLayout'
import AssistantPanel from '../../components/Assistant/AssistantPanel'

export default function AssistantPage() {
  return (
    <>
      <Head>
        <title>Servio Assistant - AI Staff Helper</title>
        <meta name="description" content="Talk to Servio AI Assistant for restaurant operations" />
      </Head>

      <DashboardLayout>
        <AssistantPanel />
      </DashboardLayout>
    </>
  )
}

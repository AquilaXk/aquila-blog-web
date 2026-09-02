import { AppPropsWithLayout } from "../types"
import { CacheProvider } from "@emotion/react"
import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query"
import Head from "next/head"
import { useRouter } from "next/router"
import { RootLayout } from "src/layouts"
import type { AdminProfile } from "src/hooks/useAdminProfile"
import { GlobalErrorBoundary } from "src/components/error/ErrorBoundary"
import createEmotionCache from "src/libs/emotion/createEmotionCache"
import { createQueryClient } from "src/libs/react-query"
import type { PublicAdminProfileSource } from "src/libs/adminProfileSource"
import { shouldRefetchAdminProfileSource } from "src/libs/adminProfileSource"
import { useState } from "react"
import "katex/dist/katex.min.css"

const clientSideEmotionCache = createEmotionCache()
type AppPageProps = AppPropsWithLayout["pageProps"] & {
  initialAdminProfile?: AdminProfile | null
  initialProfileSnapshot?: AdminProfile | null
  initialAdminProfileSource?: PublicAdminProfileSource
}

function App({ Component, pageProps, emotionCache = clientSideEmotionCache }: AppPropsWithLayout) {
  const getLayout = Component.getLayout || ((page) => page)
  const appPageProps = pageProps as AppPageProps
  const initialAdminProfile = appPageProps.initialAdminProfile ?? appPageProps.initialProfileSnapshot ?? null
  const initialAdminProfileShouldRefetch = shouldRefetchAdminProfileSource(appPageProps.initialAdminProfileSource)
  const [queryClient] = useState(createQueryClient)
  const router = useRouter()

  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <title>AquilaLog</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>
      <GlobalErrorBoundary resetKey={router.asPath}>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={pageProps.dehydratedState}>
            <RootLayout
              initialAdminProfile={initialAdminProfile}
              initialAdminProfileShouldRefetch={initialAdminProfileShouldRefetch}
            >
              {getLayout(<Component {...pageProps} />)}
            </RootLayout>
          </HydrationBoundary>
        </QueryClientProvider>
      </GlobalErrorBoundary>
    </CacheProvider>
  )
}

export default App

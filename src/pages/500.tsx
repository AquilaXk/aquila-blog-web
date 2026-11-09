import { useRouter } from "next/router"
import { CONFIG } from "site.config"
import MetaConfig from "src/components/MetaConfig"
import { ErrorFallbackView } from "src/components/error/ErrorFallbackView"
import { useLanguage } from "src/libs/language"

const ServerErrorPage = () => {
  const router = useRouter()
  const { t } = useLanguage()

  return (
    <>
      <MetaConfig
        title={t("error500Title")}
        description={t("error500Desc")}
        type="website"
        url={CONFIG.link}
        robots="noindex, follow"
        canonicalUrl={null}
      />
      <ErrorFallbackView variant="global" onRetry={() => router.reload()} />
    </>
  )
}

export default ServerErrorPage

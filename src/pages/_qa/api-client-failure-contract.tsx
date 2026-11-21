import type { GetServerSideProps, NextPage } from "next"
import { useState } from "react"
import { apiFetch } from "src/apis/backend/client"

type Payload = { title: string }

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.ENABLE_QA_ROUTES === "true" ? { props: {} } : { notFound: true }

const ApiClientFailureContractQaPage: NextPage = () => {
  const [result, setResult] = useState<unknown>(null)
  const run = async (mode: "failure" | "timeout" | "not-modified") => {
    const path = `/post/api/v1/posts/feed?mode=${mode}`
    const seed = await apiFetch<Payload>(path)
    try {
      const second = await apiFetch<Payload>(
        path,
        mode === "timeout" ? { timeoutMs: 10 } : {}
      )
      setResult({ seed, outcome: { kind: "success", data: second } })
    } catch (error) {
      setResult({
        seed,
        outcome: {
          kind: "error",
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : String(error),
        },
      })
    }
  }

  return (
    <main>
      <button type="button" onClick={() => run("failure")}>
        Run API failure contract
      </button>
      <button type="button" onClick={() => run("timeout")}>
        Run API timeout contract
      </button>
      <button type="button" onClick={() => run("not-modified")}>
        Run API 304 contract
      </button>
      <pre data-testid="qa-api-client-failure-result">
        {JSON.stringify(result)}
      </pre>
    </main>
  )
}

export default ApiClientFailureContractQaPage

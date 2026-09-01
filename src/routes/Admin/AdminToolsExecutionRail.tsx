import Link from "next/link"

import {
  type DiagnosticTab,
  type SectionKey,
} from "src/routes/Admin/AdminToolsWorkspaceModel"
import {
  ActionGroupCard,
  ActionList,
  ActionRowButton,
  ActionRowLink,
  CardSectionHeading,
  ExecutionRail,
} from "src/routes/Admin/AdminToolsWorkspace.styles"

export type AdminToolsExecutionRailProps = {
  isBusy: boolean
  onFocusSection: (section: SectionKey, tab?: DiagnosticTab) => void
  onPostCountCheck: () => void
  onSystemHealthCheck: () => void
}

export default function AdminToolsExecutionRail({
  isBusy,
  onFocusSection,
  onPostCountCheck,
  onSystemHealthCheck,
}: AdminToolsExecutionRailProps) {
  return (
    <ExecutionRail>
      <ActionGroupCard>
        <CardSectionHeading>
          <div>
            <h3>실행 전 체크</h3>
          </div>
        </CardSectionHeading>
        <ActionList>
          <ActionRowButton type="button" disabled={isBusy} onClick={onSystemHealthCheck}>
            <span>서비스 상태 조회</span>
          </ActionRowButton>
          <ActionRowButton type="button" disabled={isBusy} onClick={onPostCountCheck}>
            <span>전체 글 수 확인</span>
          </ActionRowButton>
        </ActionList>
      </ActionGroupCard>

      <ActionGroupCard>
        <CardSectionHeading>
          <div>
            <h3>런북/장애 문서</h3>
          </div>
        </CardSectionHeading>
        <ActionList>
          <Link href="/admin/dashboard" passHref legacyBehavior>
            <ActionRowLink>운영 대시보드 열기</ActionRowLink>
          </Link>
          <ActionRowButton type="button" disabled={isBusy} onClick={() => onFocusSection("diagnostics", "queue")}>
            <span>작업 큐 진단으로 이동</span>
          </ActionRowButton>
          <ActionRowButton type="button" disabled={isBusy} onClick={() => onFocusSection("execution", "auth")}>
            <span>인증 보안 기록으로 이동</span>
          </ActionRowButton>
        </ActionList>
      </ActionGroupCard>
    </ExecutionRail>
  )
}

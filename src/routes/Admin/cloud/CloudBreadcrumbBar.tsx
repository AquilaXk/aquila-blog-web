// 참조 구현: supabase/supabase StorageExplorer & filebrowser/filebrowser (Apache-2.0) — 계층 브레드크럼 & 하위 폴더 탐색 바
import { useLanguage } from "src/libs/language"
import AppIcon from "../AdminAppIcon"
import { FolderTileButton } from "../AdminCloudWorkspace.styles"
import { SecondaryButton } from "../AdminCloudWorkspaceControls.styles"
import {
  BreadcrumbButton,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbRow,
  BreadcrumbSeparator,
  SubfolderStrip,
} from "./AdminCloudOverlay.styles"
import { getCloudDictionary } from "./adminCloudI18n"
import { buildCloudFolderBreadcrumbs, normalizeCloudFolderPath } from "./cloudFolderHelpers"

export type CloudFolderBreadcrumbBarProps = {
  activeFolderPath: string
  childFolders: string[]
  onSelectFolder: (folderPath: string) => void
  onOpenNewFolder: () => void
}

export const CloudFolderBreadcrumbBar = ({
  activeFolderPath,
  childFolders,
  onSelectFolder,
  onOpenNewFolder,
}: CloudFolderBreadcrumbBarProps) => {
  const { language } = useLanguage()
  const t = getCloudDictionary(language)
  const normalizedActive = normalizeCloudFolderPath(activeFolderPath)
  const crumbs = buildCloudFolderBreadcrumbs(normalizedActive, t.rootFolder)

  return (
    <>
      <BreadcrumbRow aria-label={t.folderBreadcrumbAria}>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const isCurrent = index === crumbs.length - 1
            return (
              <BreadcrumbItem key={crumb.path || "__root__"}>
                {index > 0 ? <BreadcrumbSeparator aria-hidden="true">/</BreadcrumbSeparator> : null}
                <BreadcrumbButton
                  type="button"
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => onSelectFolder(crumb.path)}
                  title={crumb.path ? `/${crumb.path}` : t.rootFolder}
                >
                  {index === 0 ? <AppIcon name="folder" /> : null}
                  <span>{crumb.label}</span>
                </BreadcrumbButton>
              </BreadcrumbItem>
            )
          })}
        </BreadcrumbList>
        <SecondaryButton type="button" onClick={onOpenNewFolder}>
          + {t.newFolder}
        </SecondaryButton>
      </BreadcrumbRow>

      {childFolders.length > 0 ? (
        <SubfolderStrip role="group" aria-label={t.folderBreadcrumbAria}>
          {childFolders.map((folder) => {
            const segmentLabel = normalizedActive
              ? folder.slice(normalizedActive.length + 1)
              : folder
            return (
              <FolderTileButton
                key={folder}
                type="button"
                data-active={normalizedActive === folder}
                onClick={() => onSelectFolder(folder)}
                title={`/${folder}`}
              >
                <AppIcon name="folder" />
                <span>{segmentLabel || folder}</span>
              </FolderTileButton>
            )
          })}
        </SubfolderStrip>
      ) : null}
    </>
  )
}

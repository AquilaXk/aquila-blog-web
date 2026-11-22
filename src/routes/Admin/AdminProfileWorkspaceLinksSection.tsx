// 참조 구현: TryGhost/Ghost apps/admin/src/settings/main-content.tsx (MIT) & medusajs/medusa packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx (MIT)
import { useState } from "react"
import AppIcon from "./AdminProfileIcon"
import {
  getProfileCardIconOptions,
  isAllowedProfileLinkHref,
  normalizeProfileLinkHref,
  type ProfileCardLinkItem,
} from "src/constants/profileCardLinks"
import {
  DangerButton,
  DragHandleButton,
  EmptyStateCard,
  FieldBox,
  FieldLabel,
  FieldSectionCard,
  GhostButton,
  IconOptionButton,
  IconOptionText,
  IconPickerButton,
  IconPickerCopy,
  IconPickerField,
  IconPickerPanel,
  IconPreview,
  InlineActionRow,
  Input,
  LinkCardList,
  LinkInputs,
  LinkManagerHeader,
  LinkRowCard,
  MiniButton,
  PreviewAnchor,
  SectionBlockHeader,
  SectionStack,
  SegmentButton,
  SegmentedControl,
} from "src/routes/Admin/AdminProfileWorkspace.styles"
import type { OpenIconPicker } from "src/routes/Admin/AdminProfileWorkspacePageDraftActions"
import type { AdminProfileWorkspaceSectionProps } from "src/routes/Admin/AdminProfileWorkspacePageModel"

const LinksSectionContent = (props: AdminProfileWorkspaceSectionProps) => {
  const {
    appendLinkItem,
    dragOverLinkIndex,
    dragOverLinkPosition,
    draggingLinkIndex,
    draft,
    linkTab,
    moveLinkItem,
    openIconPicker,
    removeLinkItem,
    reorderLinkItems,
    setDragOverLinkIndex,
    setDragOverLinkPosition,
    setDraggingLinkIndex,
    setLinkTab,
    setOpenIconPicker,
    updateLinkItem,
  } = props
  const [armedDragIndex, setArmedDragIndex] = useState<number | null>(null)
  const visibleLinks: ProfileCardLinkItem[] = linkTab === "service" ? draft.serviceLinks : draft.contactLinks

  return (
    <SectionStack>
      <FieldSectionCard>
        <SectionBlockHeader>
          <div>
            <h3>외부 링크</h3>
            <p>프로필 카드에 노출되는 서비스 저장소와 연락처 링크 순서를 관리합니다.</p>
          </div>
          <SegmentedControl>
            <SegmentButton type="button" data-active={linkTab === "service"} onClick={() => setLinkTab("service")}>
              서비스
            </SegmentButton>
            <SegmentButton type="button" data-active={linkTab === "contact"} onClick={() => setLinkTab("contact")}>
              연락 채널
            </SegmentButton>
          </SegmentedControl>
        </SectionBlockHeader>

        <LinkManagerHeader>
          <div>
            <strong>{linkTab === "service" ? "서비스 링크" : "연락 채널"}</strong>
            <span>{visibleLinks.length}개 항목</span>
          </div>
          <GhostButton type="button" onClick={() => appendLinkItem(linkTab)}>
            + 링크 추가
          </GhostButton>
        </LinkManagerHeader>
        {visibleLinks.length > 0 ? (
          <LinkCardList>
            {visibleLinks.map((item, index) => {
              const section = linkTab
              const options = getProfileCardIconOptions(section)
              const pickerKey = `${section}:${index}` as OpenIconPicker
              const previewHref = normalizeProfileLinkHref(section, item.href)
              const optionLabel = options.find((option) => option.id === item.icon)?.label || "아이콘"
              const iconFieldLabelId = `profile-link-icon-label-${section}-${index}`
              const labelInputId = `profile-link-label-${section}-${index}`
              const hrefInputId = `profile-link-href-${section}-${index}`

              return (
                <LinkRowCard
                  key={`${section}-${index}`}
                  draggable={armedDragIndex === index}
                  data-dragging={draggingLinkIndex === index ? "true" : "false"}
                  data-drop-target={dragOverLinkIndex === index && draggingLinkIndex !== index ? "true" : "false"}
                  data-drop-position={dragOverLinkIndex === index ? dragOverLinkPosition || undefined : undefined}
                  onDragStart={(event) => {
                    const targetEl = event.target instanceof HTMLElement ? event.target : null
                    if (
                      armedDragIndex !== index ||
                      targetEl?.closest("input, textarea, button, a, [role='listbox']")
                    ) {
                      event.preventDefault()
                      return
                    }
                    event.dataTransfer.effectAllowed = "move"
                    event.dataTransfer.setData("text/plain", `${section}:${index}`)
                    setDraggingLinkIndex(index)
                    setDragOverLinkIndex(index)
                    setDragOverLinkPosition("after")
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = "move"
                    const bounds = (event.currentTarget as HTMLDivElement).getBoundingClientRect()
                    const nextPosition = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"
                    if (dragOverLinkIndex !== index) {
                      setDragOverLinkIndex(index)
                    }
                    setDragOverLinkPosition(nextPosition)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const payload = event.dataTransfer.getData("text/plain")
                    const [dragSection, rawIndex] = payload.split(":")
                    const fromIndex = Number.parseInt(rawIndex ?? "", 10)
                    if (dragSection === section && Number.isFinite(fromIndex)) {
                      const rawTargetIndex =
                        dragOverLinkPosition === "after" && index < visibleLinks.length - 1 ? index + 1 : index
                      const normalizedTargetIndex = fromIndex < rawTargetIndex ? rawTargetIndex - 1 : rawTargetIndex
                      const nextTargetIndex = Math.max(0, Math.min(visibleLinks.length - 1, normalizedTargetIndex))
                      reorderLinkItems(section, fromIndex, nextTargetIndex)
                    }
                    setArmedDragIndex(null)
                    setDraggingLinkIndex(null)
                    setDragOverLinkIndex(null)
                    setDragOverLinkPosition(null)
                  }}
                  onDragEnd={() => {
                    setArmedDragIndex(null)
                    setDraggingLinkIndex(null)
                    setDragOverLinkIndex(null)
                    setDragOverLinkPosition(null)
                  }}
                >
                  <IconPickerField data-icon-picker-root="true">
                    <FieldLabel as="span" id={iconFieldLabelId} style={{ paddingTop: 0, fontSize: "0.78rem" }}>
                      아이콘
                    </FieldLabel>
                    <IconPickerButton
                      type="button"
                      aria-labelledby={iconFieldLabelId}
                      aria-expanded={openIconPicker === pickerKey}
                      onClick={() =>
                        setOpenIconPicker((current: OpenIconPicker) => (current === pickerKey ? null : pickerKey))
                      }
                    >
                      <IconPreview>
                        <AppIcon name={item.icon} />
                      </IconPreview>
                      <IconPickerCopy>
                        <strong>{optionLabel}</strong>
                        <span>{item.icon}</span>
                      </IconPickerCopy>
                      <AppIcon name="chevron-down" />
                    </IconPickerButton>
                    {openIconPicker === pickerKey ? (
                      <IconPickerPanel role="listbox" aria-label="링크 아이콘 선택">
                        {options.map((option) => (
                          <IconOptionButton
                            key={option.id}
                            type="button"
                            role="option"
                            aria-selected={option.id === item.icon}
                            data-selected={option.id === item.icon}
                            onClick={() => {
                              updateLinkItem(section, index, "icon", option.id)
                              setOpenIconPicker(null)
                            }}
                          >
                            <IconPreview data-compact={true}>
                              <AppIcon name={option.id} />
                            </IconPreview>
                            <IconOptionText>
                              <strong>{option.label}</strong>
                              <span>{option.id}</span>
                            </IconOptionText>
                          </IconOptionButton>
                        ))}
                      </IconPickerPanel>
                    ) : null}
                  </IconPickerField>

                  <LinkInputs>
                    <FieldBox>
                      <FieldLabel htmlFor={labelInputId}>이름</FieldLabel>
                      <Input
                        id={labelInputId}
                        value={item.label}
                        placeholder={section === "service" ? "예: GitHub" : "예: 이메일"}
                        onChange={(event) => updateLinkItem(section, index, "label", event.target.value)}
                      />
                    </FieldBox>
                    <FieldBox>
                      <FieldLabel htmlFor={hrefInputId}>연결 주소</FieldLabel>
                      <Input
                        id={hrefInputId}
                        value={item.href}
                        placeholder={section === "service" ? "https://..." : "mailto:me@example.com 또는 https://..."}
                        onChange={(event) => updateLinkItem(section, index, "href", event.target.value)}
                      />
                    </FieldBox>
                  </LinkInputs>

                  <InlineActionRow className="linkActions">
                    <DragHandleButton
                      tabIndex={0}
                      role="button"
                      aria-label={`${item.label || "링크"} 순서 이동`}
                      onPointerDown={() => setArmedDragIndex(index)}
                      onPointerUp={() => setArmedDragIndex(null)}
                      onPointerCancel={() => setArmedDragIndex(null)}
                      onMouseLeave={() => {
                        if (draggingLinkIndex === null) setArmedDragIndex(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowUp" && index > 0) {
                          event.preventDefault()
                          moveLinkItem(section, index, -1)
                        } else if (event.key === "ArrowDown" && index < visibleLinks.length - 1) {
                          event.preventDefault()
                          moveLinkItem(section, index, 1)
                        }
                      }}
                    >
                      <AppIcon name="list" />
                      드래그 정렬
                    </DragHandleButton>
                    <InlineActionRow className="linkActionButtons">
                      {previewHref && isAllowedProfileLinkHref(section, item.href) ? (
                        <PreviewAnchor href={previewHref} target="_blank" rel="noreferrer">
                          열기
                        </PreviewAnchor>
                      ) : (
                        <MiniButton type="button" disabled>
                          열기
                        </MiniButton>
                      )}
                      <MiniButton
                        className="reorderButton"
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveLinkItem(section, index, -1)}
                      >
                        위로
                      </MiniButton>
                      <MiniButton
                        className="reorderButton"
                        type="button"
                        disabled={index === visibleLinks.length - 1}
                        onClick={() => moveLinkItem(section, index, 1)}
                      >
                        아래로
                      </MiniButton>
                      <DangerButton type="button" onClick={() => removeLinkItem(section, index)}>
                        삭제
                      </DangerButton>
                    </InlineActionRow>
                  </InlineActionRow>
                </LinkRowCard>
              )
            })}
          </LinkCardList>
        ) : (
          <EmptyStateCard>
            <strong>아직 등록된 링크가 없습니다</strong>
            <p>링크 추가 버튼을 눌러 서비스 링크나 연락 채널을 추가하세요.</p>
          </EmptyStateCard>
        )}
      </FieldSectionCard>
    </SectionStack>
  )
}

export const renderAdminProfileLinksSection = (props: AdminProfileWorkspaceSectionProps) => (
  <LinksSectionContent {...props} />
)

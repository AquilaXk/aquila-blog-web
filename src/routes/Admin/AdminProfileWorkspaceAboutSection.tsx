// 참조 구현: TryGhost/Ghost apps/admin/src/settings/main-content.tsx (MIT) & medusajs/medusa packages/admin/dashboard/src/components/layout/settings-layout/settings-layout.tsx (MIT)
import type { AboutProjectBlock, AboutSectionBlock } from "src/libs/profileWorkspace"
import type { AdminProfileWorkspaceSectionProps } from "src/routes/Admin/AdminProfileWorkspacePageModel"
import {
  AboutProjectCard,
  AboutProjectList,
  AboutSectionCard,
  AboutSectionCardHeader,
  AboutSectionList,
  DangerButton,
  EmptyStateCard,
  FieldBox,
  FieldGrid,
  FieldHint,
  FieldLabel,
  FieldLabelGroup,
  FieldSectionCard,
  GhostButton,
  InlineActionRow,
  Input,
  ItemList,
  ItemRow,
  MiniButton,
  SectionBlockHeader,
  SectionStack,
  TextArea,
} from "src/routes/Admin/AdminProfileWorkspace.styles"

export const renderAdminProfileAboutSection = (props: AdminProfileWorkspaceSectionProps) => {
  const {
    addAboutItem,
    addAboutProject,
    addAboutSection,
    draft,
    moveAboutItem,
    moveAboutProject,
    moveAboutSection,
    removeAboutItem,
    removeAboutProject,
    removeAboutSection,
    updateAboutProject,
    updateAboutSection,
    updateDraft,
  } = props

  return (
    <SectionStack>
      <FieldSectionCard>
        <SectionBlockHeader>
          <div>
            <h3>상단 소개</h3>
            <p>About 페이지 최상단에 표시되는 핵심 헤드라인과 소개 문단입니다.</p>
          </div>
        </SectionBlockHeader>
        <FieldGrid data-columns="2">
          <FieldBox data-span="full">
            <FieldLabelGroup>
              <FieldLabel htmlFor="about-headline">상단 문구</FieldLabel>
              <FieldHint>페이지 첫 줄에 노출할 핵심 철학 문장</FieldHint>
            </FieldLabelGroup>
            <Input
              id="about-headline"
              value={draft.aboutHeadline}
              placeholder="예: 이유를 먼저 따지고, 운영 가능한 시스템을 설계합니다."
              onChange={(event) => updateDraft("aboutHeadline", event.target.value)}
            />
          </FieldBox>
          <FieldBox>
            <FieldLabelGroup>
              <FieldLabel htmlFor="about-role">페이지 역할 문구</FieldLabel>
              <FieldHint>이름 아래 표시할 직무·전문 분야</FieldHint>
            </FieldLabelGroup>
            <Input
              id="about-role"
              value={draft.aboutRole}
              placeholder="예: 운영과 구조를 설계하는 백엔드 엔지니어"
              onChange={(event) => updateDraft("aboutRole", event.target.value)}
            />
          </FieldBox>
          <FieldBox data-span="full">
            <FieldLabelGroup>
              <FieldLabel htmlFor="about-bio">소개 문단</FieldLabel>
              <FieldHint>주요 경험과 방향성을 요약한 본문</FieldHint>
            </FieldLabelGroup>
            <TextArea
              id="about-bio"
              value={draft.aboutBio}
              placeholder="About 페이지 첫 문단에서 보여줄 소개를 적어주세요."
              onChange={(event) => updateDraft("aboutBio", event.target.value)}
            />
          </FieldBox>
        </FieldGrid>
      </FieldSectionCard>

      <FieldSectionCard>
        <SectionBlockHeader>
          <div>
            <h3>상세 블록</h3>
            <p>경력, 기술 스택, 활동 이력 등을 구조화된 목록으로 구성합니다.</p>
          </div>
          <GhostButton type="button" onClick={addAboutSection}>
            + 블록 추가
          </GhostButton>
        </SectionBlockHeader>

        {draft.aboutSections.length > 0 ? (
          <AboutSectionList>
            {draft.aboutSections.map((section, sectionIndex) => {
              const sectionTitleId = `about-section-title-${sectionIndex}`
              return (
                <AboutSectionCard key={section.id || `section-${sectionIndex}`}>
                  <AboutSectionCardHeader>
                    <div>
                      <span>상세 블록 {sectionIndex + 1}</span>
                      <label>
                        <input
                          type="checkbox"
                          checked={section.dividerBefore}
                          onChange={(event) =>
                            updateAboutSection(sectionIndex, (current: AboutSectionBlock) => ({
                              ...current,
                              dividerBefore: event.target.checked,
                            }))
                          }
                        />
                        이전 블록과 구분선 넣기
                      </label>
                    </div>
                    <InlineActionRow>
                      <MiniButton
                        type="button"
                        disabled={sectionIndex === 0}
                        onClick={() => moveAboutSection(sectionIndex, -1)}
                      >
                        위로
                      </MiniButton>
                      <MiniButton
                        type="button"
                        disabled={sectionIndex === draft.aboutSections.length - 1}
                        onClick={() => moveAboutSection(sectionIndex, 1)}
                      >
                        아래로
                      </MiniButton>
                      <DangerButton type="button" onClick={() => removeAboutSection(sectionIndex)}>
                        삭제
                      </DangerButton>
                    </InlineActionRow>
                  </AboutSectionCardHeader>

                  <FieldBox>
                    <FieldLabel htmlFor={sectionTitleId}>블록 제목</FieldLabel>
                    <Input
                      id={sectionTitleId}
                      value={section.title}
                      placeholder="예: 경력"
                      onChange={(event) =>
                        updateAboutSection(sectionIndex, (current: AboutSectionBlock) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </FieldBox>

                  <ItemList>
                    {section.items.map((item, itemIndex) => (
                      <ItemRow key={`${section.id}-${itemIndex}`}>
                        <span className="bullet">-</span>
                        <Input
                          aria-label={`상세 블록 ${sectionIndex + 1} 항목 ${itemIndex + 1}`}
                          value={item}
                          placeholder="항목 내용을 입력하세요."
                          onChange={(event) =>
                            updateAboutSection(sectionIndex, (current: AboutSectionBlock) => ({
                              ...current,
                              items: current.items.map((entry, index) =>
                                index === itemIndex ? event.target.value : entry
                              ),
                            }))
                          }
                        />
                        <InlineActionRow>
                          <MiniButton
                            type="button"
                            disabled={itemIndex === 0}
                            onClick={() => moveAboutItem(sectionIndex, itemIndex, -1)}
                          >
                            위로
                          </MiniButton>
                          <MiniButton
                            type="button"
                            disabled={itemIndex === section.items.length - 1}
                            onClick={() => moveAboutItem(sectionIndex, itemIndex, 1)}
                          >
                            아래로
                          </MiniButton>
                          <DangerButton type="button" onClick={() => removeAboutItem(sectionIndex, itemIndex)}>
                            삭제
                          </DangerButton>
                        </InlineActionRow>
                      </ItemRow>
                    ))}
                  </ItemList>

                  <div>
                    <GhostButton type="button" onClick={() => addAboutItem(sectionIndex)}>
                      + 항목 추가
                    </GhostButton>
                  </div>
                </AboutSectionCard>
              )
            })}
          </AboutSectionList>
        ) : (
          <EmptyStateCard>
            <strong>아직 상세 블록이 없습니다</strong>
            <p>블록 추가 버튼을 눌러 경력이나 기술 스택 목록을 추가하세요.</p>
          </EmptyStateCard>
        )}
      </FieldSectionCard>

      <FieldSectionCard>
        <SectionBlockHeader>
          <div>
            <h3>프로젝트</h3>
            <p>대표 프로젝트의 역할, 요약, 저장소 또는 서비스 링크를 관리합니다.</p>
          </div>
          <GhostButton type="button" onClick={addAboutProject}>
            + 프로젝트 추가
          </GhostButton>
        </SectionBlockHeader>

        <FieldBox>
          <FieldLabelGroup>
            <FieldLabel htmlFor="about-project-title">섹션 제목</FieldLabel>
            <FieldHint>프로젝트 영역 상단 헤딩 이름</FieldHint>
          </FieldLabelGroup>
          <Input
            id="about-project-title"
            value={draft.aboutProjectSectionTitle}
            placeholder="예: 프로젝트"
            onChange={(event) => updateDraft("aboutProjectSectionTitle", event.target.value)}
          />
        </FieldBox>

        {draft.aboutProjects.length > 0 ? (
          <AboutProjectList>
            {draft.aboutProjects.map((project, projectIndex) => {
              const nameId = `about-project-name-${projectIndex}`
              const roleId = `about-project-role-${projectIndex}`
              const summaryId = `about-project-summary-${projectIndex}`
              const hrefId = `about-project-href-${projectIndex}`
              const linkLabelId = `about-project-link-label-${projectIndex}`
              return (
                <AboutProjectCard key={project.id || `project-${projectIndex}`}>
                  <AboutSectionCardHeader>
                    <div>
                      <span>프로젝트 {projectIndex + 1}</span>
                    </div>
                    <InlineActionRow>
                      <MiniButton
                        type="button"
                        disabled={projectIndex === 0}
                        onClick={() => moveAboutProject(projectIndex, -1)}
                      >
                        위로
                      </MiniButton>
                      <MiniButton
                        type="button"
                        disabled={projectIndex === draft.aboutProjects.length - 1}
                        onClick={() => moveAboutProject(projectIndex, 1)}
                      >
                        아래로
                      </MiniButton>
                      <DangerButton type="button" onClick={() => removeAboutProject(projectIndex)}>
                        삭제
                      </DangerButton>
                    </InlineActionRow>
                  </AboutSectionCardHeader>

                  <FieldGrid data-columns="2">
                    <FieldBox>
                      <FieldLabel htmlFor={nameId}>제목</FieldLabel>
                      <Input
                        id={nameId}
                        value={project.name}
                        placeholder="예: aquila-blog"
                        onChange={(event) =>
                          updateAboutProject(projectIndex, (current: AboutProjectBlock) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </FieldBox>
                    <FieldBox>
                      <FieldLabel htmlFor={roleId}>역할</FieldLabel>
                      <Input
                        id={roleId}
                        value={project.role}
                        placeholder="예: Full-stack · Editor/SSR/Deploy"
                        onChange={(event) =>
                          updateAboutProject(projectIndex, (current: AboutProjectBlock) => ({
                            ...current,
                            role: event.target.value,
                          }))
                        }
                      />
                    </FieldBox>
                    <FieldBox data-span="full">
                      <FieldLabel htmlFor={summaryId}>요약</FieldLabel>
                      <TextArea
                        id={summaryId}
                        value={project.summary}
                        placeholder="프로젝트 목록에 표시할 설명"
                        onChange={(event) =>
                          updateAboutProject(projectIndex, (current: AboutProjectBlock) => ({
                            ...current,
                            summary: event.target.value,
                          }))
                        }
                      />
                    </FieldBox>
                    <FieldBox>
                      <FieldLabel htmlFor={hrefId}>URL</FieldLabel>
                      <Input
                        id={hrefId}
                        value={project.href}
                        placeholder="https://..."
                        onChange={(event) =>
                          updateAboutProject(projectIndex, (current: AboutProjectBlock) => ({
                            ...current,
                            href: event.target.value,
                          }))
                        }
                      />
                    </FieldBox>
                    <FieldBox>
                      <FieldLabel htmlFor={linkLabelId}>링크 라벨</FieldLabel>
                      <Input
                        id={linkLabelId}
                        value={project.linkLabel}
                        placeholder="예: 링크 보기"
                        onChange={(event) =>
                          updateAboutProject(projectIndex, (current: AboutProjectBlock) => ({
                            ...current,
                            linkLabel: event.target.value,
                          }))
                        }
                      />
                    </FieldBox>
                  </FieldGrid>
                </AboutProjectCard>
              )
            })}
          </AboutProjectList>
        ) : (
          <EmptyStateCard>
            <strong>아직 프로젝트가 없습니다</strong>
            <p>프로젝트 추가 버튼을 눌러 대표 프로젝트를 등록하세요.</p>
          </EmptyStateCard>
        )}
      </FieldSectionCard>
    </SectionStack>
  )
}

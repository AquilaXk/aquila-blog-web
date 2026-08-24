import {
  FindReplaceActions,
  FindReplaceCheckbox,
  FindReplaceField,
  FindReplaceInput,
  FindReplaceRegion,
  FindReplaceStatus,
} from "./MarkdownEditor.styles"

type MarkdownEditorFindReplaceProps = {
  query: string
  replacement: string
  caseSensitive: boolean
  scopeLabel: "선택 영역" | "전체 문서"
  currentMatch: number
  totalMatches: number
  disabled?: boolean
  replaceCurrentDisabled?: boolean
  onQueryChange: (value: string) => void
  onReplacementChange: (value: string) => void
  onCaseSensitiveChange: (checked: boolean) => void
  onPrevious: () => void
  onNext: () => void
  onReplaceCurrent: () => void
  onReplaceAll: () => void
  onClose: () => void
}

export const MarkdownEditorFindReplace = ({
  query,
  replacement,
  caseSensitive,
  scopeLabel,
  currentMatch,
  totalMatches,
  disabled = false,
  replaceCurrentDisabled = false,
  onQueryChange,
  onReplacementChange,
  onCaseSensitiveChange,
  onPrevious,
  onNext,
  onReplaceCurrent,
  onReplaceAll,
  onClose,
}: MarkdownEditorFindReplaceProps) => (
  <FindReplaceRegion aria-label="찾기 및 바꾸기">
    <FindReplaceField>
      <span>찾을 내용</span>
      <FindReplaceInput
        aria-label="찾을 내용"
        disabled={disabled}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        value={query}
      />
    </FindReplaceField>
    <FindReplaceField>
      <span>바꿀 내용</span>
      <FindReplaceInput
        aria-label="바꿀 내용"
        disabled={disabled}
        onChange={(event) => onReplacementChange(event.currentTarget.value)}
        value={replacement}
      />
    </FindReplaceField>
    <FindReplaceCheckbox>
      <input
        checked={caseSensitive}
        disabled={disabled}
        onChange={(event) => onCaseSensitiveChange(event.currentTarget.checked)}
        type="checkbox"
      />
      대/소문자 구분
    </FindReplaceCheckbox>
    <FindReplaceStatus role="status">{`${scopeLabel} · ${currentMatch} / ${totalMatches}`}</FindReplaceStatus>
    <FindReplaceActions>
      <button disabled={disabled || totalMatches === 0} onClick={onPrevious} type="button">
        이전 찾기
      </button>
      <button disabled={disabled || totalMatches === 0} onClick={onNext} type="button">
        다음 찾기
      </button>
      <button disabled={disabled || replaceCurrentDisabled} onClick={onReplaceCurrent} type="button">
        현재 바꾸기
      </button>
      <button disabled={disabled || totalMatches === 0} onClick={onReplaceAll} type="button">
        모두 바꾸기
      </button>
      <button onClick={onClose} type="button">
        닫기
      </button>
    </FindReplaceActions>
  </FindReplaceRegion>
)

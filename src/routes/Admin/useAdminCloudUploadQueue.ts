// 참조 구현: transloadit/uppy (MIT) — 동시성 3 병렬 업로드 큐·언마운트 세션 보존·취소 분리·EMA 속도/ETA
import { useQueryClient } from "@tanstack/react-query"
import {
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { uploadCloudFile, type CloudFile } from "src/apis/backend/cloud"
import { useLanguage } from "src/libs/language"
import {
  applyUploadQueueFailure,
  applyUploadQueueProgress,
  applyUploadQueueSuccess,
  createUploadQueueItem,
  doesCloudFileMatchFilters,
  isAbortLikeError,
  isUploadActive,
  mergeCloudFiles,
  preferClientFilenameForUploadedFile,
  type CloudMediaFilter,
  type UploadQueueItem,
} from "./AdminCloudWorkspaceModel"
import { resolveCloudErrorMessage } from "./cloud/cloudPreviewHelpers"
import { validateCloudFileBeforeUpload } from "./cloudFileSignatureGuard"
import {
  computeAggregateQueueProgress,
  MAX_CONCURRENT_CLOUD_UPLOADS,
} from "./cloudUploadQueueModel"

const CLOUD_QUERY_KEY = "admin-cloud-files"
const CLOUD_FACETS_QUERY_KEY = "admin-cloud-facets"

const getCachedCloudQueryFilters = (queryKey: readonly unknown[]) => ({
  filter: (queryKey[1] as CloudMediaFilter) || "ALL",
  keyword: typeof queryKey[2] === "string" ? queryKey[2] : "",
  folderPath: typeof queryKey[3] === "string" ? queryKey[3] : "",
})

export type UseAdminCloudUploadQueueParams = {
  activeFolderPath: string
  onUploadSuccess: (file: CloudFile) => void
  onNotice: (message: string) => void
  onToast: (toast: { tone: "success" | "error"; text: string }) => void
}

export const useAdminCloudUploadQueue = ({
  activeFolderPath,
  onUploadSuccess,
  onNotice,
  onToast,
}: UseAdminCloudUploadQueueParams) => {
  const { language } = useLanguage()
  const queryClient = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map())
  const cancelControllersRef = useRef<Map<string, AbortController>>(new Map())
  const userCancelledIdsRef = useRef<Set<string>>(new Set())
  const activeJobsRef = useRef<Set<string>>(new Set())
  const mountedRef = useRef(true)

  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [scheduleRevision, setScheduleRevision] = useState(0)

  const uploadQueueRef = useRef(uploadQueue)
  uploadQueueRef.current = uploadQueue

  const callbacksRef = useRef({ onNotice, onUploadSuccess, queryClient, language })
  callbacksRef.current = { onNotice, onUploadSuccess, queryClient, language }

  const activeUploadCount = useMemo(
    () => uploadQueue.filter((item) => isUploadActive(item.status)).length,
    [uploadQueue]
  )
  const completedUploadCount = useMemo(
    () => uploadQueue.filter((item) => item.status === "done").length,
    [uploadQueue]
  )
  const aggregateProgress = useMemo(
    () => computeAggregateQueueProgress(uploadQueue),
    [uploadQueue]
  )

  const queueScheduleKey = useMemo(() => {
    let uploadingCount = 0
    let queuedIds = ""
    for (const item of uploadQueue) {
      if (item.status === "uploading") {
        uploadingCount += 1
      } else if (item.status === "queued") {
        queuedIds += `${item.id},`
      }
    }
    return `${uploadingCount}|${queuedIds}`
  }, [uploadQueue])

  // 언마운트 시 HTTP 전송만 중단하고 서버 resumable 세션과 localStorage 키는 보존한다.
  useEffect(() => {
    mountedRef.current = true
    const controllers = uploadControllersRef.current
    const cancelControllers = cancelControllersRef.current
    return () => {
      mountedRef.current = false
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
      cancelControllers.clear()
    }
  }, [])

  // 동시 업로드 스케줄러 (최대 MAX_CONCURRENT_CLOUD_UPLOADS = 3 동시 실행, finally 슬롯 회수 시 scheduleRevision 재실행)
  useEffect(() => {
    const activeCount = activeJobsRef.current.size
    const availableSlots = MAX_CONCURRENT_CLOUD_UPLOADS - activeCount
    if (availableSlots <= 0) return

    const pendingItems = uploadQueueRef.current.filter(
      (item) => item.status === "queued" && !activeJobsRef.current.has(item.id)
    )
    if (pendingItems.length === 0) return

    const itemsToStart = pendingItems.slice(0, availableSlots)

    for (const nextUpload of itemsToStart) {
      activeJobsRef.current.add(nextUpload.id)
      const controller = new AbortController()
      const cancelController = new AbortController()
      uploadControllersRef.current.set(nextUpload.id, controller)
      cancelControllersRef.current.set(nextUpload.id, cancelController)

      setUploadQueue((current) =>
        current.map((item) =>
          item.id === nextUpload.id
            ? {
                ...item,
                status: "uploading",
                progress: 2,
                message:
                  callbacksRef.current.language === "en" ? "Starting upload" : "업로드 시작 중",
              }
            : item
        )
      )

      const updateCachedFileQueries = (displayUploaded: CloudFile) => {
        const { queryClient: client } = callbacksRef.current
        client
          .getQueriesData<CloudFile[]>({ queryKey: [CLOUD_QUERY_KEY] })
          .forEach(([queryKey, current]) => {
            if (!Array.isArray(current)) return
            const cachedFilters = getCachedCloudQueryFilters(queryKey)
            if (
              !doesCloudFileMatchFilters(
                displayUploaded,
                cachedFilters.filter,
                cachedFilters.keyword,
                cachedFilters.folderPath
              )
            ) {
              return
            }
            client.setQueryData(queryKey, mergeCloudFiles([displayUploaded], current))
          })
      }

      const run = async () => {
        try {
          const uploaded = await uploadCloudFile(
            nextUpload.file,
            nextUpload.folderPath,
            controller.signal,
            {
              cancelSignal: cancelController.signal,
              language: callbacksRef.current.language,
              onProgress: ({ progress, message, loadedBytes, speedBps, etaSeconds }) => {
                if (!mountedRef.current) return
                setUploadQueue((current) =>
                  applyUploadQueueProgress(current, nextUpload.id, progress, message, {
                    loadedBytes,
                    speedBps,
                    etaSeconds,
                  })
                )
              },
            }
          )

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError")
          }

          const displayUploaded = preferClientFilenameForUploadedFile(uploaded, nextUpload.name)
          updateCachedFileQueries(displayUploaded)
          if (mountedRef.current) {
            callbacksRef.current.onUploadSuccess(displayUploaded)
            callbacksRef.current.onNotice("")
            setUploadQueue((current) =>
              applyUploadQueueSuccess(
                current,
                nextUpload.id,
                displayUploaded.id,
                callbacksRef.current.language
              )
            )
          }
          void callbacksRef.current.queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
          void callbacksRef.current.queryClient.invalidateQueries({
            queryKey: [CLOUD_FACETS_QUERY_KEY],
          })
        } catch (error) {
          const isExplicitUserCancel =
            userCancelledIdsRef.current.has(nextUpload.id) || cancelController.signal.aborted
          const aborted = controller.signal.aborted || isAbortLikeError(error)
          if (mountedRef.current) {
            const lang = callbacksRef.current.language
            const failureMessage = isExplicitUserCancel
              ? lang === "en"
                ? "Cancelled by user"
                : "사용자가 취소함"
              : aborted
                ? lang === "en"
                  ? "Paused on navigation"
                  : "전송 일시 중단됨"
                : resolveCloudErrorMessage(error, lang)
            callbacksRef.current.onNotice(
              isExplicitUserCancel
                ? lang === "en"
                  ? `${nextUpload.name} upload cancelled`
                  : `${nextUpload.name} 업로드 취소`
                : aborted
                  ? lang === "en"
                    ? `${nextUpload.name} upload paused`
                    : `${nextUpload.name} 업로드 일시 중단`
                  : lang === "en"
                    ? `${nextUpload.name} upload failed: ${failureMessage}`
                    : `${nextUpload.name} 업로드 실패: ${failureMessage}`
            )
            setUploadQueue((current) =>
              applyUploadQueueFailure(
                current,
                nextUpload.id,
                isExplicitUserCancel || aborted,
                failureMessage
              )
            )
          }
        } finally {
          uploadControllersRef.current.delete(nextUpload.id)
          cancelControllersRef.current.delete(nextUpload.id)
          userCancelledIdsRef.current.delete(nextUpload.id)
          activeJobsRef.current.delete(nextUpload.id)
          if (mountedRef.current) {
            setScheduleRevision((n) => n + 1)
          }
        }
      }

      void run()
    }
  }, [queueScheduleKey, scheduleRevision])

  const queueUploadFiles = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) return

      const validFiles: File[] = []
      for (const file of selectedFiles) {
        const validation = await validateCloudFileBeforeUpload(file, language)
        if (!mountedRef.current) return
        if (!validation.ok) {
          onToast({ tone: "error", text: `${file.name}: ${validation.reason}` })
          continue
        }
        validFiles.push(file)
      }

      if (!mountedRef.current || validFiles.length === 0) return

      setUploadQueue((current) => [
        ...current,
        ...validFiles.map((file) => createUploadQueueItem(file, activeFolderPath, language)),
      ])
    },
    [activeFolderPath, language, onToast]
  )

  const handleUploadSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      void queueUploadFiles(Array.from(event.currentTarget.files || []))
      event.currentTarget.value = ""
    },
    [queueUploadFiles]
  )

  const handleUploadDragOver = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleUploadDragLeave = useCallback((event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault()
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return
    }
    setIsDragActive(false)
  }, [])

  const handleUploadDrop = useCallback(
    (event: ReactDragEvent<HTMLElement>) => {
      event.preventDefault()
      setIsDragActive(false)
      void queueUploadFiles(Array.from(event.dataTransfer.files || []))
    },
    [queueUploadFiles]
  )

  const handleCancelUpload = useCallback(
    (item: UploadQueueItem) => {
      if (!isUploadActive(item.status)) return
      if (activeJobsRef.current.has(item.id) || uploadControllersRef.current.has(item.id)) {
        userCancelledIdsRef.current.add(item.id)
      }
      cancelControllersRef.current.get(item.id)?.abort()
      uploadControllersRef.current.get(item.id)?.abort()
      const cancelMsg = language === "en" ? "Cancelled by user" : "사용자가 취소함"
      setUploadQueue((current) =>
        current.map((queueItem) =>
          queueItem.id === item.id
            ? { ...queueItem, status: "cancelled", progress: 0, message: cancelMsg }
            : queueItem
        )
      )
    },
    [language]
  )

  const handleClearFinishedUploads = useCallback(() => {
    setUploadQueue((current) => current.filter((item) => isUploadActive(item.status)))
  }, [])

  const handleRetryUpload = useCallback(
    (item: UploadQueueItem) => {
      if (item.status !== "failed" && item.status !== "cancelled") return
      userCancelledIdsRef.current.delete(item.id)
      const waitMsg = language === "en" ? "Queued" : "업로드 대기 중"
      setUploadQueue((current) =>
        current.map((queueItem) =>
          queueItem.id === item.id
            ? {
                ...queueItem,
                status: "queued",
                progress: 0,
                loadedBytes: 0,
                speedBps: 0,
                etaSeconds: null,
                message: waitMsg,
                retryCount: (queueItem.retryCount ?? 0) + 1,
              }
            : queueItem
        )
      )
    },
    [language]
  )

  return {
    uploadQueue,
    uploadInputRef,
    activeUploadCount,
    completedUploadCount,
    aggregateProgress,
    isDragActive,
    setIsDragActive,
    queueUploadFiles,
    handleUploadSelect,
    handleUploadDragOver,
    handleUploadDragLeave,
    handleUploadDrop,
    handleCancelUpload,
    handleClearFinishedUploads,
    handleRetryUpload,
  }
}

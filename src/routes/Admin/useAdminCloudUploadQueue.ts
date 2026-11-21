// 참조 구현: transloadit/uppy (MIT) — Uppy 스타일 병렬 업로드 큐 훅 (동시성 3, 합산 진행률, 진행률 스래싱 방지 스케줄러)
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
import {
  uploadCloudFile,
  type CloudFile,
} from "src/apis/backend/cloud"
import { resolveCloudErrorMessage } from "./AdminCloudPreviewDrawer"
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
  const queryClient = useQueryClient()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map())
  const activeJobsRef = useRef<Set<string>>(new Set())

  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [isDragActive, setIsDragActive] = useState(false)

  const uploadQueueRef = useRef(uploadQueue)
  uploadQueueRef.current = uploadQueue

  const callbacksRef = useRef({ onNotice, onUploadSuccess, queryClient })
  callbacksRef.current = { onNotice, onUploadSuccess, queryClient }

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

  // XHR progress 퍼센트 틱마다 스케줄러 useEffect가 재실행되지 않도록 상태 전이 키만 추출한다.
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

  // 컴포넌트 언마운트 시 모든 활성 업로드 Abort
  useEffect(() => {
    const controllers = uploadControllersRef.current
    return () => {
      controllers.forEach((controller) => controller.abort())
      controllers.clear()
    }
  }, [])

  // 동시 업로드 스케줄러 (최대 MAX_CONCURRENT_CLOUD_UPLOADS = 3 동시 실행)
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
      uploadControllersRef.current.set(nextUpload.id, controller)

      setUploadQueue((current) =>
        current.map((item) =>
          item.id === nextUpload.id
            ? { ...item, status: "uploading", progress: 10, message: "업로드 시작 중" }
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
            if (!doesCloudFileMatchFilters(displayUploaded, cachedFilters.filter, cachedFilters.keyword)) return
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
              onProgress: ({ progress, message }) => {
                setUploadQueue((current) =>
                  applyUploadQueueProgress(current, nextUpload.id, progress, message)
                )
              },
            }
          )

          if (controller.signal.aborted) {
            throw new DOMException("Upload aborted", "AbortError")
          }

          const displayUploaded = preferClientFilenameForUploadedFile(uploaded, nextUpload.name)
          updateCachedFileQueries(displayUploaded)
          callbacksRef.current.onUploadSuccess(displayUploaded)
          callbacksRef.current.onNotice("")
          setUploadQueue((current) => applyUploadQueueSuccess(current, nextUpload.id, displayUploaded.id))
          void callbacksRef.current.queryClient.invalidateQueries({ queryKey: [CLOUD_QUERY_KEY] })
          void callbacksRef.current.queryClient.invalidateQueries({ queryKey: [CLOUD_FACETS_QUERY_KEY] })
        } catch (error) {
          const aborted = controller.signal.aborted || isAbortLikeError(error)
          const failureMessage = aborted ? "사용자가 취소함" : resolveCloudErrorMessage(error)
          callbacksRef.current.onNotice(
            aborted ? `${nextUpload.name} 업로드 취소` : `${nextUpload.name} 업로드 실패: ${failureMessage}`
          )
          setUploadQueue((current) => applyUploadQueueFailure(current, nextUpload.id, aborted, failureMessage))
        } finally {
          uploadControllersRef.current.delete(nextUpload.id)
          activeJobsRef.current.delete(nextUpload.id)
        }
      }

      void run()
    }
  }, [queueScheduleKey])

  const queueUploadFiles = useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) return

      const validFiles: File[] = []
      for (const file of selectedFiles) {
        const validation = await validateCloudFileBeforeUpload(file)
        if (!validation.ok) {
          onToast({ tone: "error", text: `${file.name}: ${validation.reason}` })
          continue
        }
        validFiles.push(file)
      }

      if (validFiles.length === 0) return

      setUploadQueue((current) => [
        ...current,
        ...validFiles.map((file) => createUploadQueueItem(file, activeFolderPath)),
      ])
    },
    [activeFolderPath, onToast]
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
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
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

  const handleCancelUpload = useCallback((item: UploadQueueItem) => {
    if (!isUploadActive(item.status)) return
    uploadControllersRef.current.get(item.id)?.abort()
    setUploadQueue((current) =>
      current.map((queueItem) =>
        queueItem.id === item.id
          ? { ...queueItem, status: "cancelled", progress: 0, message: "사용자가 취소함" }
          : queueItem
      )
    )
  }, [])

  const handleClearFinishedUploads = useCallback(() => {
    setUploadQueue((current) => current.filter((item) => isUploadActive(item.status)))
  }, [])

  const handleRetryUpload = useCallback((item: UploadQueueItem) => {
    if (item.status !== "failed" && item.status !== "cancelled") return
    setUploadQueue((current) =>
      current.map((queueItem) =>
        queueItem.id === item.id
          ? {
              ...queueItem,
              status: "queued",
              progress: 0,
              message: "업로드 대기 중",
              retryCount: (queueItem.retryCount ?? 0) + 1,
            }
          : queueItem
      )
    )
  }, [])

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

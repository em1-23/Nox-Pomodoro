import { useEffect, useRef, useState } from "react"

const itemsStorageKey = "Items"
const sourceStorageKey = "npomodoro.taskSources"
const databaseName = "npomodoro.source"
const databaseVersion = 1
const pdfStoreName = "files"

function readTasks() {
  try {
    const savedItems = JSON.parse(window.localStorage.getItem(itemsStorageKey) ?? "[]")
    if (!Array.isArray(savedItems)) throw new Error("Saved tasks must be an array.")

    return savedItems.filter((item) => item && typeof item.id === "string")
  } catch (error) {
    console.error("Could not load tasks for source linking.", error)
    return []
  }
}

function loadTaskSources() {
  try {
    const savedSources = JSON.parse(window.localStorage.getItem(sourceStorageKey) ?? "{}")
    if (!savedSources || Array.isArray(savedSources) || typeof savedSources !== "object") {
      throw new Error("Saved task sources must be an object.")
    }
    return Object.fromEntries(
      Object.entries(savedSources)
        .filter(([, source]) =>
          source && typeof source === "object"
          && (source.notes === undefined || typeof source.notes === "string")
          && (source.videoLink === undefined || typeof source.videoLink === "string"),
        )
        .map(([taskId, source]) => [taskId, {
          notes: source.notes ?? "",
          videoLink: source.videoLink ?? "",
        }]),
    )
  } catch (error) {
    console.error("Could not load saved task sources.", error)
    return {}
  }
}

function openSourceDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not available in this browser."))
      return
    }

    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(pdfStoreName)) {
        request.result.createObjectStore(pdfStoreName)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open local file storage."))
  })
}

async function getSavedPdf(taskId) {
  const database = await openSourceDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(pdfStoreName, "readonly")
    const request = transaction.objectStore(pdfStoreName).get(`task:${taskId}`)
    let record
    request.onsuccess = () => {
      record = request.result
    }
    transaction.oncomplete = () => {
      database.close()
      resolve(record)
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Could not read the saved PDF."))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error("Reading the saved PDF was aborted."))
    }
  })
}

async function savePdf(taskId, record) {
  const database = await openSourceDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(pdfStoreName, "readwrite")
    transaction.objectStore(pdfStoreName).put(record, `task:${taskId}`)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Could not save the PDF locally."))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error("Saving the PDF was aborted."))
    }
  })
}

async function deleteSavedPdf(taskId) {
  const database = await openSourceDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(pdfStoreName, "readwrite")
    transaction.objectStore(pdfStoreName).delete(`task:${taskId}`)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Could not delete the saved PDF."))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error("Deleting the PDF was aborted."))
    }
  })
}

function getYoutubeEmbedUrl(value) {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase()
    const supportedHosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]
    if (!["http:", "https:"].includes(url.protocol) || !supportedHosts.includes(host)) return null

    const videoId = host.endsWith("youtu.be")
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v")
        ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]

    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null
    return `https://www.youtube-nocookie.com/embed/${videoId}`
  } catch {
    return null
  }
}

function SourceSection() {
  const [initialTasks] = useState(readTasks)
  const [tasks, setTasks] = useState(initialTasks)
  const [taskSources, setTaskSources] = useState(loadTaskSources)
  const [selectedTaskId, setSelectedTaskId] = useState(initialTasks[0]?.id ?? "")
  const [videoLink, setVideoLink] = useState("")
  const [videoEmbedUrl, setVideoEmbedUrl] = useState("")
  const [videoError, setVideoError] = useState("")
  const [storageError, setStorageError] = useState("")
  const [pdf, setPdf] = useState(null)
  const pdfUrlRef = useRef(null)
  const taskSourcesRef = useRef(taskSources)
  const taskIdsRef = useRef(initialTasks.map((task) => task.id))

  useEffect(() => {
    function handleItemsChanged(event) {
      const nextTasks = Array.isArray(event.detail?.items) ? event.detail.items : []
      const nextTaskIds = nextTasks.map((task) => task.id)
      const removedTaskIds = taskIdsRef.current.filter((id) => !nextTaskIds.includes(id))
      taskIdsRef.current = nextTaskIds
      setTasks(nextTasks)
      setSelectedTaskId((currentId) =>
        nextTasks.some((task) => task.id === currentId) ? currentId : nextTasks[0]?.id ?? "",
      )

      if (removedTaskIds.length > 0) {
        setTaskSources((currentSources) => {
          const nextSources = { ...currentSources }
          removedTaskIds.forEach((id) => delete nextSources[id])
          return nextSources
        })
        removedTaskIds.forEach((id) => {
          deleteSavedPdf(id).catch((error) => {
            console.error("Could not remove a deleted task's PDF.", error)
          })
        })
      }
    }

    window.addEventListener("pomodoro:items-changed", handleItemsChanged)
    return () => window.removeEventListener("pomodoro:items-changed", handleItemsChanged)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(sourceStorageKey, JSON.stringify(taskSources))
      setStorageError("")
    } catch (error) {
      console.error("Could not save task sources locally.", error)
      setStorageError("تعذر حفظ الملاحظات أو روابط المصادر على هذا الجهاز.")
    }
  }, [taskSources])

  useEffect(() => {
    taskSourcesRef.current = taskSources
  }, [taskSources])

  useEffect(() => {
    const savedSource = taskSourcesRef.current[selectedTaskId]
    const savedVideoLink = savedSource?.videoLink ?? ""
    setVideoLink(savedVideoLink)
    setVideoEmbedUrl(getYoutubeEmbedUrl(savedVideoLink) ?? "")
    setVideoError("")
  }, [selectedTaskId])

  useEffect(() => {
    let isActive = true
    setPdf(null)
    setStorageError("")

    if (!selectedTaskId) return () => {
      isActive = false
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = null
    }

    async function restorePdf() {
      try {
        const savedPdf = await getSavedPdf(selectedTaskId)
        if (!isActive || !savedPdf) return
        if (!(savedPdf.blob instanceof Blob) || typeof savedPdf.name !== "string") {
          throw new Error("The locally saved PDF has an invalid format.")
        }

        const url = URL.createObjectURL(savedPdf.blob)
        pdfUrlRef.current = url
        setPdf({ taskId: selectedTaskId, name: savedPdf.name, url })
      } catch (error) {
        console.error("Could not restore the task PDF from local storage.", error)
        if (isActive) setStorageError("تعذر فتح ملف PDF المحفوظ على هذا الجهاز.")
      }
    }

    restorePdf()
    return () => {
      isActive = false
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = null
    }
  }, [selectedTaskId])

  function updateSelectedSource(updates) {
    if (!selectedTaskId) return

    setTaskSources((currentSources) => ({
      ...currentSources,
      [selectedTaskId]: {
        ...currentSources[selectedTaskId],
        ...updates,
      },
    }))
  }

  function showVideo(event) {
    event.preventDefault()
    const embedUrl = getYoutubeEmbedUrl(videoLink)
    if (!embedUrl) {
      setVideoError("أدخل رابط فيديو YouTube صحيحًا.")
      setVideoEmbedUrl("")
      return
    }

    setVideoError("")
    setVideoEmbedUrl(embedUrl)
    updateSelectedSource({ videoLink: videoLink.trim() })
  }

  async function selectPdf(event) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ""

    if (!selectedTaskId) {
      setStorageError("Add Task To Connect The PDF With It")
      return
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStorageError("Only Pdf")
      return
    }

    const taskId = selectedTaskId
    const url = URL.createObjectURL(file)
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    pdfUrlRef.current = url
    setPdf({ taskId, name: file.name, url })
    setStorageError("")

    try {
      await savePdf(taskId, { name: file.name, blob: file })
    } catch (error) {
      console.error("Could not save the task PDF locally.", error)
      setStorageError("File Is Open For View And can't Save It In The Storage")
    }
  }

  async function removePdf() {
    if (!selectedTaskId) return
    const taskId = selectedTaskId

    try {
      await deleteSavedPdf(taskId)
      if (selectedTaskId === taskId) {
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
        pdfUrlRef.current = null
        setPdf(null)
        setStorageError("")
      }
    } catch (error) {
      console.error("Could not delete the task PDF locally.", error)
      setStorageError("Can't Delete The Saved Pdf")
    }
  }

  const selectedSource = taskSources[selectedTaskId] ?? {}
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)

  return (
    <section aria-labelledby="source-title" className="Section SourceSection">
      <div className="SourceHeader">
        <h2 id="source-title">Source</h2>
        <p>Connect A Video , Pdf , Notes With A Task Every Thing Ofline</p>
        <p>Youtube Video Play In The Page And Need A Internet</p>
      </div>

      {tasks.length > 0 ? (
        <label className="SourceTaskPicker">
          Connect Task With The Source
          <select
            aria-label="Task linked to source"
            onChange={(event) => setSelectedTaskId(event.target.value)}
            value={selectedTaskId}
          >
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.content}</option>
            ))}
          </select>
        </label>
      ) : (
        <p className="SourceEmpty">Add A Task To Connect It</p>
      )}

      {storageError && <p className="SourceError" role="alert">{storageError}</p>}

      <div className="SourceGrid">
        <section className="SourceCard">
          <h3>YouTube</h3>
          <form className="SourceVideoForm" onSubmit={showVideo}>
            <label htmlFor="source-youtube-link">Video Link</label>
            <div className="SourceInputRow">
              <input
                autoComplete="url"
                disabled={!selectedTask}
                id="source-youtube-link"
                onChange={(event) => setVideoLink(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
                value={videoLink}
              />
              <button className="Button" disabled={!selectedTask} type="submit">View</button>
            </div>
          </form>
          {videoError && <p className="SourceError" role="alert">{videoError}</p>}
          {videoEmbedUrl && (
            <div className="SourceVideoFrame">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                src={videoEmbedUrl}
                title={`YouTube video for ${selectedTask?.content ?? "task"}`}
              />
            </div>
          )}
        </section>

        <section className="SourceCard">
          <h3>Notes</h3>
          <label className="SourceNotesLabel" htmlFor="source-notes">
            Notes (Saved Local)
          </label>
          <textarea
            disabled={!selectedTask}
            id="source-notes"
            onChange={(event) => updateSelectedSource({ notes: event.target.value })}
            placeholder="Notes Here .."
            rows="10"
            value={selectedSource.notes ?? ""}
          />
        </section>

        <section className="SourceCard SourcePdfCard">
          <h3>PDF</h3>
          <label className="SourceFileLabel" htmlFor="source-pdf">
            Choose A Pdf File Form Your Devise
          </label>
          <input
            accept="application/pdf,.pdf"
            disabled={!selectedTask}
            id="source-pdf"
            onChange={selectPdf}
            type="file"
          />
          {pdf?.taskId === selectedTaskId && (
            <>
              <div className="SourcePdfHeader">
                <span>{pdf.name}</span>
                <button className="Button" onClick={removePdf} type="button">حذف الملف</button>
              </div>
              <iframe
                className="SourcePdfFrame"
                src={pdf.url}
                title={`PDF preview for ${selectedTask?.content ?? "task"}`}
              />
            </>
          )}
        </section>
      </div>
    </section>
  )
}

export default SourceSection
import { useEffect, useState } from "react"

const storageKey = "Items"
const timerStorageKey = "npomodoro.timer"

function loadWorkDurationMinutes() {
  try {
    const savedTimer = JSON.parse(window.localStorage.getItem(timerStorageKey) ?? "{}")
    const duration = savedTimer.durations?.work ?? savedTimer.workDurationMinutes
    return Number.isSafeInteger(duration) && duration > 0 ? duration : 25
  } catch (error) {
    console.error("Could not load the saved work-session duration.", error)
    return 25
  }
}

function normalizeItem(item, index) {
  const content = item.Content ?? item.content
  if (typeof content !== "string") {
    throw new Error(`Saved item at index ${index} has invalid content.`)
  }

  const sessionsRequired = item.sessionsRequired ?? 1
  const legacyCompleted = item.status === "Done" ? sessionsRequired : 0
  const sessionsCompleted = item.sessionsCompleted ?? legacyCompleted
  if (!Number.isSafeInteger(sessionsRequired) || sessionsRequired < 1
    || !Number.isSafeInteger(sessionsCompleted) || sessionsCompleted < 0) {
    throw new Error(`Saved item at index ${index} has invalid session progress.`)
  }

  return {
    id: item.id ?? `${index}-${content}`,
    content,
    sessionsRequired,
    sessionsCompleted: Math.min(sessionsCompleted, sessionsRequired),
  }
}

function loadItems() {
  try {
    const savedItems = window.localStorage.getItem(storageKey)
    if (!savedItems) return { items: [], error: null }

    const parsedItems = JSON.parse(savedItems)
    if (!Array.isArray(parsedItems)) {
      throw new Error("Saved items must be an array.")
    }

    return { items: parsedItems.map(normalizeItem), error: null }
  } catch (error) {
    console.error("Could not load saved tasks.", error)
    return { items: [], error: "تعذر تحميل المهام المحفوظة." }
  }
}

function ListSection() {
  const [initialData] = useState(loadItems)
  const [items, setItems] = useState(initialData.items)
  const [newItem, setNewItem] = useState("")
  const [sessionsInput, setSessionsInput] = useState("1")
  const [storageError, setStorageError] = useState(initialData.error)
  const [workDurationMinutes, setWorkDurationMinutes] = useState(loadWorkDurationMinutes)

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items))
      setStorageError(null)
    } catch (error) {
      console.error("Could not save tasks to local storage.", error)
      setStorageError("تعذر حفظ المهام في التخزين المحلي.")
    }
  }, [items])

  useEffect(() => {
    function handleTimerSettingsChange(event) {
      const duration = event.detail?.workDurationMinutes
      if (Number.isSafeInteger(duration) && duration > 0) {
        setWorkDurationMinutes(duration)
      }
    }

    window.addEventListener("pomodoro:timer-settings-changed", handleTimerSettingsChange)
    return () => window.removeEventListener("pomodoro:timer-settings-changed", handleTimerSettingsChange)
  }, [])

  useEffect(() => {
    function handleWorkSessionCompleted() {
      const nextTask = items.find((item) => item.sessionsCompleted < item.sessionsRequired)

      if (!nextTask) {
        window.dispatchEvent(new CustomEvent("pomodoro:notification", {
          detail: {
            style: "Success",
            content: items.length === 0
              ? "اكتملت جلسة التركيز. أضف مهمة لبدء متابعة التقدم."
              : "اكتملت جلسة التركيز، وجميع المهام مكتملة بالفعل.",
          },
        }))
        return
      }

      const completedSessions = nextTask.sessionsCompleted + 1
      const taskCompleted = completedSessions === nextTask.sessionsRequired
      setItems(items.map((item) =>
        item.id === nextTask.id ? { ...item, sessionsCompleted: completedSessions } : item,
      ))
      window.dispatchEvent(new CustomEvent("pomodoro:notification", {
        detail: {
          style: "Success",
          content: taskCompleted
            ? `اكتملت المهمة "${nextTask.content}".`
            : `اكتملت جلسة للمهمة "${nextTask.content}" (${completedSessions}/${nextTask.sessionsRequired}).`,
        },
      }))
    }

    window.addEventListener("pomodoro:work-session-completed", handleWorkSessionCompleted)
    return () => window.removeEventListener("pomodoro:work-session-completed", handleWorkSessionCompleted)
  }, [items])

  function addItem(event) {
    event.preventDefault()
    const content = newItem.trim()
    const sessionsRequired = Number(sessionsInput)
    if (!content || !Number.isSafeInteger(sessionsRequired) || sessionsRequired < 1) return

    setItems((currentItems) => [
      ...currentItems,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        sessionsRequired,
        sessionsCompleted: 0,
      },
    ])
    setNewItem("")
    setSessionsInput("1")
  }

  function deleteItem(id) {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id))
  }

  const totalSessions = items.reduce((total, item) => total + item.sessionsRequired, 0)
  const completedSessions = items.reduce(
    (total, item) => total + item.sessionsCompleted,
    0,
  )
  const completedItems = items.filter(
    (item) => item.sessionsCompleted === item.sessionsRequired,
  ).length
  const estimatedFocusMinutes = totalSessions * workDurationMinutes
  const estimatedHours = Math.floor(estimatedFocusMinutes / 60)
  const estimatedMinutes = estimatedFocusMinutes % 60

  return (
    <div className="Section ListSection">
      <div className="Head">
        <div className="Name">
          <i className="fa-solid fa-list-check"></i>
          <h3>Tasks Dashboard</h3>
        </div>
        <span className="Items">List Items : {items.length}</span>
      </div>
      <div className="AddItemsAndLinks">
        <form className="Flex AddItems" onSubmit={addItem}>
          <input
            aria-label="Task name"
            onChange={(event) => setNewItem(event.target.value)}
            placeholder="Add Items"
            required
            type="text"
            value={newItem}
          />
          <input
            aria-label="Required work sessions"
            min="1"
            onChange={(event) => setSessionsInput(event.target.value)}
            placeholder="Sessions"
            required
            step="1"
            type="number"
            value={sessionsInput}
          />
          <button aria-label="Add task" className="Button Icon" type="submit">
            <i className="fa-solid fa-plus"></i>
          </button>
        </form>
      </div>
      {storageError && <p role="alert">{storageError}</p>}
      <div className="Body">
        {items.length > 0 ? items.map((item) => {
          const taskCompleted = item.sessionsCompleted === item.sessionsRequired
          return (
            <div className="TaskItem" key={item.id}>
              <span className={taskCompleted ? "TaskContent Done" : "TaskContent"}>
                {item.content}
              </span>
              <span className="TaskSessions">
                Sessions: {item.sessionsCompleted} / {item.sessionsRequired}
              </span>
              <button
                aria-label={`Delete ${item.content}`}
                className="DeleteTask"
                onClick={() => deleteItem(item.id)}
                type="button"
              >
                <i className="fa-solid fa-trash"></i>
              </button>
            </div>
          )
        }) : (
          <div className="ContentEmpaty">
            <i className="fa-regular fa-clipboard"></i>
            No tasks found
          </div>
        )}
      </div>
      <div aria-label="Task progress" className="TaskProgress">
        <h4>Progress</h4>
        <p>Completed tasks: {completedItems} / {items.length}</p>
        <progress
          aria-label="Completed work-session progress"
          max={totalSessions || 1}
          value={completedSessions}
        />
        <p>Work sessions: {completedSessions} / {totalSessions}</p>
        <p>Estimated focus time: {estimatedHours}h {estimatedMinutes}m</p>
      </div>
    </div>
  )
}

export default ListSection

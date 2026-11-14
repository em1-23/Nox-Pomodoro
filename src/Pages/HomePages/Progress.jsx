import { useEffect, useState } from "react"

const storageKey = "npomodoro.dailyProgress"
const historyStorageKey = "npomodoro.sessionHistory"
const historyDays = 7

function getLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getLastDays(today) {
  return Array.from({ length: historyDays }, (_, index) => {
    const date = new Date(`${today}T12:00:00`)
    date.setDate(date.getDate() - (historyDays - index - 1))
    return {
      key: getLocalDateKey(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
      dateLabel: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date),
    }
  })
}

function loadProgress() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}")
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      throw new Error("Saved daily progress must be an object.")
    }

    const entries = Object.entries(stored).filter(([date, value]) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date)
      && value
      && Number.isSafeInteger(value.sessions)
      && value.sessions >= 0
      && Number.isSafeInteger(value.focusMinutes)
      && value.focusMinutes >= 0,
    )
    return { progress: Object.fromEntries(entries), error: null }
  } catch (error) {
    console.error("Could not load daily Pomodoro progress.", error)
    return { progress: {}, error: "Could not load saved daily progress." }
  }
}

function loadSessionHistory() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(historyStorageKey) ?? "[]")
    if (!Array.isArray(stored)) {
      throw new Error("Saved session history must be an array.")
    }

    const sessions = stored.filter((session) =>
      session
      && typeof session.id === "string"
      && Number.isSafeInteger(session.durationMinutes)
      && session.durationMinutes > 0
      && Number.isFinite(Date.parse(session.completedAt))
      && (session.taskId === null || typeof session.taskId === "string")
      && (session.taskName === null || typeof session.taskName === "string"),
    )
    return { sessions, error: null }
  } catch (error) {
    console.error("Could not load Pomodoro session history.", error)
    return { sessions: [], error: "Could not load detailed session history." }
  }
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) return `${remainingMinutes}m`
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`
}

function Progress() {
  const [initialData] = useState(loadProgress)
  const [initialHistory] = useState(loadSessionHistory)
  const [dailyProgress, setDailyProgress] = useState(initialData.progress)
  const [sessionHistory, setSessionHistory] = useState(initialHistory.sessions)
  const [storageError, setStorageError] = useState(initialData.error)
  const [historyStorageError, setHistoryStorageError] = useState(initialHistory.error)
  const [today, setToday] = useState(() => getLocalDateKey(new Date()))
  const [expandedDay, setExpandedDay] = useState(null)
  const [hoveredSessionId, setHoveredSessionId] = useState(null)
  const [pinnedSessionId, setPinnedSessionId] = useState(null)

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(dailyProgress))
      setStorageError("")
    } catch (error) {
      console.error("Could not save daily Pomodoro progress.", error)
      setStorageError("Could not save daily progress on this device.")
    }
  }, [dailyProgress])

  useEffect(() => {
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(sessionHistory))
      setHistoryStorageError("")
    } catch (error) {
      console.error("Could not save Pomodoro session history.", error)
      setHistoryStorageError("Could not save detailed session history on this device.")
    }
  }, [sessionHistory])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setToday(getLocalDateKey(new Date()))
    }, 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    function handleWorkSessionRecorded(event) {
      const { durationMinutes, completedAt, taskId, taskName } = event.detail ?? {}
      if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1
        || !Number.isFinite(Date.parse(completedAt))
        || (taskId !== null && typeof taskId !== "string")
        || (taskName !== null && typeof taskName !== "string")) {
        console.error("Completed work session did not provide valid history details.")
        return
      }

      const date = getLocalDateKey(new Date(completedAt))
      setDailyProgress((currentProgress) => {
        const currentDay = currentProgress[date] ?? { sessions: 0, focusMinutes: 0 }
        return {
          ...currentProgress,
          [date]: {
            sessions: currentDay.sessions + 1,
            focusMinutes: currentDay.focusMinutes + durationMinutes,
          },
        }
      })
      setSessionHistory((currentHistory) => [
        ...currentHistory,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          durationMinutes,
          completedAt,
          taskId,
          taskName,
        },
      ])
      setToday(date)
    }

    window.addEventListener("pomodoro:work-session-recorded", handleWorkSessionRecorded)
    return () => window.removeEventListener("pomodoro:work-session-recorded", handleWorkSessionRecorded)
  }, [])

  const days = getLastDays(today)
  const dayCounts = days.map((day) => dailyProgress[day.key]?.sessions ?? 0)
  const todayStats = dailyProgress[today] ?? { sessions: 0, focusMinutes: 0 }
  const weeklySessions = dayCounts.reduce((sum, count) => sum + count, 0)
  const todayHours = Math.floor(todayStats.focusMinutes / 60)
  const todayMinutes = todayStats.focusMinutes % 60
  const sessionsByDay = new Map(days.map((day) => [
    day.key,
    sessionHistory
      .filter((session) => getLocalDateKey(new Date(session.completedAt)) === day.key)
      .sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt)),
  ]))

  return (
    <section aria-labelledby="daily-progress-title" className="Section ProgressSection">
      <header className="ProgressHeader">
        <h2 id="daily-progress-title">Daily Progress</h2>
        <p>Your focus, mapped into a personal session network.</p>
      </header>

      {(storageError || historyStorageError) && (
        <p className="ProgressError" role="alert">{storageError || historyStorageError}</p>
      )}

      <div className="ProgressStats">
        <article className="ProgressStat">
          <span>Today&apos;s sessions</span>
          <strong>{todayStats.sessions}</strong>
        </article>
        <article className="ProgressStat">
          <span>Focus time today</span>
          <strong>{todayHours}h {todayMinutes}m</strong>
        </article>
        <article className="ProgressStat">
          <span>Sessions this week</span>
          <strong>{weeklySessions}</strong>
        </article>
      </div>

      <div aria-label={`Focus session network for the last ${historyDays} days`} className="ProgressTree">
        <div className="ProgressBrainNode">
          <span aria-hidden="true" className="ProgressBrainIcon">
            <i className="fa-solid fa-brain"></i>
          </span>
          <span>
            <strong>Focus Network</strong>
            <small>Last 7 days</small>
          </span>
        </div>

        <div className="ProgressDayBranches">
          {days.map((day) => {
            const sessions = sessionsByDay.get(day.key) ?? []
            const totalSessions = dailyProgress[day.key]?.sessions ?? 0
            const totalMinutes = dailyProgress[day.key]?.focusMinutes ?? 0
            const untrackedSessions = Math.max(0, totalSessions - sessions.length)
            const isExpanded = expandedDay === day.key
            const dayId = `progress-sessions-${day.key}`

            return (
              <article
                className={`ProgressDayBranch ${isExpanded ? "is-expanded" : ""}`}
                key={day.key}
                onMouseEnter={() => setExpandedDay(day.key)}
                onMouseLeave={() => setExpandedDay((current) => current === day.key ? null : current)}
              >
                <button
                  aria-controls={dayId}
                  aria-expanded={isExpanded}
                  className="ProgressDayTrigger"
                  onClick={() => setExpandedDay((current) => current === day.key ? null : day.key)}
                  type="button"
                >
                  <span aria-hidden="true" className="ProgressBranchDot" />
                  <span className="ProgressDayCopy">
                    <strong>{day.label} <span>{day.dateLabel}</span></strong>
                    <small>{totalSessions} sessions · {formatDuration(totalMinutes)}</small>
                  </span>
                  <i aria-hidden="true" className={`fa-solid ${isExpanded ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
                </button>

                {isExpanded && (
                  <div className="ProgressSessionBranches" id={dayId}>
                    {sessions.map((session) => {
                      const isActive = hoveredSessionId === session.id || pinnedSessionId === session.id
                      const completedDate = new Date(session.completedAt)
                      const dateTimeLabel = new Intl.DateTimeFormat(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(completedDate)

                      return (
                        <button
                          aria-label={`${session.taskName ?? "No task linked"}, ${formatDuration(session.durationMinutes)}, ${dateTimeLabel}`}
                          className={`ProgressSessionNode ${isActive ? "is-active" : ""}`}
                          key={session.id}
                          onBlur={() => setHoveredSessionId(null)}
                          onClick={() => setPinnedSessionId((current) => current === session.id ? null : session.id)}
                          onFocus={() => setHoveredSessionId(session.id)}
                          onMouseEnter={() => setHoveredSessionId(session.id)}
                          onMouseLeave={() => setHoveredSessionId(null)}
                          type="button"
                        >
                          <span aria-hidden="true" className="ProgressSessionDot" />
                          <span className="ProgressSessionSummary">
                            <strong>{session.taskName ?? "No task linked"}</strong>
                            <small>{formatDuration(session.durationMinutes)} · {dateTimeLabel}</small>
                          </span>
                          {isActive && (
                            <span className="ProgressSessionDetails">
                              <strong>{session.taskName ?? "No task linked"}</strong>
                              <span>Focus time: {formatDuration(session.durationMinutes)}</span>
                              <time dateTime={session.completedAt}>{dateTimeLabel}</time>
                            </span>
                          )}
                        </button>
                      )
                    })}

                    {untrackedSessions > 0 && (
                      <p className="ProgressUntracked">
                        {untrackedSessions} earlier {untrackedSessions === 1 ? "session has" : "sessions have"} totals only; task and completion time were not recorded.
                      </p>
                    )}
                    {sessions.length === 0 && untrackedSessions === 0 && (
                      <p className="ProgressEmpty">No completed work sessions on this day yet.</p>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </div>

      <p className="ProgressStorageNote">
        Session details are saved locally in this browser. Hover over or select a day branch, then a session, to explore it.
      </p>
    </section>
  )
}

export default Progress

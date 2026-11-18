import { useEffect, useState } from "react"

const storageKey = "npomodoro.dailyProgress"
const historyStorageKey = "npomodoro.sessionHistory"
const rangeStorageKey = "npomodoro.progressRange"
const retentionDays = 90
const ranges = [
  { key: "24h", label: "Last 24 hours", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
]
const networkWires = [
  "M 355 205 C 286 146 202 86 110 46",
  "M 445 205 C 514 146 598 86 690 46",
  "M 310 250 C 236 250 156 250 80 250",
  "M 490 250 C 564 250 644 250 720 250",
  "M 355 295 C 286 336 202 392 110 420",
  "M 445 295 C 514 336 598 392 690 420",
  "M 400 325 C 400 374 400 426 400 470",
]
const networkNodes = [
  [110, 46],
  [690, 46],
  [80, 250],
  [720, 250],
  [110, 420],
  [690, 420],
  [400, 470],
]

function getLocalDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getEarliestHistoryDate(date = new Date()) {
  const earliestDate = new Date(date)
  earliestDate.setHours(0, 0, 0, 0)
  earliestDate.setDate(earliestDate.getDate() - (retentionDays - 1))
  return getLocalDateKey(earliestDate)
}

function getLastDays(today, historyDays) {
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

    const earliestDate = getEarliestHistoryDate()
    const sessions = stored.filter((session) =>
      session
      && typeof session.id === "string"
      && Number.isSafeInteger(session.durationMinutes)
      && session.durationMinutes > 0
      && Number.isFinite(Date.parse(session.completedAt))
      && (session.taskId === null || typeof session.taskId === "string")
      && (session.taskName === null || typeof session.taskName === "string")
      && getLocalDateKey(new Date(session.completedAt)) >= earliestDate,
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

function buildDailySeries(sessionHistory, today, dayCount) {
  const days = getLastDays(today, dayCount)
  return days.map((day) => ({
    ...day,
    sessions: sessionHistory.filter(
      (session) => getLocalDateKey(new Date(session.completedAt)) === day.key,
    ).length,
    focusMinutes: sessionHistory
      .filter((session) => getLocalDateKey(new Date(session.completedAt)) === day.key)
      .reduce((sum, session) => sum + session.durationMinutes, 0),
  }))
}

function buildTrendPoints(series) {
  const width = 760
  const height = 300
  const left = 40
  const right = 20
  const top = 24
  const bottom = 48
  const maxValue = Math.max(60, ...series.map((point) => point.focusMinutes))
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom

  const points = series.map((point, index) => {
    const x = series.length === 1
      ? left + plotWidth / 2
      : left + (index / (series.length - 1)) * plotWidth
    const y = top + plotHeight - (point.focusMinutes / maxValue) * plotHeight
    return { x, y, ...point }
  })
  const line = points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
  ).join(" ")
  const area = points.length > 0
    ? `${line} L ${points.at(-1).x.toFixed(1)} ${top + plotHeight} L ${points[0].x.toFixed(1)} ${top + plotHeight} Z`
    : ""

  return { width, height, left, top, plotWidth, plotHeight, maxValue, points, line, area }
}

function Progress() {
  const [initialData] = useState(loadProgress)
  const [initialHistory] = useState(loadSessionHistory)
  const [dailyProgress, setDailyProgress] = useState(initialData.progress)
  const [sessionHistory, setSessionHistory] = useState(initialHistory.sessions)
  const [storageError, setStorageError] = useState(initialData.error)
  const [historyStorageError, setHistoryStorageError] = useState(initialHistory.error)
  const [today, setToday] = useState(() => getLocalDateKey(new Date()))
  const [selectedRange, setSelectedRange] = useState(() => {
    try {
      const savedRange = window.localStorage.getItem(rangeStorageKey)
      return ranges.some((range) => range.key === savedRange) ? savedRange : "7d"
    } catch {
      return "7d"
    }
  })
  const [hoveredDay, setHoveredDay] = useState(null)
  const [pinnedDay, setPinnedDay] = useState(null)
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
    try {
      window.localStorage.setItem(rangeStorageKey, selectedRange)
    } catch (error) {
      console.error("Could not save the selected progress range.", error)
    }
  }, [selectedRange])

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
      const earliestDate = getEarliestHistoryDate(new Date(completedAt))
      const recordedSession = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        durationMinutes,
        completedAt,
        taskId,
        taskName,
      }
      setSessionHistory((currentHistory) => [
        ...currentHistory.filter(
          (session) => getLocalDateKey(new Date(session.completedAt)) >= earliestDate,
        ),
        recordedSession,
      ])
      setToday(date)
    }

    window.addEventListener("pomodoro:work-session-recorded", handleWorkSessionRecorded)
    return () => window.removeEventListener("pomodoro:work-session-recorded", handleWorkSessionRecorded)
  }, [])

  const selectedRangeConfig = ranges.find((range) => range.key === selectedRange) ?? ranges[1]
  const days = getLastDays(today, selectedRangeConfig.days)
  const dayCounts = days.map((day) => dailyProgress[day.key]?.sessions ?? 0)
  const todayStats = dailyProgress[today] ?? { sessions: 0, focusMinutes: 0 }
  const weeklySessions = dayCounts.reduce((sum, count) => sum + count, 0)
  const weeklyFocusMinutes = days.reduce(
    (sum, day) => sum + (dailyProgress[day.key]?.focusMinutes ?? 0),
    0,
  )
  const todayHours = Math.floor(todayStats.focusMinutes / 60)
  const todayMinutes = todayStats.focusMinutes % 60
  const activeDay = hoveredDay ?? pinnedDay
  const sessionsByDay = new Map(days.map((day) => [day.key, []]))
  sessionHistory.forEach((session) => {
    const daySessions = sessionsByDay.get(getLocalDateKey(new Date(session.completedAt)))
    if (daySessions) daySessions.push(session)
  })
  sessionsByDay.forEach((daySessions) => {
    daySessions.sort((first, second) => Date.parse(second.completedAt) - Date.parse(first.completedAt))
  })

  const cutoff24h = Date.now() - 24 * 60 * 60 * 1000
  const sessions24h = sessionHistory.filter(
    (session) => Date.parse(session.completedAt) >= cutoff24h,
  )
  const hourlySegments = [0, 0, 0, 0]
  sessions24h.forEach((session) => {
    const hoursAgo = (Date.now() - Date.parse(session.completedAt)) / (60 * 60 * 1000)
    const segment = Math.min(3, Math.max(0, Math.floor(hoursAgo / 6)))
    hourlySegments[3 - segment] += session.durationMinutes
  })
  const total24hMinutes = hourlySegments.reduce((sum, minutes) => sum + minutes, 0)
  const segmentPercentages = hourlySegments.map((minutes) =>
    total24hMinutes > 0 ? (minutes / total24hMinutes) * 100 : 0,
  )
  const segmentStarts = [0]
  segmentPercentages.forEach((percentage) => {
    segmentStarts.push(segmentStarts.at(-1) + percentage)
  })
  const donutGradient = total24hMinutes > 0
    ? `conic-gradient(
        var(--SpecialColor) 0 ${segmentStarts[1]}%,
        color-mix(in srgb, var(--SpecialColor) 72%, var(--MainColor)) ${segmentStarts[1]}% ${segmentStarts[2]}%,
        color-mix(in srgb, var(--SpecialColor) 44%, var(--MainColor)) ${segmentStarts[2]}% ${segmentStarts[3]}%,
        color-mix(in srgb, var(--SpecialColor) 24%, var(--MainColor)) ${segmentStarts[3]}% ${segmentStarts[4]}%
      )`
    : "conic-gradient(color-mix(in srgb, var(--MainColor) 12%, transparent) 0 100%)"

  const trendSeries = buildDailySeries(sessionHistory, today, selectedRangeConfig.days)
  const trend = buildTrendPoints(trendSeries)

  return (
    <section aria-labelledby="daily-progress-title" className="Section ProgressSection">
      <header className="ProgressHeader">
        <h2 id="daily-progress-title">Daily Progress</h2>
        <p>Your focus, mapped into a personal session network.</p>
      </header>

      <div aria-label="Progress date range" className="ProgressRangePicker">
        {ranges.map((range) => (
          <button
            aria-pressed={selectedRange === range.key}
            className={selectedRange === range.key ? "is-active" : ""}
            key={range.key}
            onClick={() => setSelectedRange(range.key)}
            type="button"
          >
            {range.label}
          </button>
        ))}
      </div>

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
          <span>{selectedRangeConfig.label}</span>
          <strong>{trendSeries.reduce((sum, point) => sum + point.sessions, 0)}</strong>
        </article>
      </div>

      {selectedRange === "24h" && (
        <div className="ProgressDonutPanel">
          <div
            aria-label={`Focus time in the last 24 hours: ${formatDuration(total24hMinutes)}`}
            className="ProgressDonut"
            role="img"
            style={{ background: donutGradient }}
          >
            <div className="ProgressDonutCore">
              <strong>{formatDuration(total24hMinutes)}</strong>
              <span>{sessions24h.length} {sessions24h.length === 1 ? "session" : "sessions"}</span>
            </div>
          </div>
          <div className="ProgressDonutLegend">
            {[
              ["18–24h", hourlySegments[0]],
              ["12–18h", hourlySegments[1]],
              ["6–12h", hourlySegments[2]],
              ["0–6h", hourlySegments[3]],
            ].map(([label, minutes], index) => (
              <div key={label}>
                <span className={`ProgressLegendDot ProgressLegendDot--${index}`} />
                <strong>{label}</strong>
                <small>{formatDuration(minutes)}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {(selectedRange === "30d" || selectedRange === "90d") && (
        <div className="ProgressTrendPanel">
          <div className="ProgressTrendHeader">
            <div>
              <span>Focus trend</span>
              <strong>{formatDuration(trendSeries.reduce((sum, point) => sum + point.focusMinutes, 0))}</strong>
            </div>
            <span>{selectedRangeConfig.label}</span>
          </div>
          <svg
            aria-label={`Daily focus minutes over ${selectedRangeConfig.label.toLowerCase()}`}
            className="ProgressTrendChart"
            role="img"
            viewBox={`0 0 ${trend.width} ${trend.height}`}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = trend.top + trend.plotHeight * ratio
              return (
                <g key={ratio}>
                  <line className="ProgressTrendGrid" x1={trend.left} x2={trend.width - 20} y1={y} y2={y} />
                  <text className="ProgressTrendAxisLabel" x="2" y={y + 4}>
                    {formatDuration(Math.round(trend.maxValue * (1 - ratio)))}
                  </text>
                </g>
              )
            })}
            <path className="ProgressTrendArea" d={trend.area} />
            <path className="ProgressTrendLine" d={trend.line} />
            {trend.points.map((point, index) => (
              <g className="ProgressTrendPoint" key={point.key}>
                <circle cx={point.x} cy={point.y} r="5" />
                <title>{`${point.dateLabel}: ${formatDuration(point.focusMinutes)}, ${point.sessions} sessions`}</title>
                {(
                  selectedRange === "30d"
                    ? index % 5 === 0 || index === trend.points.length - 1
                    : index % 10 === 0 || index === trend.points.length - 1
                ) && (
                  <text
                    className="ProgressTrendDate"
                    textAnchor={index === 0 ? "start" : index === trend.points.length - 1 ? "end" : "middle"}
                    x={point.x}
                    y={trend.height - 16}
                  >
                    {point.dateLabel}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      )}

      {selectedRange === "7d" && (
      <div
        aria-label={`Focus session network for the last ${selectedRangeConfig.days} days`}
        className={`ProgressNetwork ${activeDay ? "has-active" : ""}`}
        data-active-day={activeDay ? days.findIndex((day) => day.key === activeDay) : ""}
        role="group"
      >
        <div aria-hidden="true" className="ProgressNetworkGrid" />
        <svg aria-hidden="true" className="ProgressCircuit" preserveAspectRatio="none" viewBox="0 0 800 500">
          {networkWires.map((wire, index) => {
            const day = days[index]
            return (
              <g className={`ProgressWireGroup ${activeDay === day.key ? "is-active" : ""}`} key={day.key}>
                <path className="ProgressWire" d={wire} />
                <circle className="ProgressWireNode" cx={networkNodes[index][0]} cy={networkNodes[index][1]} r="4" />
              </g>
            )
          })}
          <g className="ProgressMesh">
            <path d="M286 148 L246 118 L205 91 L164 68 M246 118 L272 91 M205 91 L183 116 M514 148 L554 118 L595 91 L636 68 M554 118 L528 91 M595 91 L617 116 M226 250 L181 224 L132 250 L181 276 Z M574 250 L619 224 L668 250 L619 276 Z M286 352 L246 382 L205 409 L164 432 M246 382 L272 409 M205 409 L183 384 M514 352 L554 382 L595 409 L636 432 M554 382 L528 409 M595 409 L617 384 M400 378 L400 426" />
            <circle cx="286" cy="148" r="3" /><circle cx="246" cy="118" r="3" />
            <circle cx="205" cy="91" r="3" /><circle cx="164" cy="68" r="3" />
            <circle cx="272" cy="91" r="2.5" /><circle cx="183" cy="116" r="2.5" />
            <circle cx="514" cy="148" r="3" /><circle cx="554" cy="118" r="3" />
            <circle cx="595" cy="91" r="3" /><circle cx="636" cy="68" r="3" />
            <circle cx="528" cy="91" r="2.5" /><circle cx="617" cy="116" r="2.5" />
            <circle cx="226" cy="250" r="3" /><circle cx="181" cy="224" r="3" />
            <circle cx="132" cy="250" r="3" /><circle cx="181" cy="276" r="3" />
            <circle cx="574" cy="250" r="3" /><circle cx="619" cy="224" r="3" />
            <circle cx="668" cy="250" r="3" /><circle cx="619" cy="276" r="3" />
            <circle cx="286" cy="352" r="3" /><circle cx="246" cy="382" r="3" />
            <circle cx="205" cy="409" r="3" /><circle cx="164" cy="432" r="3" />
            <circle cx="272" cy="409" r="2.5" /><circle cx="183" cy="384" r="2.5" />
            <circle cx="514" cy="352" r="3" /><circle cx="554" cy="382" r="3" />
            <circle cx="595" cy="409" r="3" /><circle cx="636" cy="432" r="3" />
            <circle cx="528" cy="409" r="2.5" /><circle cx="617" cy="384" r="2.5" />
            <circle cx="400" cy="378" r="3" /><circle cx="400" cy="426" r="3" />
          </g>
          <path className="ProgressInnerWire" d="M400 210 L400 168 M370 222 L338 196 M430 222 L462 196 M368 270 L336 294 M432 270 L464 294 M400 282 L400 326" />
        </svg>

        <div className="ProgressCore">
          <svg aria-hidden="true" className="ProgressBrainArt" viewBox="0 0 120 94">
            <path className="ProgressBrainOutline" d="M60 13 C54 5 43 7 39 15 C29 10 18 18 19 29 C8 33 8 47 17 53 C10 62 15 74 25 76 C26 87 39 91 47 84 C52 91 57 89 60 85 C63 89 68 91 73 84 C81 91 94 87 95 76 C105 74 110 62 103 53 C112 47 112 33 101 29 C102 18 91 10 81 15 C77 7 66 5 60 13 Z" />
            <path className="ProgressBrainSeam" d="M60 13 C58 29 62 38 59 50 C63 62 58 74 60 85" />
            <path className="ProgressBrainLinks" d="M27 29 L43 35 L35 51 L50 59 L39 75 M43 35 L54 25 M35 51 L23 59 M50 59 L51 76 M93 29 L77 35 L85 51 L70 59 L81 75 M77 35 L66 25 M85 51 L97 59 M70 59 L69 76" />
            <g className="ProgressBrainDots">
              <circle cx="27" cy="29" r="2.5" /><circle cx="43" cy="35" r="2.5" />
              <circle cx="35" cy="51" r="2.5" /><circle cx="50" cy="59" r="2.5" />
              <circle cx="39" cy="75" r="2.5" /><circle cx="54" cy="25" r="2.5" />
              <circle cx="23" cy="59" r="2.5" /><circle cx="51" cy="76" r="2.5" />
              <circle cx="93" cy="29" r="2.5" /><circle cx="77" cy="35" r="2.5" />
              <circle cx="85" cy="51" r="2.5" /><circle cx="70" cy="59" r="2.5" />
              <circle cx="81" cy="75" r="2.5" /><circle cx="66" cy="25" r="2.5" />
              <circle cx="97" cy="59" r="2.5" /><circle cx="69" cy="76" r="2.5" />
            </g>
          </svg>
          <strong>FOCUS CORE</strong>
          <span>{weeklySessions} sessions · {formatDuration(weeklyFocusMinutes)}</span>
        </div>

        <div className="ProgressNetworkDays">
          {days.map((day, index) => {
            const sessions = sessionsByDay.get(day.key) ?? []
            const totalSessions = dailyProgress[day.key]?.sessions ?? 0
            const totalMinutes = dailyProgress[day.key]?.focusMinutes ?? 0
            const untrackedSessions = Math.max(0, totalSessions - sessions.length)
            const isExpanded = activeDay === day.key
            const dayId = `progress-sessions-${day.key}`
            const positionClass = `ProgressNetworkDay--${index}`

            return (
              <article
                className={`ProgressNetworkDay ${positionClass} ${isExpanded ? "is-expanded" : ""}`}
                key={day.key}
                onMouseEnter={() => setHoveredDay(day.key)}
                onMouseLeave={() => setHoveredDay(null)}
              >
                <button
                  aria-controls={dayId}
                  aria-expanded={isExpanded}
                  className="ProgressDayTrigger"
                  onBlur={(event) => {
                    if (!event.currentTarget.closest(".ProgressNetworkDay")?.contains(event.relatedTarget)) {
                      setHoveredDay(null)
                    }
                  }}
                  onClick={() => setPinnedDay((current) => current === day.key ? null : day.key)}
                  onFocus={() => setHoveredDay(day.key)}
                  type="button"
                >
                  <span aria-hidden="true" className="ProgressBranchDot" />
                  <span className="ProgressDayCopy">
                    <strong>{day.label} <span>{day.dateLabel}</span></strong>
                    <small>{totalSessions} sessions · {formatDuration(totalMinutes)}</small>
                  </span>
                </button>

                {isExpanded && (
                  <div className="ProgressSessionBranches" id={dayId}>
                    <div className="ProgressSessionHeader">
                      <strong>{day.label} · {day.dateLabel}</strong>
                      <span>{sessions.length} detailed {sessions.length === 1 ? "session" : "sessions"}</span>
                    </div>
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
      )}

      <p className="ProgressStorageNote">
        Session details are saved locally in this browser. Hover over or select a day branch, then a session, to explore it.
      </p>
    </section>
  )
}

export default Progress

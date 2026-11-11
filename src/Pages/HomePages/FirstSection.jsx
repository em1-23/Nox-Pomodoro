import { useEffect, useRef, useState } from "react"

const sessions = {
  work: { label: "Work" },
  shortbreak: { label: "Short Break" },
  longbreak: { label: "Long Break" },
}
const storageKey = "npomodoro.timer"

function getDefaultDurations(workDurationMinutes) {
  return {
    work: workDurationMinutes,
    shortbreak: Math.max(1, Math.round(workDurationMinutes / 6)),
    longbreak: Math.max(1, Math.round(workDurationMinutes / 2)),
  }
}

function loadTimer() {
  const defaultDurations = getDefaultDurations(25)
  const defaultTimer = {
    session: "work",
    remainingSeconds: defaultDurations.work * 60,
    durations: defaultDurations,
    workSessionsBeforeLongBreak: 4,
    completedWorkSessions: 0,
    isRunning: false,
    endTime: null,
  }

  try {
    const savedValue = window.localStorage.getItem(storageKey)
    if (!savedValue) return { timer: defaultTimer, error: null }

    const savedTimer = JSON.parse(savedValue)
    const validSession = Object.hasOwn(sessions, savedTimer.session)
    const validRemaining = Number.isSafeInteger(savedTimer.remainingSeconds)
      && savedTimer.remainingSeconds >= 0
    const duration = Number(savedTimer.durationMinutes)
    const validDuration = savedTimer.durationMinutes === undefined
      || (typeof savedTimer.durationMinutes === "string"
        && (savedTimer.durationMinutes === "" || /^\d+$/.test(savedTimer.durationMinutes)))
    const validDurationValue = savedTimer.durationMinutes === undefined
      || savedTimer.durationMinutes === ""
      || (Number.isSafeInteger(duration) && duration <= Math.floor(Number.MAX_SAFE_INTEGER / 60))
    const savedWorkDuration = savedTimer.durations?.work
      ?? savedTimer.workDurationMinutes
      ?? (savedTimer.session === "work" && Number.isSafeInteger(duration) ? duration : defaultTimer.durations.work)
    const validWorkDuration = Number.isSafeInteger(savedWorkDuration)
      && savedWorkDuration >= 0
      && savedWorkDuration <= Math.floor(Number.MAX_SAFE_INTEGER / 60)
    const savedDurations = {
      work: savedWorkDuration,
      shortbreak: savedTimer.shortBreakDurationMinutes
        ?? (savedTimer.session === "shortbreak" && Number.isSafeInteger(duration)
          ? duration
          : Math.max(1, Math.round(savedWorkDuration / 6))),
      longbreak: savedTimer.longBreakDurationMinutes
        ?? (savedTimer.session === "longbreak" && Number.isSafeInteger(duration)
          ? duration
          : Math.max(1, Math.round(savedWorkDuration / 2))),
    }
    const validDurations = Object.values(savedDurations).every((value) =>
      Number.isSafeInteger(value)
      && value >= 1
      && value <= Math.floor(Number.MAX_SAFE_INTEGER / 60))
    const savedWorkSessionsBeforeLongBreak = savedTimer.workSessionsBeforeLongBreak ?? 4
    const savedCompletedWorkSessions = savedTimer.completedWorkSessions ?? 0
    const validCycleSettings = Number.isSafeInteger(savedWorkSessionsBeforeLongBreak)
      && savedWorkSessionsBeforeLongBreak >= 1
      && Number.isSafeInteger(savedCompletedWorkSessions)
      && savedCompletedWorkSessions >= 0
    const validRunningState = typeof savedTimer.isRunning === "boolean"
      && (!savedTimer.isRunning || Number.isFinite(savedTimer.endTime))

    if (!validSession || !validRemaining || !validDuration || !validDurationValue
      || !validWorkDuration || !validDurations || !validCycleSettings || !validRunningState) {
      throw new Error("Saved timer data is invalid.")
    }

    const remainingSeconds = savedTimer.isRunning
      ? Math.max(0, Math.ceil((savedTimer.endTime - Date.now()) / 1000))
      : savedTimer.remainingSeconds
    const isRunning = savedTimer.isRunning && remainingSeconds > 0

    return {
      timer: {
        session: savedTimer.session,
        remainingSeconds,
        durations: savedDurations,
        workSessionsBeforeLongBreak: savedWorkSessionsBeforeLongBreak,
        completedWorkSessions: savedCompletedWorkSessions,
        isRunning,
        endTime: isRunning ? savedTimer.endTime : null,
      },
      error: null,
    }
  } catch (error) {
    console.error("Could not load the saved Pomodoro timer.", error)
    return { timer: defaultTimer, error: "تعذر تحميل بيانات المؤقّت المحفوظة." }
  }
}

export default function FirstSection() {
  const [initialTimer] = useState(loadTimer)
  const [session, setSession] = useState(initialTimer.timer.session)
  const [remainingSeconds, setRemainingSeconds] = useState(initialTimer.timer.remainingSeconds)
  const [durations, setDurations] = useState(initialTimer.timer.durations)
  const [durationInputs, setDurationInputs] = useState(
    Object.fromEntries(Object.entries(initialTimer.timer.durations).map(([key, value]) => [key, String(value)])),
  )
  const [workSessionsBeforeLongBreak, setWorkSessionsBeforeLongBreak] = useState(
    initialTimer.timer.workSessionsBeforeLongBreak,
  )
  const [workSessionsBeforeLongBreakInput, setWorkSessionsBeforeLongBreakInput] = useState(
    String(initialTimer.timer.workSessionsBeforeLongBreak),
  )
  const [completedWorkSessions, setCompletedWorkSessions] = useState(
    initialTimer.timer.completedWorkSessions,
  )
  const [isRunning, setIsRunning] = useState(initialTimer.timer.isRunning)
  const [storageError, setStorageError] = useState(initialTimer.error)
  const endTime = useRef(initialTimer.timer.endTime)
  const storageErrorLogged = useRef(Boolean(initialTimer.error))

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        session,
        remainingSeconds,
        workDurationMinutes: durations.work,
        shortBreakDurationMinutes: durations.shortbreak,
        longBreakDurationMinutes: durations.longbreak,
        workSessionsBeforeLongBreak,
        completedWorkSessions,
        isRunning,
        endTime: isRunning ? endTime.current : null,
      }))
      storageErrorLogged.current = false
      setStorageError(null)
    } catch (error) {
      if (!storageErrorLogged.current) {
        console.error("Could not save the Pomodoro timer.", error)
        storageErrorLogged.current = true
      }
      setStorageError("تعذر حفظ بيانات المؤقّت في التخزين المحلي.")
    }
  }, [
    session,
    remainingSeconds,
    durations,
    workSessionsBeforeLongBreak,
    completedWorkSessions,
    isRunning,
  ])

  useEffect(() => {
    if (!isRunning) return undefined

    const interval = window.setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000))

      if (secondsLeft === 0) {
        if (session === "work") {
          const nextCompletedCount = completedWorkSessions + 1
          const nextSession = nextCompletedCount >= workSessionsBeforeLongBreak
            ? "longbreak"
            : "shortbreak"
          const nextDuration = durations[nextSession]

          setCompletedWorkSessions(nextCompletedCount)
          setSession(nextSession)
          setRemainingSeconds(nextDuration * 60)
          endTime.current = Date.now() + nextDuration * 60 * 1000
        } else {
          const nextDuration = durations.work
          if (session === "longbreak") {
            setCompletedWorkSessions(0)
          }
          setSession("work")
          setRemainingSeconds(nextDuration * 60)
          endTime.current = Date.now() + nextDuration * 60 * 1000
        }
      } else {
        setRemainingSeconds(secondsLeft)
      }
    }, 250)

    return () => window.clearInterval(interval)
  }, [
    isRunning,
    session,
    completedWorkSessions,
    workSessionsBeforeLongBreak,
    durations,
  ])

  function toggleTimer() {
    if (isRunning) {
      const secondsLeft = Math.max(0, Math.ceil((endTime.current - Date.now()) / 1000))
      setRemainingSeconds(secondsLeft)
      setIsRunning(false)
      endTime.current = null
      return
    }

    endTime.current = Date.now() + remainingSeconds * 1000
    setIsRunning(true)
  }

  function selectSession(nextSession) {
    setIsRunning(false)
    endTime.current = null
    setSession(nextSession)
    const nextDuration = durations[nextSession]
    setRemainingSeconds(nextDuration * 60)
  }

  function restartSession() {
    setIsRunning(false)
    endTime.current = null
    const resetDuration = durations[session]
    setRemainingSeconds(resetDuration * 60)
  }

  function changeDuration(sessionName, event) {
    const value = event.target.value
    setDurationInputs((inputs) => ({ ...inputs, [sessionName]: value }))

    if (value === "" || !/^\d+$/.test(value)) return

    const minutes = Number(value)
    if (!Number.isSafeInteger(minutes) || minutes < 1
      || minutes > Math.floor(Number.MAX_SAFE_INTEGER / 60)) return

    const updatedSeconds = minutes * 60
    setDurations((current) => ({ ...current, [sessionName]: minutes }))

    if (session === sessionName) {
      setRemainingSeconds(updatedSeconds)
      if (isRunning) {
        endTime.current = Date.now() + updatedSeconds * 1000
      }
    }
  }

  function changeWorkSessionsBeforeLongBreak(event) {
    const value = event.target.value
    setWorkSessionsBeforeLongBreakInput(value)
    if (!/^\d+$/.test(value)) return

    const count = Number(value)
    if (!Number.isSafeInteger(count) || count < 1) return
    setWorkSessionsBeforeLongBreak(count)
  }

  function restoreDurationInput(sessionName) {
    setDurationInputs((inputs) => ({
      ...inputs,
      [sessionName]: String(durations[sessionName]),
    }))
  }

  // حساب النسبة المئوية للوقت المتبقي بناءً على المعادلة المطلوبة: (الوقت المتبقي / وقت التايمر الإجمالي) * 100
  const totalDurationSeconds = durations[session] * 60
  const percentage = totalDurationSeconds > 0 ? (remainingSeconds / totalDurationSeconds) * 100 : 0

  const hours = Math.floor(remainingSeconds / 3600)
  const minutes = Math.floor((remainingSeconds % 3600) / 60)
  const seconds = remainingSeconds % 60
  const timer = [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(" : ")

  return (
    <div className="Section FirstSection">
      <div className="LeftSlider">
        <i className="fa-solid fa-stopwatch"></i>
        <div className="Details">
          <h1>Nox Pomodoro</h1>
          <span>Focus & Task Productivity Suite</span>
        </div>
      </div>
      <div className="RightSlider">
        <div className="Head">
          {Object.entries(sessions).map(([key, { label }]) => (
            <button
              aria-pressed={session === key}
              // أضفنا فئة "active" هنا إذا كان التبويب الحالي مطابقاً لـ key
              className={`Link ${session === key ? "active" : ""}`}
              key={key}
              onClick={() => selectSession(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="Timer" style={{background: `conic-gradient(var(--SpecialColor) ${percentage}%, #fafafa ${percentage}%)`}} >
          <div className="Content">
            {timer}
          </div>
        </div>

        {storageError && <p role="alert">{storageError}</p>}
        <div className="Start">
          <button className="StartButton Button" disabled={remainingSeconds === 0} onClick={toggleTimer} type="button">
            <i className={`fa-solid ${isRunning ? "fa-pause" : "fa-play"}`}></i>
            {isRunning ? " Pause" : remainingSeconds === 0 ? " Completed" : " Play"}
          </button>
          <button aria-label="Restart timer" className="RestartButton Button" onClick={restartSession} type="button">
            <i className="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>
      <dialog id="pomodoro-settings" aria-labelledby="pomodoro-settings-title" className="DialogSetting">
        <form method="dialog">
          <h2 id="pomodoro-settings-title">Timer Settings</h2>
          {Object.entries(sessions).map(([key, { label }]) => (
            <label key={key}>
              <br />
              {label} duration (minutes) <br />
              <input aria-label={`${label} duration in minutes`} min="1" onBlur={() => restoreDurationInput(key)} onChange={(event) => changeDuration(key, event)} step="1" type="number" value={durationInputs[key]} className="inputTimer" />
              <br />
            </label>
          ))} <br />
          <label>
            Work sessions before long break <br />
            <input
              aria-label="Work sessions before long break"
              min="1"
              onBlur={() => setWorkSessionsBeforeLongBreakInput(String(workSessionsBeforeLongBreak))}
              onChange={changeWorkSessionsBeforeLongBreak}
              step="1"
              className="inputTimer duration"
              type="number"
              value={workSessionsBeforeLongBreakInput}
            />
          </label>
          <p>
            Completed work sessions: {completedWorkSessions} / {workSessionsBeforeLongBreak}
          </p>
          <button type="submit" className="Button hole">Close</button>
        </form>
      </dialog>
    </div>
  )
}
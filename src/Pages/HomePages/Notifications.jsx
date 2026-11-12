import { useEffect, useState } from "react"

function Notifications() {
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    let timeoutId

    function showNotification(event) {
      window.clearTimeout(timeoutId)
      setNotification({
        style: event.detail?.style === "Success" ? "Success" : "Info",
        content: typeof event.detail?.content === "string"
          ? event.detail.content
          : "Pomodoro session completed.",
        id: Date.now(),
      })
      timeoutId = window.setTimeout(() => setNotification(null), 4000)
    }

    window.addEventListener("pomodoro:notification", showNotification)
    return () => {
      window.removeEventListener("pomodoro:notification", showNotification)
      window.clearTimeout(timeoutId)
    }
  }, [])

  if (!notification) return null

  return (
    <div
      aria-live="polite"
      className={`Notification ${notification.style}`}
      key={notification.id}
      role="status"
    >
      <div className="Icon">
        <i className={`fa-solid ${notification.style === "Success" ? "fa-circle-check" : "fa-circle-info"}`}></i>
      </div>
      <div className="Content">{notification.content}</div>
    </div>
  )
}

export default Notifications

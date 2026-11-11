function Header() {
  localStorage.SessionsCount = 0
  return (
    <div className="Section Header">
      <div className="Name">
        <i className="fa-solid fa-stopwatch"></i>
        <div className="Details">
          <h1>Nox Pomodoro</h1>
          <span>Focus & Task Productivity Suite</span>
        </div>
      </div>      
      <button
        aria-label="Open timer settings"
        className="Setting"
        {...{ command: "show-modal", commandfor: "pomodoro-settings" }}
        type="button"
      >
        <i className="fa-solid fa-gear"></i>
      </button>
    </div>
  )
}

export default Header
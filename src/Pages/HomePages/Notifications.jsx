function Notifications() {
  function Notification(N) {
    return (
      <div className={`Notification ${N.Style}`}>
        <div className="Icon">
          <i class="fa-solid fa-circle-info"></i>
        </div>
        <div className="Content">
          {N.Content}
        </div>
      </div>
    )
  }
  return (
    <Notification Style="Info" Content="Mahmoud Ahmed ELnagar Built This" />
  )
}

export default Notifications
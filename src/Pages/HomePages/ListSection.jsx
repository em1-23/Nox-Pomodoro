import { useEffect, useState } from "react"
const storageKey = "Items"
const statuses = {
  WorkAt: "Work At",
  Done: "Done",
  NotYet: "Not Yet",
}

function loadItems() {
  try {
    const savedItems = window.localStorage.getItem(storageKey)
    if (!savedItems) return { items: [], error: null }

    const parsedItems = JSON.parse(savedItems)
    if (!Array.isArray(parsedItems)) {
      throw new Error("Saved items must be an array.")
    }

    const items = parsedItems.map((item, index) => {
      const content = item.Content ?? item.content
      const status = item.status ?? item.Selection
      if (typeof content !== "string" || !Object.hasOwn(statuses, status)) {
        throw new Error(`Saved item at index ${index} is invalid.`)
      }

      return {
        id: item.id ?? `${index}-${content}`,
        content,
        status,
      }
    })

    return { items, error: null }
  } catch (error) {
    console.error("Could not load saved tasks.", error)
    return { items: [], error: "تعذر تحميل المهام المحفوظة." }
  }
}

function ListSection() {
  const [initialData] = useState(loadItems)
  const [items, setItems] = useState(initialData.items)
  const [filter, setFilter] = useState("All")
  const [newItem, setNewItem] = useState("")
  const [newItemStatus, setNewItemStatus] = useState("NotYet")
  const [storageError, setStorageError] = useState(initialData.error)

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items))
      setStorageError(null)
    } catch (error) {
      console.error("Could not save tasks to local storage.", error)
      setStorageError("تعذر حفظ المهام في التخزين المحلي.")
    }
  }, [items])

  function addItem(event) {
    event.preventDefault()
    const content = newItem.trim()
    if (!content) return

    setItems((currentItems) => [
      ...currentItems,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        status: newItemStatus,
      },
    ])
    setNewItem("")
  }

  function changeItemStatus(id, status) {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, status } : item)),
    )
  }

  function deleteItem(id) {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id))
  }

  const visibleItems = items.filter((item) => filter === "All" || item.status === filter)

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
        <div aria-label="Filter tasks" className="Flex Links">
          {["All", ...Object.keys(statuses)].map((status) => (
            <button
              aria-pressed={filter === status}
              className={`Link${filter === status ? " CLicked" : ""}`}
              key={status}
              onClick={() => setFilter(status)}
              type="button"
            >
              {status === "All" ? "All" : statuses[status]}
            </button>
          ))}
        </div>
        <form className="Flex AddItems" onSubmit={addItem}>
          <input
            aria-label="Task name"
            onChange={(event) => setNewItem(event.target.value)}
            placeholder="Add Items"
            type="text"
            value={newItem}
          />
          <select
            aria-label="Task status"
            className="Select"
            onChange={(event) => setNewItemStatus(event.target.value)}
            value={newItemStatus}
          >
            {Object.entries(statuses).map(([value, label]) => (
              <option className="Option" key={value} value={value}>{label}</option>
            ))}
          </select>
          <button aria-label="Add task" className="Button Icon" type="submit">
            <i className="fa-solid fa-plus"></i>
          </button>
        </form>
      </div>
      {storageError && <p role="alert">{storageError}</p>}
      <div className="Body">
        {visibleItems.length > 0 ? visibleItems.map((item) => (
          <div className="TaskItem" key={item.id}>
            <span className={item.status === "Done" ? "TaskContent Done" : "TaskContent"}>
              {item.content}
            </span>
            <select
              aria-label={`Status for ${item.content}`}
              onChange={(event) => changeItemStatus(item.id, event.target.value)}
              value={item.status}
            >
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              aria-label={`Delete ${item.content}`}
              className="DeleteTask"
              onClick={() => deleteItem(item.id)}
              type="button"
            >
              <i className="fa-solid fa-trash"></i>
            </button>
          </div>
        )) : (
          <div className="ContentEmpaty">
            <i className="fa-regular fa-clipboard"></i>
            No tasks found for this status filter
          </div>
        )}
      </div>
    </div>
  )
}

export default ListSection

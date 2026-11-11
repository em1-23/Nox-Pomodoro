import { BrowserRouter as Nox , Routes , Route, Outlet } from "react-router-dom"
import Home from "./Pages/Home"
import Notifications from "./Pages/HomePages/Notifications"
function App() {
  function Componant(){
    return(
      <>
        <Outlet />
        <Notifications />
      </>
    )
  }
  return (
    <Nox>
      <Routes>
        <Route element={<Componant />}>
          <Route index element={<Home  />} />
        </Route>
      </Routes>
    </Nox>
  )
}

export default App

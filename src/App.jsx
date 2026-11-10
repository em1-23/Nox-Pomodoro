import { BrowserRouter as Nox , Routes , Route, Outlet } from "react-router-dom"
import Home from "./Pages/Home"
function App() {
  function Componant(){
    return(
      <>
        <Outlet />
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

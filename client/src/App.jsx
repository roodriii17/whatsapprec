import { useState } from "react"
import Login from "./components/Login/Login"
import MainLayout from "./components/MainLayout/MainLayout"

function App() {
  // Estado para guardar los datos del usuario logueado (nombre, avatar, estado)
  const [usuario, setUsuario] = useState(null)

  // Guardián de pantalla: Si no hay usuario, bloquea la app y muestra el Login
  if (!usuario) {
    return <Login onLogin={setUsuario} /> // Pasa la función para actualizar el usuario al terminar el login
  }

  // Si ya hay un usuario guardado, muestra la interfaz principal del chat
  return <MainLayout usuario={usuario} />
}

export default App
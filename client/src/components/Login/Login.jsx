// Importa el hook useState desde la librería de React
import { useState } from "react"
// Importa el archivo de estilos CSS exclusivo de la pantalla de login
import "./Login.css"

// Define un arreglo de URLs estáticas con avatares SVG generados mediante la API de DiceBear
const avatares = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bear",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella",
]

// Declara el componente Login recibiendo la función callback 'onLogin' como propiedad
function Login({ onLogin }) {
  // Estado local para capturar el texto introducido en el input del nombre
  const [nombre, setNombre] = useState("")
  // Estado local para almacenar la opción del selector de estado (inicia en "Disponible")
  const [estado, setEstado] = useState("Disponible")
  // Estado local para guardar la URL del avatar seleccionado (por defecto toma el primero de la lista)
  const [avatarElegido, setAvatarElegido] = useState(avatares[0])
  // Estado local para gestionar y pintar mensajes de error en la validación
  const [error, setError] = useState("")

  // Función interna para procesar la entrada al chat tras pulsar el botón de acción
  function handleEntrar() {
    // Validación de seguridad: Si el campo de nombre está vacío, frena la ejecución
    if (nombre == "") {
      setError("Pon tu nombre por favor") // Configura el texto del mensaje de error
      return // Detiene el flujo de la función
    }
    // Si la validación es correcta, ejecuta la función prop inyectando el objeto con los datos del usuario
    onLogin({
      name: nombre,
      estado: estado,
      avatar: avatarElegido
    })
  }

  return (
    // Contenedor principal para pintar la pantalla de fondo completo
    <div className="login-fondo">
      {/* Caja blanca centralizada que contiene el formulario */}
      <div className="login-caja">
        <h1>WhatsApp Clone</h1>
        <p>Rellena tus datos para entrar</p>

        {/* Bloque del Input para el Nombre de Usuario */}
        <div>
          <label>Tu nombre:</label>
          <input
            type="text"
            placeholder="Escribe tu nombre"
            value={nombre} // Enlaza el valor visual del input con el estado local
            onChange={(e) => setNombre(e.target.value)} // Actualiza el estado con el texto ingresado
          />
          {/* Renderizado condicional: Muestra el mensaje en rojo si se activa el estado de error */}
          {error && <p style={{color: "red"}}>{error}</p>}
        </div>

        {/* Bloque del selector desplegable de Estado */}
        <div>
          <label>Tu estado:</label>
          {/* Asigna el valor activo y reacciona al cambio de opción actualizando el estado */}
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option>Disponible</option>
            <option>Ocupado</option>
            <option>En el trabajo</option>
            <option>Durmiendo</option>
            <option>Solo emergencias</option>
          </select>
        </div>

        {/* Bloque para la rejilla de selección de Avatares */}
        <div>
          <label>Elige un avatar:</label>
          <div className="avatares-grid">
            {/* Mapea el arreglo de URLs de avatares para pintarlos uno a uno en pantalla */}
            {avatares.map((av, i) => (
              <img
                key={i} // Identificador único posicional exigido por React
                src={av} // Origen de la imagen del avatar en turno
                alt={"avatar " + i}
                // Si la URL coincide con el avatar guardado en el estado aplica la clase seleccionada, si no, la normal
                className={avatarElegido === av ? "avatar-sel" : "avatar-normal"}
                onClick={() => setAvatarElegido(av)} // Cambia el avatar activo al pulsar sobre la imagen
              />
            ))}
          </div>
        </div>

        {/* Botón de acción final encargado de disparar la validación y el login */}
        <button onClick={handleEntrar}>Entrar al chat</button>
      </div>
    </div>
  )
}

// Exporta por defecto el componente Login para su consumo en App.jsx
export default Login
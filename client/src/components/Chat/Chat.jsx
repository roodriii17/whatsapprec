// Importa los hooks estructurales de React para estados, referencias del DOM y efectos
import { useState, useRef, useEffect } from "react"
// Importa los estilos de diseño específicos de la interfaz del chat
import "./Chat.css"

// Dirección base del backend para realizar las peticiones HTTP de subida de archivos
const SERVER_URL = "https://whatsapprec-one.vercel.app"

// Declara el componente pasándole de forma desestructurada todas las propiedades (props)
function Chat({ mensajes, onEnviar, onEscribir, onParar, escribiendo, usuarioActual, socketId, salaActiva }) {
  // Estado para capturar el texto introducido en la barra de mensajes
  const [texto, setTexto] = useState("")
  // Estado booleano para bloquear los controles mientras un archivo se sube al servidor
  const [subiendo, setSubiendo] = useState(false)
  // Referencia para apuntar al final de la lista de mensajes y forzar el scroll
  const finalRef = useRef(null)
  // Referencia para manipular de manera oculta el elemento input type="file" del DOM
  const fileRef = useRef(null)

  // Efecto: Se activa cada vez que llegan nuevos mensajes o cambia la lista de personas escribiendo
  useEffect(() => {
    // Ejecuta un scroll animado y suave hacia el div ancla inferior para mantener la vista al día
    finalRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, escribiendo])

  // Función interna para despachar el mensaje de texto convencional
  function handleEnviar() {
    // Si la barra está vacía y no hay procesos de subida concurrentes, aborta el envío
    if (texto.trim() === "" && !subiendo) return
    onEnviar(texto, null) // Llama al callback prop con el texto y sin objeto de archivo
    setTexto("") // Vacía por completo la barra de texto
    onParar() // Notifica al servidor que dejamos de teclear inmediatamente
  }

  // Función para capturar las pulsaciones del teclado dentro del input de texto
  function handleTecla(e) {
    // Si la tecla presionada es 'Enter', procesa el envío del mensaje de forma directa
    if (e.key === "Enter") {
      handleEnviar()
    }
  }

  // Función encargada de sincronizar la escritura del input con los estados del WebSocket
  function handleCambio(e) {
    setTexto(e.target.value) // Actualiza el estado local con los caracteres tecleados
    if (e.target.value !== "") {
      onEscribir() // Si contiene texto, emite el evento de inicio de escritura al servidor
    } else {
      onParar() // Si el usuario borró todo el texto, emite el evento de detención
    }
  }

  // Función asíncrona dedicada a empaquetar y subir archivos al backend vía REST API
  async function handleArchivo(e) {
    const archivo = e.target.files[0] // Obtiene el primer archivo binario seleccionado
    if (!archivo) return // Si se canceló la selección, aborta el proceso
    setSubiendo(true) // Activa el estado de carga para deshabilitar los inputs de la interfaz
    try {
      const formData = new FormData() // Crea una instancia FormData para codificar archivos binarios
      formData.append("file", archivo) // Inyecta el archivo bajo la clave "file" esperada por Multer
      // Envía la petición POST al backend para guardar el documento en el servidor
      const res = await fetch(SERVER_URL + "/upload", {
        method: "POST",
        body: formData
      })
      const datos = await res.json() // Recupera la respuesta en formato JSON (contiene filename, url, etc.)
      onEnviar(texto, datos) // Envía el mensaje al socket vinculando el texto actual y la metadata del archivo
      setTexto("") // Limpia la caja de texto
    } catch (err) {
      alert("Error al subir el archivo: " + err.message) // Dispara una alerta en pantalla si falla la red
    } finally {
      setSubiendo(false) // Desactiva el bloqueo de los elementos de control
      fileRef.current.value = "" // Borra el historial del input de archivo para poder resubir el mismo elemento
    }
  }

  // Filtra la lista de usuarios tecleando para no incluir tu propio identificador de socket
  const otrosEscribiendo = escribiendo.filter((u) => u.id !== socketId)

  // Guardián visual: Si no hay ninguna sala pública elegida, bloquea la UI y muestra la pantalla vacía
  if (!salaActiva) {
    return (
      <div className="chat">
        <div className="chat-vacio">
          <p>👈 Selecciona una sala para empezar a chatear</p>
        </div>
      </div>
    )
  }

  // Función auxiliar encargada de retornar la estructura HTML adecuada según el tipo de archivo recibido
  function mostrarArchivo(archivo) {
    // Comprueba si el mimetype del adjunto pertenece a la familia de las imágenes
    const esImagen = archivo.mimetype && archivo.mimetype.startsWith("image/")
    if (esImagen) {
      return (
        <div className="archivo-adjunto">
          {/* Renderiza la previsualización directa de la imagen usando su URL del backend */}
          <img src={archivo.url} alt={archivo.filename} className="imagen-mensaje" />
          <a href={archivo.url} download={archivo.filename} className="btn-descargar" target="_blank" rel="noreferrer">
            ⬇ Descargar imagen
          </a>
        </div>
      )
    } else {
      return (
        <div className="archivo-adjunto">
          {/* Si es otro tipo de documento (PDF, zip, etc.), renderiza una celda genérica con clip de papel */}
          <div className="archivo-doc">
            <span>📎 {archivo.filename}</span>
            <a href={archivo.url} download={archivo.filename} className="btn-descargar" target="_blank" rel="noreferrer">
              ⬇ Descargar
            </a>
          </div>
        </div>
      )
    }
  }

  return (
    // Contenedor estructural de la interfaz de chat activa
    <div className="chat">
      {/* CABECERA: Imprime el título y la descripción meta del canal público enfocado */}
      <div className="chat-cabecera">
        <h2># {salaActiva.nombre}</h2>
        <p>{salaActiva.descripcion}</p>
      </div>

      {/* ÁREA DE MENSAJES: Sección con scroll automático donde se listan las burbujas */}
      <div className="chat-mensajes">
        {/* Mapea la lista de mensajes en tiempo real de la sala */}
        {mensajes.map((msg, i) => {

          // Si el mensaje viene marcado con el tipo "system" (ej: conexiones/desconexiones)
          if (msg.type === "system") {
            return (
              // Retorna un div centrado y plano sin burbuja de usuario
              <div key={i} className="mensaje-sistema">
                {msg.text}
              </div>
            )
          }

          // Evalúa si tú eres el creador y emisor del mensaje actual
          const esMio = msg.sender?.id === socketId

          return (
            // Aplica clases diferentes según la autoría para alinear el mensaje a la derecha o izquierda
            <div key={i} className={esMio ? "mensaje-mio" : "mensaje-otro"}>
              {/* Si el mensaje no es tuyo, añade la imagen de avatar a la izquierda de su burbuja */}
              {!esMio && (
                <img src={msg.sender?.avatar} alt="" className="msg-avatar" />
              )}
              {/* Contenedor interno de la burbuja estática */}
              <div className={esMio ? "burbuja-mia" : "burbuja-otro"}>
                {/* Si no es tuyo, imprime su nombre sobre el cuerpo del mensaje en color distintivo */}
                {!esMio && (
                  <p className="msg-nombre">{msg.sender?.name}</p>
                )}
                {/* Si el payload contiene un archivo adjunto, invoca a la función constructora pasándole el objeto */}
                {msg.archivo && mostrarArchivo(msg.archivo)}
                {/* Si viene acompañado de un texto base, lo dibuja dentro de un párrafo estándar */}
                {msg.text && <p>{msg.text}</p>}
                {/* Sección horaria formateada a partir de la marca de tiempo original */}
                <span className="msg-hora">
                  {new Date(msg.timestamp).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
            </div>
          )
        })}

        {/* INDICADOR DE ESCRITURA: Muestra de manera dinámica quién está interactuando con el input */}
        {otrosEscribiendo.length > 0 && (
          <div className="escribiendo">
            {/* Une todos los nombres de los usuarios tecleando con comas en una cadena única */}
            {otrosEscribiendo.map((u) => u.name).join(", ")} está escribiendo...
          </div>
        )}

        {/* Div ficticio sin contenido utilizado de ancla por el useRef para guiar el scrollIntoView */}
        <div ref={finalRef} />
      </div>

      {/* FOOTER INPUT: Barra de entrada inferior para texto y carga de archivos */}
      <div className="chat-input">
        {/* Botón estético de clip de papel para disparar por proxy la ventana nativa de archivos */}
        <button className="btn-archivo" onClick={() => fileRef.current.click()} title="Adjuntar archivo">
          📎
        </button>
        {/* Input file del DOM real oculto mediante CSS inline, controlado por referencia y atado al handler */}
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleArchivo} />
        {/* Barra de texto principal */}
        <input
          type="text"
          // Altera el placeholder dinámicamente si se encuentra en medio de un proceso de carga HTTP
          placeholder={subiendo ? "Subiendo archivo..." : "Escribe un mensaje..."}
          value={texto}
          onChange={handleCambio}
          onKeyDown={handleTecla}
          disabled={subiendo} // Bloquea la entrada si se está subiendo un archivo
        />
        {/* Botón de envío manual */}
        <button onClick={handleEnviar} disabled={subiendo}>
          Enviar
        </button>
      </div>
    </div>
  )
}

// Exporta por defecto el componente Chat listo para integrarse en el Layout
export default Chat

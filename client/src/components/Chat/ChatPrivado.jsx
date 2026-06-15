// Importa los hooks necesarios de React para controlar estados, referencias y efectos secundarios
import { useState, useRef, useEffect } from "react"
// Importa los estilos compartidos del chat para mantener una interfaz unificada
import "./Chat.css"

// Dirección del servidor local asignada para el consumo de la API de subida de archivos
const SERVER_URL = "http://localhost:3003"

// Declara el componente ChatPrivado extrayendo las propiedades (props) mediante desestructuración
function ChatPrivado({ mensajes, onEnviar, onEscribir, onParar, usuarioPrivado, estaEscribiendo, socketId, onCerrar }) {
  // Estado local para capturar el texto introducido en la caja de mensajería
  const [texto, setTexto] = useState("")
  // Estado booleano para bloquear los inputs de texto mientras se procesa un archivo
  const [subiendo, setSubiendo] = useState(false)
  // Referencia vinculada al div del final de la lista para gestionar el scroll automático
  const finalRef = useRef(null)
  // Referencia para interactuar con el elemento nativo input file que permanece oculto
  const fileRef = useRef(null)

  // Efecto visual: Hace scroll automático hacia abajo al recibir mensajes o cambiar el estado "escribiendo"
  useEffect(() => {
    // Desplaza la pantalla suavemente hacia el elemento de referencia inferior
    finalRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, estaEscribiendo])

  // Función para empaquetar y despachar los mensajes escritos convencionales
  function handleEnviar() {
    // Cancela el envío si el input de texto está vacío y no se está cargando un archivo
    if (texto.trim() === "" && !subiendo) return
    onEnviar(texto, null) // Llama al callback pasando el contenido del texto y sin archivo adjunto
    setTexto("") // Vacía el búfer de texto de la caja de entrada
    onParar() // Notifica de inmediato al servidor que se detuvo la escritura
  }

  // Captura los eventos de pulsación del teclado sobre la barra de entrada de texto
  function handleTecla(e) {
    // Si la tecla presionada es "Enter", ejecuta el procesador de envío
    if (e.key === "Enter") handleEnviar()
  }

  // Controla y sincroniza la escritura del teclado con las notificaciones de los sockets
  function handleCambio(e) {
    setTexto(e.target.value) // Actualiza el estado con el valor en tiempo real del input
    if (e.target.value !== "") onEscribir() // Si hay texto, activa la señal "escribiendo" en el servidor
    else onParar() // Si el input queda completamente limpio, apaga la señal
  }

  // Handler asíncrono diseñado para gestionar la carga de documentos binarios vía HTTP POST
  async function handleArchivo(e) {
    const archivo = e.target.files[0] // Extrae el archivo seleccionado de la lista nativa
    if (!archivo) return // Si se canceló la selección, detiene el flujo
    setSubiendo(true) // Bloquea la UI activando el estado de carga
    try {
      const formData = new FormData() // Instancia el objeto FormData para enviar datos binarios multipart
      formData.append("file", archivo) // Adjunta el archivo bajo el nombre de campo "file"
      // Realiza la petición POST de subida hacia el endpoint del backend
      const res = await fetch(SERVER_URL + "/upload", {
        method: "POST",
        body: formData
      })
      const datos = await res.json() // Recupera el JSON de respuesta con los datos del archivo guardado
      
      // CORREGIDO: Despacha el mensaje enviando el texto actual y el objeto con la metadata del archivo
      onEnviar(texto, datos)
      setTexto("") // Limpia el input de texto
    } catch (err) {
      alert("Error al subir: " + err.message) // Lanza una alerta en pantalla si se detecta un fallo de red
    } finally {
      setSubiendo(false) // Libera el bloqueo de los controles de la interfaz
      if (fileRef.current) fileRef.current.value = "" // Resetea el input de tipo archivo para futuras cargas
    }
  }

  // Función dedicada a construir el fragmento HTML del adjunto evaluando su tipo MIME
  function mostrarArchivo(archivo) {
    // CORREGIDO: Modifica la URL para reemplazar IPs antiguas o caídas por la dirección local correcta
    const urlCorregida = archivo.url ? archivo.url.replace("192.168.1.16:3002", "localhost:3003") : ""
    // Evalúa si el tipo de archivo pertenece a una imagen válida
    const esImagen = archivo.mimetype && archivo.mimetype.startsWith("image/")

    if (esImagen) {
      return (
        <div className="archivo-adjunto">
          {/* Muestra la previsualización directa de la imagen usando la dirección corregida */}
          <img src={urlCorregida} alt={archivo.filename} className="imagen-mensaje" />
          <a href={urlCorregida} download={archivo.filename} className="btn-descargar" target="_blank" rel="noreferrer">
            ⬇ Descargar imagen
          </a>
        </div>
      )
    } else {
      return (
        <div className="archivo-adjunto">
          {/* Si no es una imagen, renderiza un bloque de documento genérico acompañado de un clip */}
          <div className="archivo-doc">
            <span>📎 {archivo.filename}</span>
            <a href={urlCorregida} download={archivo.filename} className="btn-descargar" target="_blank" rel="noreferrer">
              ⬇ Descargar
            </a>
          </div>
        </div>
      )
    }
  }

  return (
    // Estructura contenedora del módulo visual del chat privado
    <div className="chat">
      {/* CABECERA: Controles de navegación y estado de perfil del usuario de la sesión privada */}
      <div className="chat-cabecera privado-cabecera">
        {/* Botón para cerrar la conversación uno a uno y restaurar el foco del Layout global */}
        <button className="btn-volver" onClick={onCerrar}>← Volver</button>
        {usuarioPrivado && (
          <div className="privado-info">
            <img src={usuarioPrivado.avatar} alt={usuarioPrivado.name} className="privado-avatar" />
            <div>
              <p className="privado-nombre">{usuarioPrivado.name}</p>
              <p className="privado-estado">{usuarioPrivado.estado}</p>
            </div>
          </div>
        )}
        {/* Etiqueta estética que señaliza que la conversación es privada */}
        <span className="privado-badge">🔒 Privado</span>
      </div>

      {/* HISTORIAL: Área central provista de scroll donde se listan los mensajes directos */}
      <div className="chat-mensajes">
        {/* Renderizado condicional: Notifica visualmente si el historial está vacío */}
        {mensajes.length === 0 && (
          <div className="chat-vacio">
            <p>No hay mensajes todavía. ¡Di hola! 👋</p>
          </div>
        )}

        {/* Itera y dibuja el arreglo de mensajes acumulado del chat privado */}
        {mensajes.map((msg, i) => {
          // Evalúa si tú eres el emisor original del mensaje comparando IDs de socket
          const esMio = msg.sender?.id === socketId
          return (
            // Alinea el mensaje a la derecha (si es propio) o a la izquierda (si es de la contraparte)
            <div key={i} className={esMio ? "mensaje-mio" : "mensaje-otro"}>
              {/* Si el mensaje es de la otra persona, añade su imagen de perfil a un costado */}
              {!esMio && (
                <img src={msg.sender?.avatar} alt="" className="msg-avatar" />
              )}
              {/* Dibuja la burbuja de texto aplicando la hoja de estilos respectiva */}
              <div className={esMio ? "burbuja-mia" : "burbuja-otro"}>
                {/* Si el mensaje contiene un nodo de archivo válido, ejecuta el generador HTML */}
                {msg.archivo && mostrarArchivo(msg.archivo)}
                {/* Si incluye texto en su estructura, lo renderiza dentro de un párrafo estándar */}
                {msg.text && <p>{msg.text}</p>}
                {/* Estampa temporal del mensaje formateada en minutos y horas */}
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

        {/* INDICADOR DE ESCRITURA PRIVADO: Se activa dinámicamente si la contraparte está tecleando */}
        {estaEscribiendo && (
          <div className="escribiendo">
            {estaEscribiendo} está escribiendo...
          </div>
        )}

        {/* Nodo vacío al final de la lista de mensajes utilizado como ancla para forzar el scrollIntoView */}
        <div ref={finalRef} />
      </div>

      {/* INPUT BAR: Sección baja para la redacción de texto y selección de archivos */}
      <div className="chat-input">
        {/* Botón proxy encargado de simular el clic en el selector oculto de archivos */}
        <button className="btn-archivo" onClick={() => fileRef.current.click()}>📎</button>
        {/* Input file real del DOM ocultado de la UI, atado a la referencia y al manejador asíncrono */}
        <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleArchivo} />
        <input
          type="text"
          // Altera el texto de ayuda según se esté procesando o no la subida de un documento por red
          placeholder={subiendo ? "Subiendo..." : "Mensaje privado..."}
          value={texto}
          onChange={handleCambio}
          onKeyDown={handleTecla}
          disabled={subiendo} // Bloquea temporalmente el input para evitar desincronizaciones en la carga
        />
        {/* Botón de envío manual */}
        <button onClick={handleEnviar} disabled={subiendo}>Enviar</button>
      </div>
    </div>
  )
}

// Exporta por defecto el componente para permitir su uso directo dentro de MainLayout
export default ChatPrivado
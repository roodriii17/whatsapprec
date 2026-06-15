// Importa los hooks useState y useEffect desde la librería de React
import { useState, useEffect } from "react"
// Importa la instancia del cliente socket previamente configurada
import socket from "../../socket"
// Importa el componente de la barra lateral (canales y usuarios en línea)
import Sidebar from "../Sidebar/Sidebar"
// Importa el componente del chat para salas públicas grupales
import Chat from "../Chat/Chat"
// Importa el componente del chat para conversaciones privadas directas
import ChatPrivado from "../Chat/ChatPrivado"
// Importa los estilos de diseño correspondientes al contenedor principal
import "./MainLayout.css"

// Declara el componente MainLayout recibiendo las propiedades desestructuradas de 'usuario'
function MainLayout({ usuario }) {
  // Estado para agrupar los mensajes de salas públicas por su ID: { [salaId]: [mensajes] }
  const [mensajesPorSala, setMensajesPorSala] = useState({})
  // Estado para agrupar los mensajes de chats privados por el ID del usuario: { [otroId]: [mensajes] }
  const [mensajesPrivados, setMensajesPrivados] = useState({})
  // Estado que almacena el arreglo de todos los usuarios actualmente conectados
  const [usuarios, setUsuarios] = useState([])
  // Estado que guarda la lista de salas públicas disponibles en el sistema
  const [salas, setSalas] = useState([])
  // Estado para identificar qué sala pública está seleccionada en pantalla (ID o null)
  const [salaActiva, setSalaActiva] = useState(null)
  // Estado para identificar con qué usuario se mantiene abierto un chat privado (ID o null)
  const [chatPrivadoAbierto, setChatPrivadoAbierto] = useState(null)
  // Estado que lista los usuarios que están tecleando en la sala pública enfocada
  const [escribiendo, setEscribiendo] = useState([])
  // Estado para registrar si alguien te escribe en privado: { [deId]: "Nombre" o null }
  const [escribiendoPrivado, setEscribiendoPrivado] = useState({})

  // Ciclo de vida: Registra los oyentes del socket al montar el componente por única vez
  useEffect(() => {
    // Oyente: Se activa cuando el WebSocket establece conexión con el servidor
    socket.on("connect", () => {
      console.log("✅ Conectado:", socket.id)
      // Envía tu propio perfil al backend para darte de alta en el sistema
      socket.emit("user:join", {
        name: usuario.name,
        estado: usuario.estado,
        avatar: usuario.avatar
      })
    })

    // Oyente: Registra y muestra en consola cualquier error de conexión de red
    socket.on("connect_error", (err) => {
      console.log("❌ Error:", err.message)
    })

    // Oyente: Sincroniza el estado 'usuarios' cada vez que cambia la lista globalizada
    socket.on("users:list", (lista) => setUsuarios(lista))
    // Oyente: Almacena las salas públicas de conversación disponibles en el backend
    socket.on("salas:list", (lista) => setSalas(lista))

    // Oyente: Recibe el arreglo histórico de mensajes al ingresar a una sala
    socket.on("sala:history", ({ salaId, mensajes }) => {
      setMensajesPorSala((prev) => ({ ...prev, [salaId]: mensajes }))
    })

    // Oyente: Recibe un nuevo mensaje público e inyecta el nodo en el ID de sala correcto
    socket.on("mensaje:nuevo", (msg) => {
      setMensajesPorSala((prev) => ({
        ...prev,
        [msg.salaId]: [...(prev[msg.salaId] || []), msg]
      }))
    })

    // Oyente: Recibe un mensaje directo privado enviado o recibido
    socket.on("privado:mensaje", (msg) => {
      // Deduce el ID de la contraparte dependiendo de quién mandó el mensaje
      const otroId = msg.sender.id === socket.id ? msg.paraId : msg.sender.id
      // Añade el mensaje privado al cajón del historial de ese usuario en específico
      setMensajesPrivados((prev) => ({
        ...prev,
        [otroId]: [...(prev[otroId] || []), msg]
      }))
    })

    // Oyente: Sincroniza el historial previo guardado de una conversación uno a uno
    socket.on("privado:historial", ({ conId, mensajes }) => {
      setMensajesPrivados((prev) => ({ ...prev, [conId]: mensajes }))
    })

    // Oyente: Actualiza la lista de personas que se encuentran tecleando en la sala activa
    socket.on("typing:update", ({ users: lista }) => {
      setEscribiendo(lista)
    })

    // Oyente: Controla si un usuario en específico te está escribiendo de forma directa
    socket.on("privado:escribiendo", ({ deId, escribiendo: esta, name }) => {
      setEscribiendoPrivado((prev) => ({ ...prev, [deId]: esta ? name : null }))
    })

    // Ejecuta la conexión manual del cliente socket hacia el backend
    socket.connect()

    // Función de saneamiento: Limpia y apaga los oyentes antes de destruir el componente
    return () => {
      socket.off("connect")
      socket.off("connect_error")
      socket.off("users:list")
      socket.off("salas:list")
      socket.off("sala:history")
      socket.off("mensaje:nuevo")
      socket.off("privado:mensaje")
      socket.off("privado:historial")
      socket.off("typing:update")
      socket.off("privado:escribiendo")
      socket.disconnect() // Cierra la conexión física del WebSocket de forma limpia
    }
  }, []) // Matriz de dependencias vacía para ejecutarse solo al nacer el componente

  // Función: Solicita la entrada a una sala y altera el foco visual de navegación
  function entrarSala(salaId) {
    socket.emit("sala:join", { salaId: salaId }) // Notifica suscripción al backend
    setSalaActiva(salaId) // Pone la sala pública seleccionada en el foco
    setChatPrivadoAbierto(null) // Cierra cualquier chat privado abierto
    setEscribiendo([]) // Resetea los indicadores de escritura en pantalla
  }

  // Función: Notifica la salida de un canal grupal y limpia el foco si estabas en él
  function salirSala(salaId) {
    socket.emit("sala:leave", { salaId: salaId })
    if (salaActiva === salaId) setSalaActiva(null)
  }

  // Función: Abre la mensajería directa y despacha la solicitud de su historial previo
  function abrirPrivado(usuarioId) {
    console.log("Abriendo privado con:", usuarioId)
    socket.emit("privado:historial", { conId: usuarioId })
    setChatPrivadoAbierto(usuarioId) // Define el usuario seleccionado para chat privado
    setSalaActiva(null) // Quita el foco de las salas públicas grupales
  }

  // Función: Cierra el foco del chat privado actual
  function cerrarPrivado() {
    setChatPrivadoAbierto(null)
  }

  // Función: Emite un mensaje de texto/archivo hacia el canal de la sala pública activa
  function enviarMensaje(texto, archivo) {
    if (!salaActiva) return
    socket.emit("mensaje:enviar", {
      salaId: salaActiva,
      text: texto,
      archivo: archivo || null
    })
  }

  // Función: Emite un mensaje de texto/archivo directo al ID del usuario en privado
  function enviarPrivado(texto, archivo) {
    if (!chatPrivadoAbierto) return
    socket.emit("privado:enviar", {
      paraId: chatPrivadoAbierto,
      text: texto,
      archivo: archivo || null
    })
  }

  // Función: Emite la señal al servidor de que estás tecleando en la sala grupal activa
  function empezarEscribir() {
    if (!salaActiva) return
    socket.emit("typing:start", { salaId: salaActiva })
  }

  // Función: Emite la señal al servidor de que detuviste la escritura en la sala grupal
  function pararEscribir() {
    if (!salaActiva) return
    socket.emit("typing:stop", { salaId: salaActiva })
  }

  // Función: Emite la señal de que estás tecleando dentro de un chat privado directo
  function empezarEscribirPrivado() {
    if (!chatPrivadoAbierto) return
    socket.emit("privado:escribiendo", { paraId: chatPrivadoAbierto, escribiendo: true })
  }

  // Función: Emite la señal de que paraste de teclear dentro de un chat privado directo
  function pararEscribirPrivado() {
    if (!chatPrivadoAbierto) return
    socket.emit("privado:escribiendo", { paraId: chatPrivadoAbierto, escribiendo: false })
  }

  // Extracciones de datos calculadas en cada renderizado:
  // Filtra los mensajes de la sala activa actual (retorna array vacío por defecto)
  const mensajesActuales = salaActiva ? (mensajesPorSala[salaActiva] || []) : []
  // Busca las propiedades de metadata correspondientes a la sala que está activa
  const salaActivaInfo = salas.find((s) => s.id === salaActiva)
  // Filtra los mensajes privados correspondientes al chat del usuario abierto
  const mensajesPrivadosActuales = chatPrivadoAbierto ? (mensajesPrivados[chatPrivadoAbierto] || []) : []
  // Busca los datos de perfil (nombre, avatar) del usuario con el que se chatea en privado
  const usuarioPrivado = usuarios.find((u) => u.id === chatPrivadoAbierto)
  // Evalúa si el usuario de la ventana de chat privado activa se encuentra escribiendo
  const estaEscribiendoPrivado = chatPrivadoAbierto ? escribiendoPrivado[chatPrivadoAbierto] : null

  return (
    // Contenedor estructural del diseño general de la pantalla del chat
    <div className="layout">
      {/* Componente Barra Lateral pasándole los datos necesarios y funciones controladoras */}
      <Sidebar
        usuarios={usuarios}
        usuarioActual={usuario}
        salas={salas}
        salaActiva={salaActiva}
        chatPrivadoAbierto={chatPrivadoAbierto}
        onEntrarSala={entrarSala}
        onSalirSala={salirSala}
        onAbrirPrivado={abrirPrivado}
        socketId={socket.id}
      />

      {/* Operador ternario: Si hay un chat privado abierto dibuja 'ChatPrivado', sino dibuja 'Chat' público */}
      {chatPrivadoAbierto ? (
        <ChatPrivado
          mensajes={mensajesPrivadosActuales}
          onEnviar={enviarPrivado}
          onEscribir={empezarEscribirPrivado}
          onParar={pararEscribirPrivado}
          usuarioPrivado={usuarioPrivado}
          estaEscribiendo={estaEscribiendoPrivado}
          socketId={socket.id}
          onCerrar={cerrarPrivado}
        />
      ) : (
        <Chat
          mensajes={mensajesActuales}
          onEnviar={enviarMensaje}
          onEscribir={empezarEscribir}
          onParar={pararEscribir}
          escribiendo={escribiendo}
          usuarioActual={usuario}
          socketId={socket.id}
          salaActiva={salaActivaInfo}
        />
      )}
    </div>
  )
}

// Exporta por defecto el componente MainLayout para su uso en App.jsx
export default MainLayout
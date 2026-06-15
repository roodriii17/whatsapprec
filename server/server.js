// Importa el framework Express para gestionar rutas HTTP tradicionales
const express = require("express")

// Importa el módulo nativo de Node.js para levantar servidores HTTP físicos
const http = require("http")

// Extrae la clase constructora 'Server' de Socket.io para habilitar WebSockets
const { Server } = require("socket.io")

// Importa CORS para permitir que aplicaciones externas (como tu frontend React) hagan peticiones
const cors = require("cors")

// Módulo nativo de criptografía para generar identificadores únicos universales (UUID)
const crypto = require("crypto")

// Importa Multer, la librería especializada en procesar subidas de archivos (Multipart/Form-Data)
const multer = require("multer")

// Módulo nativo para normalizar y estructurar rutas de carpetas en el disco duro
const path = require("path")

// Módulo nativo para interactuar con el sistema de archivos de la máquina
const fs = require("fs")

const app = express()
const server = http.createServer(app) // Vincula la aplicación Express con el servidor HTTP nativo

app.use(cors({ origin: "*" })) // Habilita CORS global permitiendo peticiones desde cualquier origen
app.use(express.json())         // Permite que Express entienda payloads de datos en formato JSON nativo

// Define la ruta absoluta hacia la carpeta donde se almacenarán los archivos subidos
const uploadsDir = path.join(__dirname, "uploads")

// Validación preventiva: Si la carpeta "uploads/" no existe en el proyecto...
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir) // ...la crea de manera síncrona en el disco duro
}
// Expone la carpeta de manera pública a través de la ruta HTTP "/uploads"
app.use("/uploads", express.static(uploadsDir))

// Configura las reglas de almacenamiento físico para Multer en el disco
const storage = multer.diskStorage({
  // Define la carpeta destino de los archivos
  destination: (req, file, cb) => cb(null, uploadsDir),
  // Define el nombre con el que se guardará el archivo para evitar colisiones
  filename: (req, file, cb) => {
    // Genera un nombre basado en un UUID único e inyecta la extensión original (.png, .pdf, etc.)
    const nombre = crypto.randomUUID() + path.extname(file.originalname)
    cb(null, nombre)
  }
})
// Instancia el middleware Multer pasándole la configuración de disco previamente declarada
const upload = multer({ storage: storage })

// Ruta HTTP POST encargada de procesar de forma aislada la carga de archivos adjuntos
app.post("/upload", upload.single("file"), (req, res) => {
  // Si Multer no encontró ningún archivo bajo la clave "file", retorna un error HTTP 400
  if (!req.file) return res.status(400).json({ error: "No se subio ningun archivo" })
  
  // Si todo salió bien, retorna un objeto JSON con los metadatos de acceso público del archivo
  res.json({
    url: "http://localhost:3003/uploads/" + req.file.filename, // Enlace para ver/descargar el archivo
    filename: req.file.originalname,                           // Nombre original del archivo adjuntado
    mimetype: req.file.mimetype,                               // Tipo de archivo (ej: image/png)
    size: req.file.size                                         // Tamaño expresado en bytes
  })
})

// Instancia el servidor de Socket.io acoplándolo al servidor HTTP y configurando sus reglas CORS
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
})

// Base de datos en memoria para almacenar usuarios en línea (Mapa: { [socket.id]: objetoUsuario })
const usuarios = new Map()

// Objeto que simula salas grupales estáticas, almacenando su información básica y el historial de mensajes
const salas = {
  general: { nombre: "General", descripcion: "Sala para todos", mensajes: [] },
  random: { nombre: "Random", descripcion: "Habla de lo que quieras", mensajes: [] },
  tech: { nombre: "Tech", descripcion: "Tecnologia y programacion", mensajes: [] },
  gaming: { nombre: "Gaming", descripcion: "Videojuegos", mensajes: [] }
}

// Base de datos en memoria para chats privados (Mapa: { ["id1_id2"]: [ArregloMensajes] })
const mensajesPrivados = new Map()

// Helper rápido para generar tokens e identificadores únicos de mensajes
function generarId() {
  return crypto.randomUUID()
}

// Helper matemático-estratégico: Une dos IDs de sockets en orden alfabético separados por un guion bajo.
// Esto garantiza que el canal entre UsuarioA y UsuarioB comparta siempre la misma llave exacta ("idA_idB").
function getClavePriva(id1, id2) {
  return [id1, id2].sort().join("_")
}

// Disparador principal que se activa en el momento en que un cliente frontend abre sesión vía WebSocket
io.on("connection", (socket) => {
  console.log("✅ Conectado: " + socket.id)

  // Registra al usuario en la base de datos interna y distribuye listas actualizadas
  socket.on("user:join", (datos) => {
    const usuario = {
      id: socket.id,           // Usa el identificador del socket asignado por la librería
      name: datos.name,
      estado: datos.estado,
      avatar: datos.avatar,
      salas: []                // Arreglo para mapear a qué salas grupales se une este usuario
    }
    // Añade el perfil al Mapa de usuarios activos
    usuarios.set(socket.id, usuario)
    
    // Difunde la lista globalizada de usuarios en línea a TODOS los clientes conectados
    io.emit("users:list", Array.from(usuarios.values()))
    
    // Envía EXCLUSIVAMENTE al usuario que se acaba de conectar el menú con los IDs y nombres de las salas
    socket.emit("salas:list", Object.keys(salas).map((id) => ({
      id: id,
      nombre: salas[id].nombre,
      descripcion: salas[id].descripcion
    })))
  })

  // Evento para procesar el ingreso de un usuario a una sala pública específica
  socket.on("sala:join", (datos) => {
    const salaId = datos.salaId
    const usuario = usuarios.get(socket.id)
    if (!usuario || !salas[salaId]) return // Validación: Cancela si el usuario o la sala no existen
5
    socket.join(salaId) // Introduce el socket físico en el canal interno de Socket.io para esa sala
    if (!usuario.salas.includes(salaId)) usuario.salas.push(salaId) // Registra la sala en su perfil

    // Envía de vuelta solo a este usuario el historial completo de mensajes almacenados en esa sala
    socket.emit("sala:history", {
      salaId: salaId,
      mensajes: salas[salaId].mensajes
    })

    // Construye un mensaje automatizado de tipo sistema
    const msg = {
      id: generarId(),
      type: "system",
      text: usuario.name + " se ha unido a la sala",
      timestamp: new Date().toISOString(),
      salaId: salaId
    }
    salas[salaId].mensajes.push(msg) // Guarda el aviso del sistema en el historial de la sala
    io.to(salaId).emit("mensaje:nuevo", msg) // Notifica el ingreso a todos los miembros de esa sala
  })

  // Evento para salir de una sala de forma voluntaria
  socket.on("sala:leave", (datos) => {
    const salaId = datos.salaId
    const usuario = usuarios.get(socket.id)
    if (!usuario) return

    socket.leave(salaId) // Remueve el socket físico del canal interno de Socket.io
    usuario.salas = usuario.salas.filter((s) => s !== salaId) // Limpia la sala de su perfil

    const msg = {
      id: generarId(),
      type: "system",
      text: usuario.name + " ha salido de la sala",
      timestamp: new Date().toISOString(),
      salaId: salaId
    }
    salas[salaId].mensajes.push(msg)
    io.to(salaId).emit("mensaje:nuevo", msg) // Avisa a los demás miembros de la sala sobre la salida
  })

  // Recibe y distribuye un mensaje emitido dentro de una sala pública
  socket.on("mensaje:enviar", (datos) => {
    const usuario = usuarios.get(socket.id)
    if (!usuario || !salas[datos.salaId]) return

    // Construye la estructura estandarizada del mensaje
    const mensaje = {
      id: generarId(),
      type: "user",
      text: datos.text,
      archivo: datos.archivo || null, // Integra el objeto de metadatos de archivos subidos (si aplica)
      sender: { id: socket.id, name: usuario.name, avatar: usuario.avatar },
      timestamp: new Date().toISOString(),
      salaId: datos.salaId
    }
    salas[datos.salaId].mensajes.push(mensaje) // Almacena el mensaje en el historial del servidor
    io.to(datos.salaId).emit("mensaje:nuevo", mensaje) // Difunde el mensaje a todos los miembros de la sala
  })

  // Recibe y entrega mensajes directos de uno a uno entre dos sockets particulares
  socket.on("privado:enviar", (datos) => {
    const usuarioEmisor = usuarios.get(socket.id)
    const usuarioReceptor = usuarios.get(datos.paraId) // Busca si el receptor sigue en línea
    if (!usuarioEmisor) return

    const clave = getClavePriva(socket.id, datos.paraId) // Obtiene la clave unificada única del chat privado
    if (!mensajesPrivados.has(clave)) mensajesPrivados.set(clave, []) // Si es su primer mensaje, inicializa el array

    const mensaje = {
      id: generarId(),
      type: "user",
      text: datos.text,
      archivo: datos.archivo || null,
      sender: { id: socket.id, name: usuarioEmisor.name, avatar: usuarioEmisor.avatar },
      paraId: datos.paraId,
      timestamp: new Date().toISOString()
    }

    mensajesPrivados.get(clave).push(mensaje) // Añade el mensaje al historial privado de la memoria

    socket.emit("privado:mensaje", mensaje) // Envía una copia del mensaje al emisor para que lo pinte en su pantalla
    if (usuarioReceptor) {
      // Si el receptor está online, le envía el mensaje directo apuntando a su id de socket privado
      io.to(datos.paraId).emit("privado:mensaje", mensaje)
    }
  })

  // Extrae y devuelve el historial privado exclusivo solicitado entre dos personas
  socket.on("privado:historial", (datos) => {
    const clave = getClavePriva(socket.id, datos.conId)
    const historial = mensajesPrivados.get(clave) || []
    // Envía el arreglo de vuelta únicamente al emisor que lo solicitó
    socket.emit("privado:historial", { conId: datos.conId, mensajes: historial })
  })

  // Evento disparado cuando un usuario comienza a teclear en una sala pública
  socket.on("typing:start", (datos) => {
    const usuario = usuarios.get(socket.id)
    if (!usuario) return
    // Notifica a todos en la sala (excepto al emisor) quién está escribiendo
    socket.to(datos.salaId).emit("typing:update", {
      salaId: datos.salaId,
      users: [{ id: socket.id, name: usuario.name }]
    })
  })

  // Evento disparado cuando el usuario borra o pausa la escritura en la sala pública
  socket.on("typing:stop", (datos) => {
    // Vacía el array de personas escribiendo para limpiar el indicador visual en el frontend
    socket.to(datos.salaId).emit("typing:update", {
      salaId: datos.salaId,
      users: []
    })
  })

  // Transmite en tiempo real si un usuario está tecleando dentro de una conversación directa privada
  socket.on("privado:escribiendo", (datos) => {
    const usuario = usuarios.get(socket.id)
    if (!usuario) return
    // Envía el estado directo apuntando exclusivamente al socket ID del receptor
    io.to(datos.paraId).emit("privado:escribiendo", {
      deId: socket.id,
      name: usuario.name,
      escribiendo: datos.escribiendo // true o false
    })
  })

  // Controlador de desconexión (Cierre de pestaña, pérdida de internet, etc.)
  socket.on("disconnect", () => {
    const usuario = usuarios.get(socket.id)
    if (!usuario) return

    // Recorre de forma automática cada sala pública en la que este usuario estaba registrado
    usuario.salas.forEach((salaId) => {
      if (salas[salaId]) {
        // Genera y transmite un mensaje de sistema avisando que el usuario se desconectó
        const msg = {
          id: generarId(),
          type: "system",
          text: usuario.name + " ha salido del chat",
          timestamp: new Date().toISOString(),
          salaId: salaId
        }
        salas[salaId].mensajes.push(msg)
        io.to(salaId).emit("mensaje:nuevo", msg)
      }
    })

    usuarios.delete(socket.id) // Remueve al usuario del Mapa globalizado de personas en línea
    io.emit("users:list", Array.from(usuarios.values())) // Notifica la nueva lista reducida a todos los clientes
    console.log("❌ Desconectado: " + usuario.name)
  })
})

// Pone a escuchar el servidor HTTP en el puerto 3003 asignando la IP '0.0.0.0'
// '0.0.0.0' es fundamental porque le indica al backend que acepte conexiones desde cualquier interfaz de red local,
// permitiendo que otros dispositivos (como tu smartphone conectado al Wi-Fi) accedan al chat usando tu IP privada.
server.listen(3003, "0.0.0.0", () => {
  console.log("🚀 Servidor corriendo en puerto 3004");
});
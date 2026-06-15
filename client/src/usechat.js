
import { useState, useEffect, useCallback, useRef } from "react";

// Importa la instancia única y compartida del cliente Socket.io
import socket from "../socket";

// Define y exporta el Custom Hook 'useChat', el cual recibe como parámetro el objeto de perfil del usuario logueado
export function useChat(profile) {
  // Estado para almacenar los mensajes de salas públicas. Estructura: { [salaId]: [ArregloMensajes] }
  const [messages, setMessages] = useState({});

  // Estado para los mensajes de chats directos privados. Estructura: { [usuarioId]: [ArregloMensajes] }
  const [privateMessages, setPrivateMessages] = useState({});

  // Estado para registrar la lista total de usuarios en línea enviados por el backend
  const [users, setUsers] = useState([]);

  // Estado para listar las salas públicas de conversación disponibles en la aplicación
  const [rooms, setRooms] = useState([]);

  // Registra qué usuarios están escribiendo en cada sala pública. Estructura: { [salaId]: [ListaDeUsuarios] }
  const [typingUsers, setTypingUsers] = useState({});

  // Estado booleano por ID de usuario para saber si te escriben en privado. Estructura: { [deId]: true/false }
  const [privateTyping, setPrivateTyping] = useState({});

  // Almacena el ID de la sala pública en foco. Inicia por defecto en la sala "general"
  const [activeRoom, setActiveRoom] = useState("general");

  // Almacena el ID del socket del usuario con el que se tiene abierto un chat privado (null si no aplica)
  const [activePrivate, setActivePrivate] = useState(null);


  const [joinedRooms, setJoinedRooms] = useState(["general"]);

 
  // evitando que el hilo de ejecución los pierda o los recree de forma errática en cada renderizado.
  const typingTimers = useRef({});

  useEffect(() => {
    // Si el perfil del usuario no se ha definido en el Login, cancela el inicio del ciclo del socket
    if (!profile) return;

    // Ejecuta la conexión manual hacia el servidor de WebSockets
    socket.connect();

    // Evento disparado al consolidar el enlace de red con el backend
    socket.on("connect", () => {
      // Notifica e inyecta los datos de nuestro perfil al ecosistema del backend
      socket.emit("user:join", profile);
    });

    // Sincroniza la lista de usuarios globales activos
    socket.on("users:list", (list) => setUsers(list));

    // Escucha el evento "salas:list" en español tal como está declarado en tu backend
    socket.on("salas:list", (list) => setRooms(list)); 

    //  Recibe el historial de una sala pública mapeándolo bajo su respectivo identificador
    socket.on("sala:history", ({ salaId, mensajes: msgs }) => {
      setMessages((prev) => ({ ...prev, [salaId]: msgs }));
    });

    // Captura mensajes públicos nuevos usando 'msg.salaId' para insertarlo en la sala correcta
    socket.on("mensaje:nuevo", (msg) => {
      setMessages((prev) => ({
        ...prev,
        [msg.salaId]: [...(prev[msg.salaId] || []), msg],
      }));
    });

    // Escucha los mensajes entrantes de canales uno a uno
    socket.on("privado:mensaje", (msg) => {
      // Determina el ID de la contraparte evaluando si nosotros somos los emisores de la burbuja
      const otherId = msg.sender.id === socket.id ? msg.paraId : msg.sender.id;
      // Inyecta el mensaje dentro del cajón del historial correspondiente a ese usuario específico
      setPrivateMessages((prev) => ({
        ...prev,
        [otherId]: [...(prev[otherId] || []), msg],
      }));
    });

    //  Monta los mensajes previos de una conversación privada en el estado
    socket.on("privado:historial", ({ conId, mensajes: msgs }) => {
      setPrivateMessages((prev) => ({ ...prev, [conId]: msgs }));
    });

    // Captura los cambios en el estado de escritura de las salas grupales públicas
    socket.on("typing:update", ({ salaId, users: typingList }) => {
      setTypingUsers((prev) => ({ ...prev, [salaId]: typingList }));
    });

    //  Escucha si un usuario específico está tecleando en un chat uno a uno
    socket.on("privado:escribiendo", ({ deId, escribiendo }) => {
      setPrivateTyping((prev) => ({ ...prev, [deId]: escribiendo }));
    });

    // FUNCIÓN DE LIMPIEZA (CLEANUP): Apaga los listeners y cierra la sesión al desmontar el hook
    return () => {
      socket.off("connect");
      socket.off("users:list");
      socket.off("salas:list");
      socket.off("sala:history");
      socket.off("mensaje:nuevo");
      socket.off("privado:mensaje");
      socket.off("privado:historial");
      socket.off("typing:update");
      socket.off("privado:escribiendo");
      socket.disconnect(); // Corta la conexión de red del socket de forma limpia
    };
  }, [profile]); // Se vuelve a ejecutar únicamente si el objeto 'profile' cambia por completo

  // ACCIÓN: Envía un mensaje (Texto, Archivo o Mixto) deduciendo de forma automática el entorno activo
  const sendMessage = useCallback((text, file = null) => {
    if (activePrivate) {
      // Si el foco está en un usuario, despacha el evento privado hacia el backend
      socket.emit("privado:enviar", { paraId: activePrivate, text, file });
    } else {
      // Si el foco está en una sala pública, despacha el mensaje al canal grupal correspondente
      socket.emit("mensaje:enviar", { salaId: activeRoom, text, file });
      // Detiene inmediatamente el estado de escritura en la sala pública
      socket.emit("typing:stop", { salaId: activeRoom });
    }
  }, [activeRoom, activePrivate]);

  // ACCIÓN: Controla el disparo del estado de tecleo incorporando un temporizador automático de cese (3s)
  const startTyping = useCallback(() => {
    if (activePrivate) {
      // Notifica al socket privado que has empezado a teclear
      socket.emit("privado:escribiendo", { paraId: activePrivate, escribiendo: true });
      // Limpia el temporizador previo de este chat para renovar los 3 segundos de gracia
      clearTimeout(typingTimers.current[activePrivate]);
      // Si pasan 3 segundos sin presionar otra tecla, apaga automáticamente el estado de escritura
      typingTimers.current[activePrivate] = setTimeout(() => {
        socket.emit("privado:escribiendo", { paraId: activePrivate, escribiendo: false });
      }, 3000);
    } else {
      // Notifica al canal de la sala pública que has empezado a teclear
      socket.emit("typing:start", { salaId: activeRoom });
      // Limpia el temporizador previo de la sala para renovar la cuenta regresiva
      clearTimeout(typingTimers.current[activeRoom]);
      // Apaga automáticamente el estado de escritura grupal si el usuario se detiene por 3 segundos
      typingTimers.current[activeRoom] = setTimeout(() => {
        socket.emit("typing:stop", { salaId: activeRoom });
      }, 3000);
    }
  }, [activeRoom, activePrivate]);

  // ACCIÓN: Fuerza la desactivación inmediata del estado "escribiendo..." (ej: al presionar Enviar)
  const stopTyping = useCallback(() => {
    if (activePrivate) {
      socket.emit("privado:escribiendo", { paraId: activePrivate, escribiendo: false });
    } else {
      socket.emit("typing:stop", { salaId: activeRoom });
    }
  }, [activeRoom, activePrivate]);

  // ACCIÓN: Gestiona la lógica para unirse a una nueva sala pública y cambiar la navegación
  const joinRoom = useCallback((roomId) => {
    // Si el cliente no se ha unido previamente a este canal, emite la suscripción física en el backend
    if (!joinedRooms.includes(roomId)) {
      socket.emit("sala:join", { salaId: roomId });
      setJoinedRooms((prev) => [...prev, roomId]); // Añade el ID a la lista de salas unidas
    } else {
      // Si ya estaba unido, simplemente refresca y pide el historial del canal de nuevo
      socket.emit("sala:join", { salaId: roomId });
    }
    setActiveRoom(roomId);      // Mueve el foco visual a la sala pública
    setActivePrivate(null);     // Remueve el foco de cualquier chat privado
  }, [joinedRooms]);

  // ACCIÓN: Abandona una sala pública rompiendo la suscripción en el servidor
  const leaveRoom = useCallback((roomId) => {
    if (roomId === "general") return; // Regla de negocio: La sala 'general' no se puede abandonar
    socket.emit("sala:leave", { salaId: roomId });
    
    // Remueve la sala de nuestra lista local de canales activos
    setJoinedRooms((prev) => prev.filter((r) => r !== roomId));
    
    // Si la sala que abandonamos era la que estábamos viendo, redirige el foco automáticamente a la sala general
    if (activeRoom === roomId) setActiveRoom("general");
  }, [activeRoom]);

  // ACCIÓN: Abre una conversación directa con un usuario y solicita los mensajes guardados en su canal
  const openPrivate = useCallback((socketId) => {
    socket.emit("privado:historial", { conId: socketId });
    setActivePrivate(socketId); // Establece al usuario como el chat privado activo
    setActiveRoom(null);        // Desactiva la visualización de salas públicas
  }, []);

  // ACCIÓN: Cierra el entorno de mensajería directa y restaura la vista por defecto en la sala general
  const closePrivate = useCallback(() => {
    setActivePrivate(null);
    setActiveRoom("general");
  }, []);

  // Retorna un objeto con todos los estados y funciones memorizadas para que los componentes los consuman fácilmente
  return {
    messages,
    privateMessages,
    users,
    rooms,
    typingUsers,
    privateTyping,
    activeRoom,
    activePrivate,
    joinedRooms,
    sendMessage,
    startTyping,
    stopTyping,
    joinRoom,
    leaveRoom,
    openPrivate,
    closePrivate,
    mySocketId: socket.id, // Expone de forma directa nuestro ID de socket actual para realizar validaciones de autoría en las burbujas
  };
}
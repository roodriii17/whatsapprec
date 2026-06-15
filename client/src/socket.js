import { io } from "socket.io-client";

// Apuntamos a la IP de tu PC, pero al puerto 3003 (donde está el backend escuchando)
const socket = io("http://192.168.102.27:3003", {
  autoConnect: false 
});

export default socket;
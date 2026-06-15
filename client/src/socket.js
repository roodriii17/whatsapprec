import { io } from "socket.io-client";

// Apuntamos a la IP de tu PC, pero al puerto 3003 (donde está el backend escuchando)
const socket = io("https://whatsapprec-one.vercel.app", {
  autoConnect: false 
});

export default socket;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; // Componente raíz de la app
import "./index.css";        // Estilos globales

// Monta y renderiza la aplicación de React dentro del contenedor HTML con id "root"
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
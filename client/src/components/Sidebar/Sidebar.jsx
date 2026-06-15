// Importa el hook useState de React para controlar variables locales
import { useState } from "react"
// Importa los estilos CSS específicos para la barra lateral
import "./Sidebar.css"

// Declara el componente Sidebar recibiendo todas las propiedades (props) desestructuradas
function Sidebar({ usuarios, usuarioActual, salas, salaActiva, chatPrivadoAbierto, onEntrarSala, onSalirSala, onAbrirPrivado, socketId }) {
  // Define el estado 'tab' ("salas" por defecto) para alternar entre las pestañas laterales
  const [tab, setTab] = useState("salas")

  // Si los datos de tu perfil aún no se han cargado, muestra un texto temporal de espera
  if (!usuarioActual) return <div className="sidebar">Cargando...</div>

  // Crea una lista que excluye tu propio ID para no mostrarte a ti mismo en la pestaña de usuarios
  const otrosUsuarios = usuarios.filter((u) => u.id !== socketId)

  // Función interna para manejar el clic sobre un usuario y abrir el chat privado de forma segura
  function handleClickUsuario(id) {
    console.log("Click en usuario:", id)
    // Verifica que la propiedad exista y sea una función válida antes de ejecutarla
    if (typeof onAbrirPrivado === "function") {
      onAbrirPrivado(id)
    } else {
      console.log("onAbrirPrivado no es una funcion")
    }
  }

  return (
    // Contenedor principal de la barra lateral
    <div className="sidebar">
      
      {/* SECCIÓN: Cabecera con los datos de tu propio perfil */}
      <div className="sidebar-cabecera">
        <img src={usuarioActual.avatar} alt="yo" className="mi-avatar" />
        <div>
          <p className="mi-nombre">{usuarioActual.name}</p>
          <p className="mi-estado">{usuarioActual.estado}</p>
        </div>
      </div>

      {/* SECCIÓN: Botones selectores de pestañas (Salas o Usuarios) */}
      <div className="tabs">
        {/* Botón de Salas: Se activa visualmente si el estado 'tab' es igual a "salas" */}
        <button
          className={tab === "salas" ? "tab activo" : "tab"}
          onClick={() => setTab("salas")}
        >
          Salas
        </button>
        {/* Botón de Usuarios: Se activa si el estado 'tab' es "usuarios" y muestra el total de conectados */}
        <button
          className={tab === "usuarios" ? "tab activo" : "tab"}
          onClick={() => setTab("usuarios")}
        >
          Usuarios ({otrosUsuarios.length})
        </button>
      </div>

      {/* RENDERIZADO CONDICIONAL: Lista de salas (Visible solo si tab es "salas") */}
      {tab === "salas" && (
        <div className="lista-salas">
          {/* Recorre el arreglo de salas para dibujarlas una por una */}
          {salas.map((sala) => (
            <div
              key={sala.id} // Clave única requerida por React para optimizar la lista
              className={salaActiva === sala.id ? "sala-item activo" : "sala-item"} // Resalta la sala si está abierta
            >
              {/* Contenedor clickeable que activa la función para entrar a la sala */}
              <div onClick={() => onEntrarSala(sala.id)} className="sala-info">
                <p className="sala-nombre"># {sala.nombre}</p>
                <p className="sala-desc">{sala.descripcion}</p>
              </div>
              {/* Muestra el botón "Salir" únicamente en la sala en la que te encuentras activo */}
              {salaActiva === sala.id && (
                <button className="btn-salir" onClick={() => onSalirSala(sala.id)}>
                  Salir
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* RENDERIZADO CONDICIONAL: Lista de usuarios (Visible solo si tab es "usuarios") */}
      {tab === "usuarios" && (
        <div className="lista-usuarios">
          {/* Muestra un aviso amistoso si no hay ninguna otra persona en línea */}
          {otrosUsuarios.length === 0 && (
            <p className="sin-usuarios">No hay nadie más conectado</p>
          )}
          {/* Recorre el arreglo de otros usuarios conectados para listarlos */}
          {otrosUsuarios.map((u) => (
            <div
              key={u.id} // Usa el ID de socket del usuario como clave única
              className={chatPrivadoAbierto === u.id ? "usuario-item activo" : "usuario-item"} // Resalta si su chat privado está abierto
              onClick={() => handleClickUsuario(u.id)} // Llama a la función al hacer clic para abrir el privado
            >
              <img src={u.avatar} alt={u.name} className="usuario-avatar" />
              <div>
                <p className="usuario-nombre">{u.name}</p>
                <p className="usuario-estado">{u.estado}</p>
              </div>
              <span className="punto-verde">●</span> {/* Indicador estético de color verde (online) */}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Sidebar
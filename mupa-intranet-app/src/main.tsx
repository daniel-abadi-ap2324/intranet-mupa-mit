import './styles/fonts.css'
import './styles/tokens.css'
import './styles/components.css'
import './styles/dashboard.css'
import './styles/screens.css'
import './styles/pages/inicio.css'
import './styles/pages/formulario.css'
import './styles/pages/documentos.css'
import './styles/pages/vistas.css'
import './styles/pages/rrhh.css'
import './styles/pages/asistente.css'
import './styles/pages/comunicacion.css'
import './styles/pages/aplicaciones.css'
import './styles/pages/login.css'
import './styles/pages/mesa.css'
import './styles/pages/clinica.css'
import './styles/pages/recorrido.css'
import './styles/pages/gestion.css'
import './styles/pages/gestion-shell.css'
import './styles/pages/gestion-visibilidad.css'
import './styles/spa.css'

import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

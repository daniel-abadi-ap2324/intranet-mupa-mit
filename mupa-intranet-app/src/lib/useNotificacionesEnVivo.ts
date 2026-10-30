/**
 * Avisos en vivo de solicitudes nuevas (para quien las atiende: hoy, todos los gestores). Al llegar una:
 * una campanita, aviso flotante con "Ver" y el evento `mupa:solicitudes`, que actualiza la campana,
 * la bandeja y "Tu panel de gestión". Solo en vivo: lo que llegó sin conexión se ve
 * en los contadores de siempre.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router'

import { api, type Usuario } from '../api'
import { useSitio } from '../components/Proveedores'
import { activa } from './edicion'
import { ATIENDEN_SOLICITUDES, enBandeja } from './gestion'
import { tieneRol } from './roles'

/**
 * Sonido de aviso (public/sonidos/notificacion.wav): "Positive notification" de
 * Mixkit (mixkit.co, licencia libre de Mixkit: uso comercial sin atribución).
 * El navegador solo deja sonar si la persona ya tocó la página: si no, se calla sin error.
 */
function sonar() {
  const audio = new Audio('/sonidos/notificacion.wav')
  audio.volume = 0.6
  audio.play().catch(() => undefined)
}

export function useNotificacionesEnVivo(usuario: Usuario | null) {
  const { avisar } = useSitio()
  const navegar = useNavigate()
  const escucha = activa('bandeja') && tieneRol(usuario, ...ATIENDEN_SOLICITUDES)

  useEffect(() => {
    if (!escucha) return
    return api.escucharNotificaciones((n) => {
      sonar()
      avisar(`Nueva solicitud · ${n.folio} · ${n.formulario}`, { t: 'Ver', fn: () => navegar(enBandeja(n.id)) })
      window.dispatchEvent(new Event('mupa:solicitudes'))
    })
  }, [escucha, avisar, navegar])
}

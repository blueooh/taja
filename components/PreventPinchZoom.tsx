'use client'

import { useEffect } from 'react'

export default function PreventPinchZoom() {
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault()
    }
    const onGesture = (e: Event) => e.preventDefault()

    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('gesturestart' as any, onGesture as EventListener)
    document.addEventListener('gesturechange' as any, onGesture as EventListener)
    document.addEventListener('gestureend' as any, onGesture as EventListener)

    return () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('gesturestart' as any, onGesture as EventListener)
      document.removeEventListener('gesturechange' as any, onGesture as EventListener)
      document.removeEventListener('gestureend' as any, onGesture as EventListener)
    }
  }, [])

  return null
}

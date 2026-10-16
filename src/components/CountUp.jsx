import { useEffect, useRef, useState } from 'react'

// Animates a number from its previous value to the new one.
export default function CountUp({ value, duration = 800, format = (n) => n }) {
  const [display, setDisplay] = useState(Number(value) || 0)
  const fromRef = useRef(Number(value) || 0)

  useEffect(() => {
    const start = fromRef.current
    const end = Number(value) || 0
    if (start === end) {
      setDisplay(end)
      return
    }
    const t0 = performance.now()
    let raf
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(start + (end - start) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = end
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{format(display)}</>
}

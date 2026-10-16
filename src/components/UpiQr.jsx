import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// Renders a UPI payment string as a scannable QR image.
export default function UpiQr({ value, size = 180 }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    let active = true
    if (!value) {
      setDataUrl('')
      return
    }
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => active && setDataUrl(''))
    return () => {
      active = false
    }
  }, [value, size])

  if (!dataUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-600"
        style={{ width: size, height: size }}
      >
        No UPI ID set
      </div>
    )
  }

  return <img src={dataUrl} alt="UPI QR code" width={size} height={size} className="rounded-lg" />
}

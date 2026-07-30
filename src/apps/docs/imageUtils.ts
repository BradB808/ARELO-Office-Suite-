// Small helpers for turning picked/dropped/pasted image files into data
// URLs with known pixel dimensions, ready to insert into the editor.

import { platform } from '../../shared/platform'

const EXT_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
}

export function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? 'image/png'
}

export function isImageFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ext in EXT_MIME
}

export function probeImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 })
    img.onerror = () => resolve({ width: 300, height: 200 })
    img.src = dataUrl
  })
}

export interface SizedImage {
  src: string
  width: number
  height: number
}

/** Scale down (never up) so the image fits within maxWidth, preserving aspect ratio. */
export function fitWidth(width: number, height: number, maxWidth: number): { width: number; height: number } {
  if (width <= maxWidth) return { width, height }
  const ratio = maxWidth / width
  return { width: Math.round(maxWidth), height: Math.round(height * ratio) }
}

export async function fileToSizedImage(file: File, maxWidth: number): Promise<SizedImage> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  const b64 = btoa(binary)
  const mime = file.type || mimeFromName(file.name)
  const dataUrl = `data:${mime};base64,${b64}`
  const natural = await probeImageSize(dataUrl)
  return { src: dataUrl, ...fitWidth(natural.width, natural.height, maxWidth) }
}

/** Open the native file picker and return a sized image, or null if canceled. */
export async function pickImageViaDialog(maxWidth: number): Promise<SizedImage | null> {
  const res = await platform.openFile(
    [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }],
    true,
  )
  if (res.canceled || !res.data || !res.name) return null
  const mime = mimeFromName(res.name)
  const dataUrl = `data:${mime};base64,${res.data}`
  const natural = await probeImageSize(dataUrl)
  return { src: dataUrl, ...fitWidth(natural.width, natural.height, maxWidth) }
}

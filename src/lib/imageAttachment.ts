export function prepareImageAttachment(dataUrl: string, maxSide = 1280, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) { reject(new Error('Could not prepare this image for the Assistant.')); return }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      try {
        const prepared = canvas.toDataURL('image/jpeg', quality)
        if (prepared.length > 1_500_000) { reject(new Error('This image is still too large to send. Use a smaller image.')); return }
        resolve(prepared)
      } catch { reject(new Error('Could not prepare this image for the Assistant.')) }
    }
    image.onerror = () => reject(new Error('Could not read this image from the board.'))
    image.src = dataUrl
  })
}

export function importImageFile(file: File, maxSide = 1800): Promise<{ dataUrl: string; aspectRatio: number }> {
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error('Images must be 25 MB or smaller.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read this image file.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('This image file could not be opened.'))
      image.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) { reject(new Error('Could not prepare this image for the board.')); return }
        context.fillStyle = '#FFFFFF'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        const aspectRatio = image.naturalWidth / image.naturalHeight
        for (const quality of [0.84, 0.74, 0.62]) {
          const dataUrl = canvas.toDataURL('image/jpeg', quality)
          if (dataUrl.length <= 1_500_000) { resolve({ dataUrl, aspectRatio }); return }
        }
        reject(new Error('This image is too detailed to fit the board source limit. Resize it and retry.'))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

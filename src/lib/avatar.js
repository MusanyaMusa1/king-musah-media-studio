// Turns a chosen picture into a small square profile photo: cropped from the middle, 256 x 256, as a JPEG.
// (Small files keep the website fast; the server only accepts a genuine JPEG under 300 KB.)

function defaultLoadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file is not a picture we can read. Please choose a JPG or PNG photo.'))
    }
    img.src = url
  })
}

export async function prepareAvatar(file, deps = {}) {
  const loadImage = deps.loadImage || defaultLoadImage
  const makeCanvas = deps.makeCanvas || (() => document.createElement('canvas'))
  const SIZE = 256

  const img = await loadImage(file)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) throw new Error('That picture could not be read.')

  // take the biggest square from the middle
  const side = Math.min(width, height)
  const sx = Math.floor((width - side) / 2)
  const sy = Math.floor((height - side) / 2)

  const canvas = makeCanvas()
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff' // a transparent PNG becomes white, not black
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE)

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const base64 = dataUrl.split(',')[1]
  if (!base64) throw new Error('That picture could not be prepared. Please try another.')
  return { base64, previewUrl: dataUrl }
}

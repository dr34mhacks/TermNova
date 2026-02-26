// GIF Encoder using gifenc library
import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export async function createGIF(frames, options = {}) {
  const { onProgress } = options;

  if (!frames || frames.length === 0) {
    throw new Error('No frames provided');
  }

  const firstCanvas = frames[0].canvas;
  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const canvas = frame.canvas;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    const palette = quantize(data, 256);
    const indexedPixels = applyPalette(data, palette);
    const delay = Math.round(frame.delay / 10); // Convert ms to centiseconds

    gif.writeFrame(indexedPixels, canvas.width, canvas.height, {
      palette,
      delay: Math.max(2, delay),
    });

    if (onProgress) {
      onProgress((i + 1) / frames.length);
    }

    // Yield to prevent UI blocking
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes], { type: 'image/gif' });
}

export default createGIF;

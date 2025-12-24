import fs from 'fs'
import path from 'path'
import { execSync, exec } from 'child_process'

const tempDir = path.join(process.cwd(), 'storage', 'temp')
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

/**
 * Find Poppler pdftoppm command path
 * Returns path to pdftoppm or null if not available
 */
function findPopplerCommand(): string | null {
  try {
    const result = execSync('which pdftoppm 2>/dev/null', { encoding: 'utf-8' }).trim()
    if (result) {
      // Verify it works
      execSync(`"${result}" -v 2>&1`, { encoding: 'utf-8' })
      return result
    }
  } catch {
    // Not found via which, try common paths
  }

  const possiblePaths = ['/usr/bin/pdftoppm', '/usr/local/bin/pdftoppm', '/opt/homebrew/bin/pdftoppm']
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        execSync(`"${p}" -v 2>&1`, { encoding: 'utf-8' })
        return p
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * Find ImageMagick convert/magick command path
 * Returns path to convert or magick, null if not available
 */
function findImageMagickCommand(): string | null {
  const commands = ['magick', 'convert']

  for (const cmd of commands) {
    try {
      const result = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf-8' }).trim()
      if (result) {
        const version = execSync(`"${result}" -version 2>&1`, { encoding: 'utf-8' })
        if (version.includes('ImageMagick')) {
          return result
        }
      }
    } catch {
      continue
    }
  }

  // Try common paths
  const possiblePaths = [
    '/usr/bin/convert', '/usr/local/bin/convert', '/opt/homebrew/bin/convert',
    '/usr/bin/magick', '/usr/local/bin/magick', '/opt/homebrew/bin/magick'
  ]

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const version = execSync(`"${p}" -version 2>&1`, { encoding: 'utf-8' })
        if (version.includes('ImageMagick')) {
          return p
        }
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * Convert first page of PDF to image using Poppler (preferred) or ImageMagick
 * Returns path to generated image or null if failed
 */
export async function convertPdfFirstPageToImage(pdfPath: string): Promise<string | null> {
  if (!fs.existsSync(pdfPath)) {
    console.error(`[pdfToImage] PDF file not found: ${pdfPath}`)
    return null
  }

  const outputBase = path.join(tempDir, `pdf_page1_${Date.now()}`)

  // Try Poppler first (better quality)
  const popplerCmd = findPopplerCommand()
  if (popplerCmd) {
    try {
      const outputPath = `${outputBase}.png`
      // -r 600: 600 DPI for high quality OCR
      // -png: PNG format (lossless)
      // -singlefile: Single file output
      // -f 1 -l 1: First page only
      const cmd = `"${popplerCmd}" -r 600 -png -singlefile -f 1 -l 1 "${pdfPath}" "${outputBase}"`
      execSync(cmd, { encoding: 'utf-8', timeout: 60000 })

      // Poppler outputs: outputBase.png
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`[pdfToImage] Converted using Poppler: ${outputPath}`)
        return outputPath
      }
    } catch (e: any) {
      console.warn(`[pdfToImage] Poppler conversion failed: ${e.message}`)
    }
  }

  // Fallback to ImageMagick
  const imagickCmd = findImageMagickCommand()
  if (imagickCmd) {
    try {
      const outputPath = `${outputBase}_im.png`
      // -density 600: 600 DPI
      // [0]: First page only
      // -quality 100: Maximum quality
      const cmd = `"${imagickCmd}" -density 600 "${pdfPath}[0]" -quality 100 "${outputPath}"`
      execSync(cmd, { encoding: 'utf-8', timeout: 60000 })

      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        console.log(`[pdfToImage] Converted using ImageMagick: ${outputPath}`)
        return outputPath
      }
    } catch (e: any) {
      console.warn(`[pdfToImage] ImageMagick conversion failed: ${e.message}`)
    }
  }

  console.error('[pdfToImage] No PDF to image converter available (need poppler or imagemagick)')
  return null
}

/**
 * Cleanup temporary image file
 */
export function cleanupTempImage(imagePath: string): void {
  try {
    if (imagePath && fs.existsSync(imagePath) && imagePath.startsWith(tempDir)) {
      fs.unlinkSync(imagePath)
      console.log(`[pdfToImage] Cleaned up temp file: ${imagePath}`)
    }
  } catch (e: any) {
    console.warn(`[pdfToImage] Failed to cleanup temp file: ${e.message}`)
  }
}

/**
 * Check if PDF to image conversion is available
 */
export function isPdfToImageAvailable(): boolean {
  return findPopplerCommand() !== null || findImageMagickCommand() !== null
}

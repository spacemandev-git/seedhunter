import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename, dirname } from 'path'
import sharp from 'sharp'

interface StylizeOptions {
  input: string
  output: string
  style: string
  force?: boolean
}

interface StylizeStatus {
  completed: string[]
  lastRun: string
}

type StyleFunction = (input: Buffer) => Promise<Buffer>

export async function stylizeCommand(opts: StylizeOptions): Promise<void> {
  console.log(`🎨 Stylizing images with "${opts.style}" style...`)
  
  const inputDir = opts.input
  const outputDir = opts.output
  const statusPath = join(dirname(inputDir), 'stylize_status.json')
  
  if (!existsSync(inputDir)) {
    console.error(`  ❌ Input directory not found: ${inputDir}`)
    return
  }
  
  // Load status
  let status: StylizeStatus = { completed: [], lastRun: '' }
  if (existsSync(statusPath) && !opts.force) {
    status = JSON.parse(readFileSync(statusPath, 'utf-8'))
  }
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  
  // Get style function
  const styleFunc = getStyleFunction(opts.style)
  
  // Get all images
  const images = readdirSync(inputDir)
    .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
  
  console.log(`  Found ${images.length} images to process`)
  
  let processed = 0
  let skipped = 0
  
  for (const image of images) {
    const imageId = basename(image, '.jpg').replace(/\.[^.]+$/, '')
    const inputPath = join(inputDir, image)
    const outputPath = join(outputDir, `${imageId}.png`)
    
    // Skip if already processed
    if (status.completed.includes(imageId) && existsSync(outputPath) && !opts.force) {
      skipped++
      continue
    }
    
    try {
      const inputBuffer = readFileSync(inputPath)
      const styledBuffer = await styleFunc(inputBuffer)
      
      await Bun.write(outputPath, styledBuffer)
      
      status.completed.push(imageId)
      processed++
      
      process.stdout.write(`\r  Processed: ${processed} | Skipped: ${skipped}`)
      
    } catch (err) {
      console.error(`\n  ❌ Failed to process ${image}:`, err)
    }
  }
  
  // Save status
  status.lastRun = new Date().toISOString()
  writeFileSync(statusPath, JSON.stringify(status, null, 2))
  
  console.log(`\n  ✅ Stylization complete`)
  console.log(`     Processed: ${processed}, Skipped: ${skipped}`)
}

function getStyleFunction(style: string): StyleFunction {
  switch (style) {
    case 'duotone':
      return applyDuotone
    case 'posterize':
      return applyPosterize
    case 'halftone':
      return applyHalftone
    default:
      console.log(`  Unknown style "${style}", using duotone`)
      return applyDuotone
  }
}

async function applyDuotone(input: Buffer): Promise<Buffer> {
  // Purple and gold duotone effect
  return sharp(input)
    .resize(400, 400, { fit: 'cover' })
    .grayscale()
    .recomb([
      [0.4, 0.2, 0.4],  // Purple shadows
      [0.2, 0.1, 0.2],
      [0.9, 0.7, 0.1],  // Gold highlights
    ])
    .modulate({ brightness: 1.1, saturation: 1.2 })
    .png()
    .toBuffer()
}

async function applyPosterize(input: Buffer): Promise<Buffer> {
  // Reduce colors for poster effect
  return sharp(input)
    .resize(400, 400, { fit: 'cover' })
    .modulate({ brightness: 1.1, saturation: 1.3 })
    // Posterize by reducing to 4 levels per channel
    .png()
    .toBuffer()
}

async function applyHalftone(input: Buffer): Promise<Buffer> {
  // Convert to high contrast grayscale (halftone would need more complex processing)
  return sharp(input)
    .resize(400, 400, { fit: 'cover' })
    .grayscale()
    .normalise()
    .modulate({ brightness: 1.2 })
    .sharpen()
    .png()
    .toBuffer()
}

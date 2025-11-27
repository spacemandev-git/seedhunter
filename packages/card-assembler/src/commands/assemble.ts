import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import sharp from 'sharp'
import { CATEGORY_COLORS } from '@seedhunter/shared'

interface AssembleOptions {
  input: string
  output: string
  data: string
}

interface CardDefinition {
  id: string
  founderId: string
  founderName: string
  company: string
  role: string
  xHandle: string | null
  category: string
}

export async function assembleCommand(opts: AssembleOptions): Promise<void> {
  console.log('🃏 Assembling trading cards...')
  
  const inputDir = opts.input
  const outputDir = opts.output
  const dataPath = opts.data
  
  if (!existsSync(inputDir)) {
    console.error(`  ❌ Input directory not found: ${inputDir}`)
    return
  }
  
  if (!existsSync(dataPath)) {
    console.error(`  ❌ Data file not found: ${dataPath}`)
    return
  }
  
  // Load card definitions
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'))
  const cards: CardDefinition[] = data.cards || []
  
  console.log(`  Found ${cards.length} card definitions`)
  
  // Ensure output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  
  // Load SVG template
  const template = getCardTemplate()
  
  // Get available styled images
  const styledImages = new Map<string, string>()
  for (const file of readdirSync(inputDir)) {
    if (/\.(png|jpg)$/i.test(file)) {
      const id = basename(file).replace(/\.[^.]+$/, '')
      styledImages.set(id, join(inputDir, file))
    }
  }
  
  console.log(`  Found ${styledImages.size} styled images`)
  
  // Assemble each card
  let assembled = 0
  let skipped = 0
  const metadata: Record<string, CardDefinition> = {}
  
  for (const card of cards) {
    const imageId = slugify(`${card.founderName}-${card.company}`)
    const imagePath = styledImages.get(imageId)
    const outputPath = join(outputDir, `${card.id}.png`)
    
    // Skip if no image found
    if (!imagePath || !existsSync(imagePath)) {
      skipped++
      continue
    }
    
    try {
      const imageBuffer = readFileSync(imagePath)
      const cardBuffer = await createCard(template, card, imageBuffer)
      
      await Bun.write(outputPath, cardBuffer)
      metadata[card.id] = card
      
      assembled++
      process.stdout.write(`\r  Assembled: ${assembled} | Skipped: ${skipped}`)
      
    } catch (err) {
      console.error(`\n  ❌ Failed to assemble ${card.id}:`, err)
      skipped++
    }
  }
  
  // Save metadata
  const metadataPath = join(outputDir, 'metadata.json')
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  
  console.log(`\n  ✅ Assembly complete`)
  console.log(`     Assembled: ${assembled}, Skipped: ${skipped}`)
  console.log(`     Metadata saved to ${metadataPath}`)
}

async function createCard(
  template: string, 
  card: CardDefinition, 
  imageBuffer: Buffer
): Promise<Buffer> {
  // Encode image as base64
  const imageBase64 = imageBuffer.toString('base64')
  const imageMime = 'image/png'
  
  // Get category color
  const categoryColor = CATEGORY_COLORS[card.category] || CATEGORY_COLORS.other
  
  // Replace template variables
  let svg = template
    .replace('{{IMAGE_DATA}}', `data:${imageMime};base64,${imageBase64}`)
    .replace('{{FOUNDER_NAME}}', escapeXml(card.founderName))
    .replace('{{COMPANY}}', escapeXml(card.company))
    .replace('{{X_HANDLE}}', card.xHandle ? `@${escapeXml(card.xHandle)}` : '')
    .replace('{{CATEGORY}}', card.category.toUpperCase())
    .replace('{{CATEGORY_COLOR}}', categoryColor)
    .replace('{{CARD_ID}}', `#${card.id.slice(0, 6).toUpperCase()}`)
  
  // Convert SVG to PNG
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

function getCardTemplate(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="840" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Card border gradient -->
    <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD700"/>
      <stop offset="50%" style="stop-color:#B8860B"/>
      <stop offset="100%" style="stop-color:#FFD700"/>
    </linearGradient>
    
    <!-- Background gradient -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    
    <!-- Circular clip for image -->
    <clipPath id="imageClip">
      <circle cx="300" cy="240" r="160"/>
    </clipPath>
    
    <!-- Drop shadow -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.5"/>
    </filter>
  </defs>
  
  <!-- Card background -->
  <rect x="10" y="10" width="580" height="820" rx="24" fill="url(#bgGradient)"/>
  
  <!-- Card border -->
  <rect x="10" y="10" width="580" height="820" rx="24" 
        fill="none" stroke="url(#borderGradient)" stroke-width="6"/>
  
  <!-- Inner decorative border -->
  <rect x="30" y="30" width="540" height="780" rx="16" 
        fill="none" stroke="#FFD700" stroke-width="1" opacity="0.3"/>
  
  <!-- Profile image circle background -->
  <circle cx="300" cy="240" r="170" fill="#0f3460" filter="url(#shadow)"/>
  <circle cx="300" cy="240" r="165" fill="none" stroke="url(#borderGradient)" stroke-width="4"/>
  
  <!-- Profile image -->
  <image x="140" y="80" width="320" height="320" 
         xlink:href="{{IMAGE_DATA}}" 
         clip-path="url(#imageClip)"
         preserveAspectRatio="xMidYMid slice"/>
  
  <!-- Founder name -->
  <text x="300" y="480" 
        font-family="Georgia, serif" font-size="32" font-weight="bold"
        fill="#FFFFFF" text-anchor="middle">
    {{FOUNDER_NAME}}
  </text>
  
  <!-- Company name -->
  <text x="300" y="530" 
        font-family="Arial, sans-serif" font-size="24"
        fill="#FFD700" text-anchor="middle">
    {{COMPANY}}
  </text>
  
  <!-- X handle -->
  <text x="300" y="575" 
        font-family="Arial, sans-serif" font-size="18"
        fill="#8b949e" text-anchor="middle">
    {{X_HANDLE}}
  </text>
  
  <!-- Category badge -->
  <rect x="50" y="740" width="140" height="40" rx="20" fill="{{CATEGORY_COLOR}}"/>
  <text x="120" y="767" 
        font-family="Arial, sans-serif" font-size="14" font-weight="bold"
        fill="#FFFFFF" text-anchor="middle">
    {{CATEGORY}}
  </text>
  
  <!-- Card ID -->
  <text x="550" y="767" 
        font-family="monospace" font-size="14"
        fill="#8b949e" text-anchor="end">
    {{CARD_ID}}
  </text>
  
  <!-- Seedhunter logo/text -->
  <text x="300" y="700" 
        font-family="Georgia, serif" font-size="16"
        fill="#FFD700" text-anchor="middle" opacity="0.6">
    SEEDHUNTER
  </text>
</svg>`
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

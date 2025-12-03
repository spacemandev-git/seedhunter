import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import sharp from 'sharp'

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
  year: number
  category: string
  founderBio: string
  companyDescription: string
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

// Category color schemes (primary, secondary, accent)
const CATEGORY_SCHEMES: Record<string, { primary: string; secondary: string; accent: string; dark: string }> = {
  tech: { primary: '#4A90D9', secondary: '#2C5282', accent: '#63B3ED', dark: '#1A365D' },
  finance: { primary: '#38A169', secondary: '#276749', accent: '#68D391', dark: '#1C4532' },
  retail: { primary: '#DD6B20', secondary: '#9C4221', accent: '#F6AD55', dark: '#652B19' },
  media: { primary: '#9F7AEA', secondary: '#6B46C1', accent: '#B794F4', dark: '#44337A' },
  transport: { primary: '#3182CE', secondary: '#2B6CB0', accent: '#63B3ED', dark: '#1A365D' },
  food: { primary: '#E53E3E', secondary: '#C53030', accent: '#FC8181', dark: '#742A2A' },
  health: { primary: '#38B2AC', secondary: '#2C7A7B', accent: '#4FD1C5', dark: '#234E52' },
  crypto: { primary: '#D69E2E', secondary: '#B7791F', accent: '#F6E05E', dark: '#744210' },
  other: { primary: '#718096', secondary: '#4A5568', accent: '#A0AEC0', dark: '#2D3748' },
}

async function createCard(
  template: string, 
  card: CardDefinition, 
  imageBuffer: Buffer
): Promise<Buffer> {
  // Encode image as base64
  const imageBase64 = imageBuffer.toString('base64')
  const imageMime = 'image/png'
  
  // Get category color scheme
  const scheme = CATEGORY_SCHEMES[card.category] || CATEGORY_SCHEMES.other
  
  // Truncate company description to fit on card
  const truncatedDesc = truncateText(card.companyDescription || '', 90)
  
  // Replace template variables
  let svg = template
    .replace(/\{\{IMAGE_DATA\}\}/g, `data:${imageMime};base64,${imageBase64}`)
    .replace(/\{\{FOUNDER_NAME\}\}/g, escapeXml(card.founderName))
    .replace(/\{\{COMPANY\}\}/g, escapeXml(card.company))
    .replace(/\{\{YEAR\}\}/g, card.year ? String(card.year) : '')
    .replace(/\{\{COMPANY_DESC\}\}/g, escapeXml(truncatedDesc))
    .replace(/\{\{CATEGORY\}\}/g, card.category.toUpperCase())
    .replace(/\{\{CATEGORY_PRIMARY\}\}/g, scheme.primary)
    .replace(/\{\{CATEGORY_SECONDARY\}\}/g, scheme.secondary)
    .replace(/\{\{CATEGORY_ACCENT\}\}/g, scheme.accent)
    .replace(/\{\{CATEGORY_DARK\}\}/g, scheme.dark)
    .replace(/\{\{CARD_ID\}\}/g, `#${card.id.slice(0, 6).toUpperCase()}`)
  
  // Convert SVG to PNG
  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

function getCardTemplate(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="600" height="840" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <!-- Main background gradient -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:{{CATEGORY_DARK}}"/>
      <stop offset="100%" style="stop-color:#0a0a0f"/>
    </linearGradient>
    
    <!-- Accent gradient for stripes -->
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:{{CATEGORY_PRIMARY}}"/>
      <stop offset="100%" style="stop-color:{{CATEGORY_ACCENT}}"/>
    </linearGradient>
    
    <!-- Image clip (rounded rectangle) -->
    <clipPath id="imageClip">
      <rect x="100" y="80" width="410" height="520" rx="16"/>
    </clipPath>
    
    <!-- Drop shadow -->
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.5"/>
    </filter>
    
    <!-- Text shadow -->
    <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="2" stdDeviation="2" flood-opacity="0.8"/>
    </filter>
  </defs>
  
  <!-- Card background -->
  <rect width="600" height="840" rx="24" fill="url(#bgGradient)"/>
  
  <!-- Diagonal accent stripes (top right) -->
  <g opacity="0.9">
    <rect x="380" y="-50" width="25" height="200" fill="{{CATEGORY_PRIMARY}}" transform="rotate(45 450 50)"/>
    <rect x="420" y="-50" width="15" height="200" fill="{{CATEGORY_ACCENT}}" transform="rotate(45 450 50)"/>
    <rect x="450" y="-50" width="8" height="200" fill="{{CATEGORY_PRIMARY}}" transform="rotate(45 450 50)"/>
  </g>
  
  <!-- Left side category bar -->
  <rect x="0" y="0" width="70" height="840" fill="{{CATEGORY_SECONDARY}}" rx="24" 
        style="clip-path: inset(0 0 0 0 round 24px 0 0 24px)"/>
  <rect x="24" y="0" width="46" height="840" fill="{{CATEGORY_PRIMARY}}"/>
  
  <!-- Vertical category text -->
  <text transform="rotate(-90 35 420)" x="35" y="420" 
        font-family="Arial Black, sans-serif" font-size="52" font-weight="900"
        fill="white" text-anchor="middle" letter-spacing="4"
        filter="url(#textShadow)">
    {{CATEGORY}}
  </text>
  
  <!-- Right side decorative stripes -->
  <g transform="translate(540, 300)">
    <rect x="0" y="0" width="8" height="60" fill="{{CATEGORY_PRIMARY}}" transform="rotate(-45)"/>
    <rect x="0" y="25" width="8" height="60" fill="{{CATEGORY_ACCENT}}" transform="rotate(-45)"/>
    <rect x="0" y="50" width="8" height="60" fill="{{CATEGORY_PRIMARY}}" transform="rotate(-45)"/>
    <rect x="0" y="75" width="8" height="60" fill="{{CATEGORY_ACCENT}}" transform="rotate(-45)"/>
    <rect x="0" y="100" width="8" height="60" fill="{{CATEGORY_PRIMARY}}" transform="rotate(-45)"/>
  </g>
  
  <!-- Portrait image area background -->
  <rect x="95" y="75" width="420" height="530" rx="20" fill="#000" opacity="0.3"/>
  
  <!-- Portrait image -->
  <image x="100" y="80" width="410" height="520" 
         xlink:href="{{IMAGE_DATA}}" 
         clip-path="url(#imageClip)"
         preserveAspectRatio="xMidYMid slice"/>
  
  <!-- Image border -->
  <rect x="100" y="80" width="410" height="520" rx="16" 
        fill="none" stroke="{{CATEGORY_PRIMARY}}" stroke-width="3"/>
  
  <!-- Founder name (script style at top) -->
  <text x="310" y="55" 
        font-family="Georgia, serif" font-size="32" font-style="italic"
        fill="{{CATEGORY_ACCENT}}" text-anchor="middle"
        filter="url(#textShadow)">
    {{FOUNDER_NAME}}
  </text>
  
  <!-- Bottom info panel -->
  <rect x="80" y="615" width="450" height="185" rx="16" fill="#000" opacity="0.6"/>
  
  <!-- Company name -->
  <text x="310" y="650" 
        font-family="Arial Black, sans-serif" font-size="26" font-weight="bold"
        fill="white" text-anchor="middle">
    {{COMPANY}}
  </text>
  
  <!-- Year founded -->
  <text x="310" y="680" 
        font-family="Arial, sans-serif" font-size="16"
        fill="{{CATEGORY_ACCENT}}" text-anchor="middle">
    EST. {{YEAR}}
  </text>
  
  <!-- Decorative line -->
  <line x1="120" y1="695" x2="500" y2="695" stroke="{{CATEGORY_PRIMARY}}" stroke-width="1" opacity="0.4"/>
  
  <!-- Company description -->
  <text x="310" y="720" 
        font-family="Arial, sans-serif" font-size="12"
        fill="#aaa" text-anchor="middle">
    {{COMPANY_DESC}}
  </text>
  
  <!-- Card ID -->
  <text x="310" y="775" 
        font-family="monospace" font-size="12"
        fill="#555" text-anchor="middle">
    {{CARD_ID}}
  </text>
  
  <!-- Bottom accent stripe -->
  <rect x="0" y="815" width="600" height="25" fill="{{CATEGORY_PRIMARY}}" rx="0"
        style="clip-path: inset(0 0 0 0 round 0 0 24px 24px)"/>
  <rect x="0" y="815" width="600" height="12" fill="{{CATEGORY_SECONDARY}}"/>
</svg>`
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3).trim() + '...'
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

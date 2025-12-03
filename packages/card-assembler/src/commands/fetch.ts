import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import sharp from 'sharp'

interface FetchOptions {
  input: string
  output: string
  retryFailed?: boolean
}

interface FetchStatus {
  completed: string[]
  failed: { id: string; error: string; attempts: number }[]
  lastRun: string
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

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function fetchCommand(opts: FetchOptions): Promise<void> {
  console.log('🎨 Generating lowpoly portraits using AI (Nano Banana)...')
  
  const inputPath = opts.input
  const outputDir = opts.output
  const statusPath = join(dirname(inputPath), 'fetch_status.json')
  
  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('  ❌ OPENROUTER_API_KEY environment variable is required')
    return
  }
  
  const imageModel = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image'
  console.log(`  Using image model: ${imageModel}`)
  
  // Load founder data
  if (!existsSync(inputPath)) {
    console.error(`  ❌ Input file not found: ${inputPath}`)
    console.log('  Run "generate" command first')
    return
  }
  
  const data = JSON.parse(readFileSync(inputPath, 'utf-8'))
  const cards: CardDefinition[] = data.cards || []
  
  console.log(`  Found ${cards.length} cards to process`)
  
  // Load status
  let status: FetchStatus = {
    completed: [],
    failed: [],
    lastRun: new Date().toISOString()
  }
  
  if (existsSync(statusPath)) {
    status = JSON.parse(readFileSync(statusPath, 'utf-8'))
  }
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  
  // Get unique founders (one image per founder, reused across their companies)
  const founderMap = new Map<string, CardDefinition>()
  for (const card of cards) {
    if (!founderMap.has(card.founderName)) {
      founderMap.set(card.founderName, card)
    }
  }
  
  const uniqueFounders = Array.from(founderMap.values())
  console.log(`  ${uniqueFounders.length} unique founders to generate portraits for`)
  
  // Process each unique founder
  let generated = 0
  let skipped = 0
  let failed = 0
  
  for (const card of uniqueFounders) {
    const imageId = slugify(card.founderName)
    const imagePath = join(outputDir, `${imageId}.png`)
    
    // Skip if already completed
    if (status.completed.includes(imageId) && existsSync(imagePath)) {
      skipped++
      continue
    }
    
    // Skip failed unless retry flag is set
    const previousFail = status.failed.find(f => f.id === imageId)
    if (previousFail && !opts.retryFailed && previousFail.attempts >= 3) {
      skipped++
      continue
    }
    
    console.log(`\n  🎨 Generating portrait for ${card.founderName}...`)
    
    try {
      // Generate lowpoly portrait using AI
      let imageBuffer = await generateLowpolyPortrait(
        apiKey,
        imageModel,
        card.founderName,
        card.founderBio
      )
      
      // Fallback: Generate placeholder if AI fails
      if (!imageBuffer) {
        console.log(`  ⚠️  AI generation failed, using placeholder`)
        imageBuffer = await generatePlaceholder(card.founderName)
      }
      
      // Ensure image is 400x400 PNG
      const finalBuffer = await sharp(imageBuffer)
        .resize(400, 400, { fit: 'cover' })
        .png()
        .toBuffer()
      
      // Save image
      await Bun.write(imagePath, finalBuffer)
      
      // Update status
      status.completed.push(imageId)
      status.failed = status.failed.filter(f => f.id !== imageId)
      
      generated++
      console.log(`  ✅ Generated (${generated} done, ${skipped} skipped, ${failed} failed)`)
      
      // Rate limiting for API
      await sleep(500)
      
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      console.error(`  ❌ Error: ${error}`)
      
      const existingFail = status.failed.find(f => f.id === imageId)
      if (existingFail) {
        existingFail.attempts++
        existingFail.error = error
      } else {
        status.failed.push({ id: imageId, error, attempts: 1 })
      }
      
      failed++
    }
    
    // Save status periodically
    if ((generated + failed) % 5 === 0) {
      status.lastRun = new Date().toISOString()
      writeFileSync(statusPath, JSON.stringify(status, null, 2))
    }
  }
  
  // Now copy founder images for each card (founder-company combo)
  console.log('\n  📋 Creating card-specific image links...')
  
  for (const card of cards) {
    const founderImageId = slugify(card.founderName)
    const founderImagePath = join(outputDir, `${founderImageId}.png`)
    const cardImageId = slugify(`${card.founderName}-${card.company}`)
    const cardImagePath = join(outputDir, `${cardImageId}.png`)
    
    // Skip if same path or already exists
    if (founderImagePath === cardImagePath || existsSync(cardImagePath)) {
      continue
    }
    
    // Copy founder image to card-specific path
    if (existsSync(founderImagePath)) {
      const img = readFileSync(founderImagePath)
      await Bun.write(cardImagePath, img)
    }
  }
  
  // Final status save
  status.lastRun = new Date().toISOString()
  writeFileSync(statusPath, JSON.stringify(status, null, 2))
  
  console.log(`\n  ✅ Generation complete`)
  console.log(`     Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`)
}

// Color palettes for different variation
const COLOR_PALETTES = [
  'cool blues and teals',
  'warm oranges and reds', 
  'purples and magentas',
  'greens and cyans',
  'golden yellows and ambers',
  'pink and coral tones',
  'deep navy and silver',
]

async function generateLowpolyPortrait(
  apiKey: string,
  model: string,
  name: string,
  bio: string
): Promise<Buffer | null> {
  try {
    // Use name hash to pick a consistent color palette for this founder
    const colorIndex = Math.abs(hashCode(name)) % COLOR_PALETTES.length
    const colorPalette = COLOR_PALETTES[colorIndex]
    
    // Create a generic description, avoiding real person's name
    const prompt = `Create an abstract lowpoly geometric portrait of a fictional business professional.

IMPORTANT: This is NOT a real person - create an original fictional character. Do not attempt to recreate any real person's likeness.

Style requirements:
- Abstract low polygon geometric art style with angular facets and triangular shapes
- Color palette: ${colorPalette}
- Professional portrait composition (head and shoulders silhouette)
- Highly stylized and abstract - NOT realistic, NOT photo-like
- Clean geometric shapes suggesting facial features (abstract, not detailed)
- Gradient or abstract geometric background matching the color palette
- Modern digital art aesthetic suitable for a trading card
- Think of it as an artistic icon/avatar, like abstract profile pictures
- The face should be made of large geometric polygons, very stylized`

    console.log(`  📤 Sending request to ${model}...`)
    
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://seedhunter.app',
        'X-Title': 'Seedhunter Card Assembler'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
        image_config: {
          aspect_ratio: '1:1'
        }
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error(`  ⚠️  API error: ${response.status} - ${error.substring(0, 200)}`)
      return null
    }
    
    const data = await response.json()
    
    // Extract image from response
    const imageBuffer = extractImageFromResponse(data)
    if (imageBuffer) {
      console.log(`  📥 Received image (${imageBuffer.length} bytes)`)
      return imageBuffer
    }
    
    console.log(`  ⚠️  Could not extract image from response`)
    const msg = data.choices?.[0]?.message
    if (msg) {
      console.log(`  Message keys: ${Object.keys(msg).join(', ')}`)
      if (msg.refusal) {
        console.log(`  Refusal reason: ${msg.refusal}`)
      }
      if (msg.images) {
        console.log(`  Images array length: ${msg.images.length}`)
        if (msg.images.length > 0) {
          console.log(`  First image preview: ${JSON.stringify(msg.images[0]).substring(0, 200)}`)
        }
      }
      if (msg.content) {
        console.log(`  Content: ${typeof msg.content === 'string' ? msg.content.substring(0, 200) : JSON.stringify(msg.content).substring(0, 200)}`)
      }
    }
    return null
    
  } catch (err) {
    console.error(`  ❌ Generation error:`, err)
    return null
  }
}

/**
 * Extract image from OpenRouter API response
 * Checks multiple possible locations where the image data might be
 */
function extractImageFromResponse(data: any): Buffer | null {
  const message = data.choices?.[0]?.message
  if (!message) return null
  
  // Check for refusal
  if (message.refusal) {
    console.log(`  ⚠️  Model refused: ${message.refusal}`)
    return null
  }
  
  // Check 1: message.images array (Gemini image models)
  if (message.images && Array.isArray(message.images) && message.images.length > 0) {
    console.log(`  Found ${message.images.length} images in response`)
    const img = message.images[0]
    console.log(`  Image type: ${typeof img}`)
    
    if (typeof img === 'string') {
      // Could be data URL or raw base64
      if (img.startsWith('data:image')) {
        const base64Match = img.match(/^data:image\/[^;]+;base64,(.+)$/)
        if (base64Match) {
          return Buffer.from(base64Match[1], 'base64')
        }
      }
      // Try as raw base64
      try {
        const buffer = Buffer.from(img, 'base64')
        if (buffer.length > 100) { // Sanity check
          return buffer
        }
      } catch {}
    }
    
    if (typeof img === 'object') {
      console.log(`  Image object keys: ${Object.keys(img).join(', ')}`)
      if (img.data) return Buffer.from(img.data, 'base64')
      if (img.b64_json) return Buffer.from(img.b64_json, 'base64')
      if (img.url && img.url.startsWith('data:image')) {
        const base64Match = img.url.match(/^data:image\/[^;]+;base64,(.+)$/)
        if (base64Match) {
          return Buffer.from(base64Match[1], 'base64')
        }
      }
    }
  }
  
  // Check 2: message.image (direct image field)
  if (message.image) {
    console.log(`  Found direct image field`)
    if (typeof message.image === 'string') {
      const base64Match = message.image.match(/^data:image\/[^;]+;base64,(.+)$/)
      if (base64Match) {
        return Buffer.from(base64Match[1], 'base64')
      }
      try {
        return Buffer.from(message.image, 'base64')
      } catch {}
    }
  }
  
  // Check 3: message.content as array (multimodal response)
  const content = message.content
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const base64Match = part.image_url.url.match(/^data:image\/[^;]+;base64,(.+)$/)
        if (base64Match) {
          return Buffer.from(base64Match[1], 'base64')
        }
      }
      if (part.type === 'image' && part.source?.data) {
        return Buffer.from(part.source.data, 'base64')
      }
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64')
      }
      if (part.inline_data?.data) {
        return Buffer.from(part.inline_data.data, 'base64')
      }
    }
  }
  
  // Check 4: message.content as string with embedded base64
  if (typeof content === 'string' && content.length > 0) {
    const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/)
    if (base64Match) {
      return Buffer.from(base64Match[1], 'base64')
    }
  }
  
  // Check 5: Top-level data array (DALL-E style)
  if (data.data && Array.isArray(data.data)) {
    for (const item of data.data) {
      if (item.b64_json) return Buffer.from(item.b64_json, 'base64')
      if (item.url?.startsWith('data:image')) {
        const base64Match = item.url.match(/^data:image\/[^;]+;base64,(.+)$/)
        if (base64Match) {
          return Buffer.from(base64Match[1], 'base64')
        }
      }
    }
  }
  
  return null
}

async function generatePlaceholder(name: string): Promise<Buffer> {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  
  // Geometric lowpoly-style placeholder
  const colors = ['#E94560', '#4A90D9', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E74C3C']
  const bgColor = colors[Math.abs(hashCode(name)) % colors.length]
  const accentColor = colors[(Math.abs(hashCode(name)) + 3) % colors.length]
  
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${bgColor}"/>
          <stop offset="100%" style="stop-color:${accentColor}"/>
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#grad)"/>
      <polygon points="0,0 200,50 100,150 0,100" fill="${bgColor}" opacity="0.6"/>
      <polygon points="200,50 400,0 400,100 300,150" fill="${accentColor}" opacity="0.6"/>
      <polygon points="0,100 100,150 50,250 0,200" fill="${accentColor}" opacity="0.4"/>
      <polygon points="400,100 300,150 350,250 400,200" fill="${bgColor}" opacity="0.4"/>
      <polygon points="100,150 200,100 300,150 200,200" fill="white" opacity="0.15"/>
      <polygon points="200,200 100,250 200,300 300,250" fill="white" opacity="0.1"/>
      <polygon points="0,300 100,350 0,400" fill="${bgColor}" opacity="0.5"/>
      <polygon points="400,300 300,350 400,400" fill="${accentColor}" opacity="0.5"/>
      <text x="200" y="220" font-family="Arial, sans-serif" font-size="100" 
            fill="white" text-anchor="middle" font-weight="bold">
        ${initials}
      </text>
    </svg>
  `
  
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return hash
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

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

export async function fetchCommand(opts: FetchOptions): Promise<void> {
  console.log('📸 Fetching profile pictures...')
  
  const inputPath = opts.input
  const outputDir = opts.output
  const statusPath = join(dirname(inputPath), 'fetch_status.json')
  
  // Load founder data
  if (!existsSync(inputPath)) {
    console.error(`  ❌ Input file not found: ${inputPath}`)
    console.log('  Run "generate" command first')
    return
  }
  
  const data = JSON.parse(readFileSync(inputPath, 'utf-8'))
  const cards = data.cards || []
  
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
  
  // Process each card
  let fetched = 0
  let skipped = 0
  let failed = 0
  
  for (const card of cards) {
    const imageId = `${slugify(card.founderName)}-${slugify(card.company)}`
    const imagePath = join(outputDir, `${imageId}.jpg`)
    
    // Skip if already completed
    if (status.completed.includes(imageId) && existsSync(imagePath)) {
      skipped++
      continue
    }
    
    // Skip failed unless retry flag is set
    const previousFail = status.failed.find(f => f.id === imageId)
    if (previousFail && !opts.retryFailed) {
      skipped++
      continue
    }
    
    try {
      // Try to fetch from X if handle exists
      let imageBuffer: Buffer | null = null
      
      if (card.xHandle && process.env.X_BEARER_TOKEN) {
        imageBuffer = await fetchFromX(card.xHandle)
      }
      
      // Fallback: Generate placeholder
      if (!imageBuffer) {
        imageBuffer = await generatePlaceholder(card.founderName)
      }
      
      // Save image
      await Bun.write(imagePath, imageBuffer)
      
      // Update status
      status.completed.push(imageId)
      status.failed = status.failed.filter(f => f.id !== imageId)
      
      fetched++
      process.stdout.write(`\r  Fetched: ${fetched} | Skipped: ${skipped} | Failed: ${failed}`)
      
      // Rate limiting
      await sleep(100)
      
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error'
      
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
    if ((fetched + failed) % 10 === 0) {
      status.lastRun = new Date().toISOString()
      writeFileSync(statusPath, JSON.stringify(status, null, 2))
    }
  }
  
  // Final status save
  status.lastRun = new Date().toISOString()
  writeFileSync(statusPath, JSON.stringify(status, null, 2))
  
  console.log(`\n  ✅ Fetch complete`)
  console.log(`     Fetched: ${fetched}, Skipped: ${skipped}, Failed: ${failed}`)
}

async function fetchFromX(handle: string): Promise<Buffer | null> {
  try {
    const token = process.env.X_BEARER_TOKEN
    if (!token) return null
    
    const response = await fetch(
      `https://api.twitter.com/2/users/by/username/${handle}?user.fields=profile_image_url`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    const imageUrl = data.data?.profile_image_url?.replace('_normal', '_400x400')
    
    if (!imageUrl) return null
    
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) return null
    
    return Buffer.from(await imageResponse.arrayBuffer())
    
  } catch {
    return null
  }
}

async function generatePlaceholder(name: string): Promise<Buffer> {
  // Generate a simple colored placeholder with initials
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  
  // Create SVG placeholder
  const colors = ['#E94560', '#4A90D9', '#2ECC71', '#F39C12', '#9B59B6']
  const color = colors[Math.abs(hashCode(name)) % colors.length]
  
  const svg = `
    <svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="${color}"/>
      <text x="200" y="220" font-family="Arial, sans-serif" font-size="120" 
            fill="white" text-anchor="middle" font-weight="bold">
        ${initials}
      </text>
    </svg>
  `
  
  // Convert SVG to PNG using sharp
  const sharp = (await import('sharp')).default
  return await sharp(Buffer.from(svg)).png().toBuffer()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
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

import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, basename } from 'path'

interface ExportOptions {
  input: string
  backend: string
}

export async function exportCommand(opts: ExportOptions): Promise<void> {
  console.log('📦 Exporting cards to backend...')
  
  const inputDir = opts.input
  const backendDir = opts.backend
  
  if (!existsSync(inputDir)) {
    console.error(`  ❌ Input directory not found: ${inputDir}`)
    return
  }
  
  // Ensure backend directory exists
  if (!existsSync(backendDir)) {
    mkdirSync(backendDir, { recursive: true })
  }
  
  // Get all card images
  const cardFiles = readdirSync(inputDir).filter(f => f.endsWith('.png'))
  console.log(`  Found ${cardFiles.length} card images`)
  
  // Copy card images
  let copied = 0
  for (const file of cardFiles) {
    const src = join(inputDir, file)
    const dest = join(backendDir, file)
    copyFileSync(src, dest)
    copied++
    process.stdout.write(`\r  Copied: ${copied}/${cardFiles.length}`)
  }
  
  console.log('')
  
  // Copy and transform metadata
  const metadataPath = join(inputDir, 'metadata.json')
  if (existsSync(metadataPath)) {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'))
    
    // Create manifest for backend
    const manifest = {
      totalCards: Object.keys(metadata).length,
      cards: Object.entries(metadata).map(([id, card]: [string, any]) => ({
        id,
        founderName: card.founderName,
        company: card.company,
        role: card.role,
        xHandle: card.xHandle,
        category: card.category,
        imagePath: `/static/cards/${id}.png`,
      })),
      generatedAt: new Date().toISOString(),
    }
    
    const manifestPath = join(backendDir, 'manifest.json')
    await Bun.write(manifestPath, JSON.stringify(manifest, null, 2))
    console.log(`  Manifest saved to ${manifestPath}`)
    
    // Generate SQL seed statements
    const sql = generateSeedSQL(manifest.cards)
    const sqlPath = join(backendDir, 'seed.sql')
    await Bun.write(sqlPath, sql)
    console.log(`  SQL seed saved to ${sqlPath}`)
  }
  
  console.log(`  ✅ Export complete`)
  console.log(`     Exported ${copied} cards to ${backendDir}`)
}

function generateSeedSQL(cards: any[]): string {
  const lines = [
    '-- Seedhunter Cards Seed Data',
    `-- Generated at ${new Date().toISOString()}`,
    '',
    '-- Clear existing cards',
    'DELETE FROM cards;',
    '',
    '-- Insert cards',
  ]
  
  for (const card of cards) {
    const values = [
      `'${card.id}'`,
      `'${escapeSql(card.founderName)}'`,
      `'${escapeSql(card.company)}'`,
      card.role ? `'${escapeSql(card.role)}'` : 'NULL',
      card.xHandle ? `'${escapeSql(card.xHandle)}'` : 'NULL',
      `'${card.category}'`,
      `'${card.imagePath}'`,
      Date.now().toString(),
    ].join(', ')
    
    lines.push(`INSERT INTO cards (id, founder_name, company, role, x_handle, category, image_path, created_at) VALUES (${values});`)
  }
  
  return lines.join('\n')
}

function escapeSql(text: string): string {
  return text.replace(/'/g, "''")
}

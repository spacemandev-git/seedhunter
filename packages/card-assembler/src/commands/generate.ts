import OpenAI from 'openai'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

interface Founder {
  id: string
  name: string
  companies: { name: string; role: string; year: number }[]
  xHandle: string | null
  category: string
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

interface GenerateOptions {
  count: string
  output: string
  append?: boolean
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  console.log('📝 Generating founder list...')
  
  const count = parseInt(opts.count)
  const outputPath = opts.output
  
  // Check for existing data
  let existingFounders: Founder[] = []
  if (opts.append && existsSync(outputPath)) {
    const data = JSON.parse(readFileSync(outputPath, 'utf-8'))
    existingFounders = data.founders || []
    console.log(`  Found ${existingFounders.length} existing founders`)
  }
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  
  const prompt = `Generate a JSON array of ${count} famous founders from various industries.

For each founder, provide:
- name: Full name
- companies: Array of companies they founded, each with { name, role, year }
- xHandle: Their X/Twitter handle (without @) or null if unknown
- category: One of: tech, finance, retail, media, transport, food, health, crypto

Requirements:
- Include founders from ALL time periods (1800s to present)
- Include diverse geographic regions (US, Europe, Asia, Africa, etc.)
- Include diverse genders
- Include various industries equally
- For serial founders, list ALL their companies
- Be accurate with real founders

Return ONLY valid JSON array, no markdown or explanation.

Example format:
[
  {
    "name": "Elon Musk",
    "companies": [
      { "name": "Tesla", "role": "CEO & Co-founder", "year": 2003 },
      { "name": "SpaceX", "role": "CEO & Founder", "year": 2002 }
    ],
    "xHandle": "elonmusk",
    "category": "tech"
  }
]`

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 16000,
    })
    
    const content = response.choices[0].message.content || '[]'
    const founders: Founder[] = JSON.parse(content).map((f: any) => ({
      ...f,
      id: crypto.randomUUID()
    }))
    
    console.log(`  Generated ${founders.length} founders`)
    
    // Merge with existing
    const allFounders = [...existingFounders, ...founders]
    
    // Deduplicate by name
    const uniqueFounders = Array.from(
      new Map(allFounders.map(f => [f.name.toLowerCase(), f])).values()
    )
    
    console.log(`  Total unique founders: ${uniqueFounders.length}`)
    
    // Generate card definitions (one per founder-company pair)
    const cards: CardDefinition[] = []
    for (const founder of uniqueFounders) {
      for (const company of founder.companies) {
        cards.push({
          id: crypto.randomUUID(),
          founderId: founder.id,
          founderName: founder.name,
          company: company.name,
          role: company.role,
          xHandle: founder.xHandle,
          category: founder.category,
        })
      }
    }
    
    console.log(`  Generated ${cards.length} card definitions`)
    
    // Write output
    const dir = dirname(outputPath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    
    const output = {
      founders: uniqueFounders,
      cards,
      generatedAt: new Date().toISOString(),
    }
    
    writeFileSync(outputPath, JSON.stringify(output, null, 2))
    console.log(`  ✅ Saved to ${outputPath}`)
    
  } catch (err) {
    console.error('  ❌ Generation failed:', err)
    throw err
  }
}

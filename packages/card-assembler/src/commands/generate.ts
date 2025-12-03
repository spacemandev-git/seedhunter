import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

interface Company {
  name: string
  role: string
  year: number
  description: string
}

interface Founder {
  id: string
  name: string
  companies: Company[]
  category: string
  bio: string
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

interface GenerateOptions {
  count: string
  output: string
  append?: boolean
  categories?: string  // Comma-separated list of categories to focus on
}

const ALL_CATEGORIES = ['tech', 'finance', 'retail', 'media', 'transport', 'food', 'health', 'crypto']

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  console.log('📝 Generating founder list...')
  
  const count = parseInt(opts.count)
  const outputPath = opts.output
  
  // Parse categories filter
  let selectedCategories = ALL_CATEGORIES
  if (opts.categories) {
    selectedCategories = opts.categories
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter(c => ALL_CATEGORIES.includes(c))
    
    if (selectedCategories.length === 0) {
      console.error(`  ❌ No valid categories specified. Valid options: ${ALL_CATEGORIES.join(', ')}`)
      return
    }
    console.log(`  Focusing on categories: ${selectedCategories.join(', ')}`)
  }
  
  // Check for existing data
  let existingFounders: Founder[] = []
  if (opts.append && existsSync(outputPath)) {
    const data = JSON.parse(readFileSync(outputPath, 'utf-8'))
    existingFounders = data.founders || []
    console.log(`  Found ${existingFounders.length} existing founders`)
  }
  
  // Build category instruction
  const categoryInstruction = selectedCategories.length === ALL_CATEGORIES.length
    ? `- category: One of: ${ALL_CATEGORIES.join(', ')}`
    : `- category: MUST be one of: ${selectedCategories.join(', ')} (ONLY generate founders from these industries)`
  
  const industryRequirement = selectedCategories.length === ALL_CATEGORIES.length
    ? '- Include various industries equally'
    : `- ONLY include founders from these industries: ${selectedCategories.join(', ')}. Distribute founders evenly across these categories.`
  
  const prompt = `Generate a JSON array of ${count} famous founders.

For each founder, provide:
- name: Full name (as it would appear on Wikipedia)
- bio: A 1-2 sentence biography of the founder describing their background and impact
- companies: Array of companies they founded, each with:
  - name: Company name
  - role: Their role (e.g., "CEO & Founder")
  - year: Year founded
  - description: A 2-3 sentence description of the company and its significance
${categoryInstruction}

Requirements:
- Include founders from ALL time periods (1800s to present)
- Include diverse geographic regions (US, Europe, Asia, Africa, etc.)
- Include diverse genders
${industryRequirement}
- For serial founders, list ALL their notable companies (each becomes a separate card)
- Be accurate with real founders who have Wikipedia pages
- The bio should capture who they are, their achievements
- Each company description should explain what the company does and its impact

Return ONLY valid JSON array, no markdown or explanation.

Example format:
[
  {
    "name": "Elon Musk",
    "bio": "South African-born entrepreneur and engineer who became one of the wealthiest people in history. Known for his ambitious projects in electric vehicles, space exploration, and sustainable energy.",
    "companies": [
      { 
        "name": "Tesla", 
        "role": "CEO & Co-founder", 
        "year": 2003,
        "description": "Electric vehicle and clean energy company that revolutionized the automotive industry. Tesla produces electric cars, battery energy storage, and solar panels."
      },
      { 
        "name": "SpaceX", 
        "role": "CEO & Founder", 
        "year": 2002,
        "description": "Aerospace manufacturer and space transportation company. SpaceX developed reusable rockets and aims to enable human colonization of Mars."
      }
    ],
    "category": "tech"
  }
]`

  try {
    // Use OpenRouter API with Gemini text model
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required')
    }
    
    const model = process.env.OPENROUTER_TEXT_MODEL || 'google/gemini-2.5-flash-preview-05-20'
    console.log(`  Using model: ${model}`)
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
        temperature: 0.7,
        max_tokens: 32000,
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
    }
    
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    
    // Clean up content (remove markdown code blocks if present)
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const founders: Founder[] = JSON.parse(cleanContent).map((f: any) => ({
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
          year: company.year,
          category: founder.category,
          founderBio: founder.bio,
          companyDescription: company.description,
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

# Card Assembler Architecture

> Bun CLI tool for generating founder trading cards

## Module Overview

```
packages/card-assembler/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── commands/
│   │   ├── generate.ts    # M1: Generate founder list
│   │   ├── fetch.ts       # M2: Fetch profile pictures
│   │   ├── stylize.ts     # M3: Apply visual style
│   │   ├── assemble.ts    # M4: Create final cards
│   │   └── export.ts      # M5: Export to backend
│   ├── templates/
│   │   └── card.svg       # M6: SVG card template
│   ├── data/
│   │   ├── founders.json  # Generated founder list
│   │   └── processed/     # Intermediate files
│   └── utils/
│       ├── ai.ts          # OpenAI helper
│       └── image.ts       # Image processing
├── output/
│   └── cards/             # Final card images
└── package.json
```

---

## Pipeline Overview

```
[M1: Generate List] → [M2: Fetch Images] → [M3: Stylize] → [M4: Assemble] → [M5: Export]
       ↓                     ↓                  ↓               ↓
  founders.json         raw_images/        styled_images/    cards/
```

Each step is resumable - it checks existing files and only processes missing items.

---

## M1: Generate Founder List

**File:** `src/commands/generate.ts`

**Purpose:** Use AI to generate a list of famous founders.

**CLI:**
```bash
bun run generate --count 200 --output data/founders.json
```

**Output Schema:**
```typescript
interface Founder {
  id: string              // UUID
  name: string            // "Elon Musk"
  companies: Company[]    // Multiple if serial founder
  xHandle: string | null  // "@elonmusk" or null
  category: string        // "tech", "finance", "retail", etc.
}

interface Company {
  name: string            // "Tesla"
  role: string            // "CEO & Co-founder"
  year: number            // Founded year
}

// One card per founder-company pair
interface CardDefinition {
  id: string
  founderId: string
  founderName: string
  company: string
  role: string
  xHandle: string | null
  category: string
}
```

**AI Prompt Strategy:**
```typescript
const prompt = `Generate a JSON list of ${count} famous founders across all industries.
Include:
- Tech (software, hardware, AI)
- Finance (banks, fintech, crypto)
- Retail (e-commerce, brands)
- Media (entertainment, news)
- Transportation
- Food & Beverage
- Healthcare

For each founder include:
- Full name
- All companies they founded (create separate entry for each)
- Their X/Twitter handle if they have one
- Category

Ensure diversity in:
- Industries
- Time periods (historical to modern)
- Geography (not just US founders)
- Gender

Return as JSON array.`
```

**Resumability:**
- Check if `founders.json` exists
- If exists, load and allow `--append` to add more
- Deduplicate by founder name + company

**Dependencies:** OpenAI API

---

## M2: Fetch Profile Pictures

**File:** `src/commands/fetch.ts`

**Purpose:** Download profile pictures from X or fallback sources.

**CLI:**
```bash
bun run fetch --input data/founders.json --output data/raw_images/
```

**Process:**
```typescript
async function fetchProfilePicture(founder: Founder): Promise<string> {
  // 1. Try X API if handle exists
  if (founder.xHandle) {
    const xImage = await fetchFromX(founder.xHandle)
    if (xImage) return xImage
  }
  
  // 2. Fallback to web search
  const searchImage = await searchForImage(`${founder.name} portrait`)
  if (searchImage) return searchImage
  
  // 3. Generate placeholder
  return generatePlaceholder(founder.name)
}
```

**Output Structure:**
```
data/raw_images/
├── elon-musk-tesla.jpg
├── elon-musk-spacex.jpg
├── jeff-bezos-amazon.jpg
└── ...
```

**Resumability:**
- Check if image file exists before fetching
- Track fetch status in `data/fetch_status.json`
- Retry failed fetches with `--retry-failed`

**Rate Limiting:**
- X API: Respect rate limits with exponential backoff
- Web search: 1 request per second

**Dependencies:** X API (optional), image search API, `sharp`

---

## M3: Stylize Images

**File:** `src/commands/stylize.ts`

**Purpose:** Apply consistent visual style to all profile pictures.

**CLI:**
```bash
bun run stylize --input data/raw_images/ --output data/styled_images/ --style duotone
```

**Style Options:**
```typescript
type StyleOption = 
  | "duotone"      // Two-color filter (e.g., purple/gold)
  | "posterize"    // Reduced color palette
  | "halftone"     // Comic book dots
  | "outline"      // Line art effect
  | "vaporwave"    // Retro aesthetic
```

**Processing Pipeline:**
```typescript
async function stylizeImage(inputPath: string, style: StyleOption): Promise<Buffer> {
  const image = sharp(inputPath)
  
  // 1. Normalize dimensions (400x400)
  image.resize(400, 400, { fit: 'cover' })
  
  // 2. Apply style filter
  switch (style) {
    case 'duotone':
      image.recomb([
        [0.3, 0.3, 0.3],  // Luminance
        [0.6, 0.1, 0.3],  // Purple tint
        [0.9, 0.7, 0.1],  // Gold highlights
      ])
      break
    // ... other styles
  }
  
  // 3. Apply consistent overlay
  image.composite([
    { input: 'templates/overlay.png', blend: 'overlay' }
  ])
  
  return image.toBuffer()
}
```

**Resumability:**
- Skip already processed images
- Track in `data/stylize_status.json`
- Allow `--force` to reprocess all

**Dependencies:** `sharp`

---

## M4: Assemble Cards

**File:** `src/commands/assemble.ts`

**Purpose:** Combine styled images with SVG template to create final cards.

**CLI:**
```bash
bun run assemble --input data/styled_images/ --output output/cards/
```

**Card Layout:**
```
┌──────────────────────────┐
│  ╔════════════════════╗  │
│  ║                    ║  │
│  ║   [Profile Image]  ║  │
│  ║      400x400       ║  │
│  ║                    ║  │
│  ╚════════════════════╝  │
│                          │
│  ┌────────────────────┐  │
│  │   FOUNDER NAME     │  │
│  │   Company Name     │  │
│  │   @xhandle         │  │
│  └────────────────────┘  │
│                          │
│  [Category Badge]  [#ID] │
└──────────────────────────┘

Card size: 600 x 840 px (5:7 ratio)
```

**SVG Template Variables:**
```xml
<!-- templates/card.svg -->
<svg width="600" height="840" xmlns="http://www.w3.org/2000/svg">
  <!-- Border with gradient -->
  <defs>
    <linearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFD700"/>
      <stop offset="100%" style="stop-color:#8B4513"/>
    </linearGradient>
  </defs>
  
  <rect x="10" y="10" width="580" height="820" rx="20" 
        fill="none" stroke="url(#borderGradient)" stroke-width="8"/>
  
  <!-- Profile image placeholder -->
  <image x="100" y="60" width="400" height="400" 
         href="{{IMAGE_PATH}}" clip-path="url(#circleClip)"/>
  
  <!-- Text fields -->
  <text x="300" y="520" class="founder-name">{{FOUNDER_NAME}}</text>
  <text x="300" y="570" class="company">{{COMPANY}}</text>
  <text x="300" y="610" class="handle">{{X_HANDLE}}</text>
  
  <!-- Category badge -->
  <rect x="50" y="750" width="120" height="40" rx="10" fill="{{CATEGORY_COLOR}}"/>
  <text x="110" y="777" class="category">{{CATEGORY}}</text>
  
  <!-- Card ID -->
  <text x="550" y="777" class="card-id">#{{CARD_NUMBER}}</text>
</svg>
```

**Assembly Process:**
```typescript
async function assembleCard(definition: CardDefinition, imageBuffer: Buffer): Promise<Buffer> {
  // 1. Load SVG template
  let svg = await Bun.file('templates/card.svg').text()
  
  // 2. Embed image as base64
  const imageBase64 = imageBuffer.toString('base64')
  svg = svg.replace('{{IMAGE_PATH}}', `data:image/png;base64,${imageBase64}`)
  
  // 3. Replace text placeholders
  svg = svg.replace('{{FOUNDER_NAME}}', escapeXml(definition.founderName))
  svg = svg.replace('{{COMPANY}}', escapeXml(definition.company))
  svg = svg.replace('{{X_HANDLE}}', definition.xHandle || '')
  svg = svg.replace('{{CATEGORY}}', definition.category.toUpperCase())
  svg = svg.replace('{{CATEGORY_COLOR}}', getCategoryColor(definition.category))
  svg = svg.replace('{{CARD_NUMBER}}', definition.id.slice(0, 6))
  
  // 4. Convert SVG to PNG
  return sharp(Buffer.from(svg)).png().toBuffer()
}
```

**Output:**
```
output/cards/
├── elon-musk-tesla.png
├── elon-musk-spacex.png
├── metadata.json          # Card ID → founder mapping
└── ...
```

**Dependencies:** `sharp`, M6 (Template)

---

## M5: Export to Backend

**File:** `src/commands/export.ts`

**Purpose:** Copy cards and metadata to backend static folder.

**CLI:**
```bash
bun run export --input output/cards/ --backend ../backend/static/cards/
```

**Process:**
```typescript
async function exportCards(inputDir: string, backendDir: string): Promise<void> {
  // 1. Copy all card images
  const cards = await glob(`${inputDir}/*.png`)
  for (const card of cards) {
    await Bun.write(`${backendDir}/${basename(card)}`, Bun.file(card))
  }
  
  // 2. Generate cards manifest for backend
  const metadata = JSON.parse(await Bun.file(`${inputDir}/metadata.json`).text())
  const manifest = {
    totalCards: cards.length,
    cards: metadata,
    generatedAt: new Date().toISOString()
  }
  await Bun.write(`${backendDir}/manifest.json`, JSON.stringify(manifest, null, 2))
  
  // 3. Generate SQL insert statements (optional)
  const sql = generateInsertStatements(metadata)
  await Bun.write(`${backendDir}/seed.sql`, sql)
}
```

**Output Files:**
```
backend/static/cards/
├── *.png                  # Card images
├── manifest.json          # Card registry
└── seed.sql              # Database seed script
```

---

## M6: SVG Card Template

**File:** `src/templates/card.svg`

**Purpose:** Base SVG template for card design.

**Design Elements:**
1. **Border** - Gradient gold/bronze frame
2. **Image Area** - Circular or rounded square clip
3. **Name Block** - Founder name (large), company (medium), handle (small)
4. **Category Badge** - Color-coded by industry
5. **Card Number** - Unique identifier
6. **Background** - Subtle pattern or gradient

**Category Colors:**
```typescript
const categoryColors: Record<string, string> = {
  tech: '#4A90D9',       // Blue
  finance: '#2ECC71',    // Green
  retail: '#E74C3C',     // Red
  media: '#9B59B6',      // Purple
  transport: '#F39C12',  // Orange
  food: '#E67E22',       // Dark orange
  health: '#1ABC9C',     // Teal
  default: '#7F8C8D'     // Gray
}
```

---

## CLI Entry Point

**File:** `src/index.ts`

```typescript
import { Command } from 'commander'

const program = new Command()
  .name('card-assembler')
  .description('Generate Seedhunter founder trading cards')
  .version('1.0.0')

program
  .command('generate')
  .description('Generate founder list using AI')
  .option('-c, --count <number>', 'Number of founders', '200')
  .option('-o, --output <path>', 'Output file', 'data/founders.json')
  .option('--append', 'Append to existing list')
  .action(generateCommand)

program
  .command('fetch')
  .description('Fetch profile pictures')
  .option('-i, --input <path>', 'Founders JSON', 'data/founders.json')
  .option('-o, --output <path>', 'Output directory', 'data/raw_images')
  .option('--retry-failed', 'Retry previously failed fetches')
  .action(fetchCommand)

program
  .command('stylize')
  .description('Apply visual style to images')
  .option('-i, --input <path>', 'Input directory', 'data/raw_images')
  .option('-o, --output <path>', 'Output directory', 'data/styled_images')
  .option('-s, --style <style>', 'Style to apply', 'duotone')
  .option('--force', 'Reprocess all images')
  .action(stylizeCommand)

program
  .command('assemble')
  .description('Create final card images')
  .option('-i, --input <path>', 'Styled images dir', 'data/styled_images')
  .option('-o, --output <path>', 'Output directory', 'output/cards')
  .action(assembleCommand)

program
  .command('export')
  .description('Export cards to backend')
  .option('-i, --input <path>', 'Cards directory', 'output/cards')
  .option('-b, --backend <path>', 'Backend static path', '../backend/static/cards')
  .action(exportCommand)

program
  .command('all')
  .description('Run full pipeline')
  .option('-c, --count <number>', 'Number of founders', '200')
  .action(async (opts) => {
    await generateCommand(opts)
    await fetchCommand({})
    await stylizeCommand({})
    await assembleCommand({})
    await exportCommand({})
  })

program.parse()
```

---

## Implementation Order

```
M6 (Template) → M1 (Generate) → M2 (Fetch) → M3 (Stylize) → M4 (Assemble) → M5 (Export)
```

Each module is independent and can be run separately. Status files enable resumability.

---

## Environment Variables

```bash
# AI Generation
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# X API (optional)
X_BEARER_TOKEN=...

# Image search fallback (optional)
SERP_API_KEY=...
```

---

## Status Tracking

Each command maintains a status file:

```typescript
// data/fetch_status.json
{
  "completed": ["elon-musk-tesla", "jeff-bezos-amazon"],
  "failed": [{ "id": "some-founder", "error": "404", "attempts": 3 }],
  "lastRun": "2024-01-15T10:30:00Z"
}
```

This enables:
- Resuming after interruption
- Retrying failed items
- Tracking progress

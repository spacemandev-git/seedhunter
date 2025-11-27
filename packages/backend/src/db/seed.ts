import { prisma } from './index'

async function seed() {
  console.log('🌱 Seeding database...')
  
  // Create default admin
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  
  // Hash password (using Bun's built-in)
  const passwordHash = await Bun.password.hash(adminPassword)
  
  const admin = await prisma.admin.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
    },
  })
  
  console.log(`  ✓ Admin created: ${admin.username}`)
  
  // Load cards from manifest if it exists
  const cardsManifestPath = './static/cards/manifest.json'
  const manifestFile = Bun.file(cardsManifestPath)
  
  if (await manifestFile.exists()) {
    const manifest = await manifestFile.json()
    
    console.log(`  Loading ${manifest.cards.length} cards from manifest...`)
    
    for (const card of manifest.cards) {
      await prisma.card.upsert({
        where: { id: card.id },
        update: {
          founderName: card.founderName,
          company: card.company,
          role: card.role,
          xHandle: card.xHandle,
          category: card.category,
          imagePath: card.imagePath,
        },
        create: {
          id: card.id,
          founderName: card.founderName,
          company: card.company,
          role: card.role,
          xHandle: card.xHandle,
          category: card.category,
          imagePath: card.imagePath,
        },
      })
    }
    
    console.log(`  ✓ ${manifest.cards.length} cards loaded`)
  } else {
    console.log('  ⚠ No cards manifest found, skipping card import')
    console.log('    Run "bun run cards:all" in card-assembler to generate cards')
  }
  
  console.log('✅ Seeding complete')
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

/**
 * Migration script to fix players with null artStyle
 * Assigns a random art style to all players who don't have one yet
 */

import { prisma } from '../db'
import { getRandomArtStyle } from '../services/founders'

async function fixNullArtStyle() {
  console.log('Starting artStyle migration...')
  
  // Find all players with null artStyle
  const playersWithNullArtStyle = await prisma.player.findMany({
    where: {
      artStyle: null
    },
    select: {
      id: true,
      xHandle: true,
      gridIndex: true
    }
  })
  
  console.log(`Found ${playersWithNullArtStyle.length} players with null artStyle`)
  
  if (playersWithNullArtStyle.length === 0) {
    console.log('No players to update. Migration complete!')
    return
  }
  
  // Update each player with a random art style
  let updated = 0
  for (const player of playersWithNullArtStyle) {
    const artStyle = getRandomArtStyle()
    
    await prisma.player.update({
      where: { id: player.id },
      data: { artStyle }
    })
    
    updated++
    console.log(`Updated ${player.xHandle} (${updated}/${playersWithNullArtStyle.length}) with artStyle: ${artStyle}`)
  }
  
  console.log(`\nMigration complete! Updated ${updated} players.`)
}

// Run the migration
fixNullArtStyle()
  .then(() => {
    console.log('Migration finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })

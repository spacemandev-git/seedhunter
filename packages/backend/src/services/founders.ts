import type { Founder } from '@seedhunter/shared'
import { prisma } from '../db'
import foundersData from '../../data/founders.json'

// Total number of founders in our dataset (indexed 0-118)
export const TOTAL_FOUNDERS = Object.keys(foundersData).length

// Type the imported JSON data
const founders = foundersData as Record<string, {
  id: number
  name: string
  company: string
  description: string
  founded: number
  valuation: string
}>

/**
 * Get a random founder index for a new player
 */
export function getRandomFounderIndex(): number {
  return Math.floor(Math.random() * TOTAL_FOUNDERS)
}

/**
 * Get a random art style for a founder card
 */
export function getRandomArtStyle(): string {
  const styles = ['lowpoly', 'popart']
  return styles[Math.floor(Math.random() * styles.length)]
}

/**
 * Get the art style for a card (gridIndex), creating one if it doesn't exist
 * Art style is permanent and persists through trades
 */
export async function getOrCreateCardArtStyle(gridIndex: number): Promise<string> {
  // Try to find existing art style for this card
  const existing = await prisma.cardArtStyle.findUnique({
    where: { gridIndex }
  })
  
  if (existing) {
    return existing.artStyle
  }
  
  // Create a new art style for this card
  const artStyle = getRandomArtStyle()
  await prisma.cardArtStyle.create({
    data: { gridIndex, artStyle }
  })
  
  return artStyle
}

/**
 * Get the art style for a card if it exists (doesn't create)
 */
export async function getCardArtStyle(gridIndex: number): Promise<string | null> {
  const record = await prisma.cardArtStyle.findUnique({
    where: { gridIndex }
  })
  
  return record?.artStyle ?? null
}

/**
 * Get a founder by their ID/index with optional art style
 */
export function getFounderById(id: number, artStyle?: string | null): Founder | null {
  const founder = founders[String(id)]
  if (!founder) return null
  
  return {
    id: founder.id,
    name: founder.name,
    company: founder.company,
    description: founder.description,
    founded: founder.founded,
    valuation: founder.valuation,
    artStyle: artStyle || undefined
  }
}

/**
 * Get all founders indexed by ID
 */
export function getAllFounders(): Record<number, Founder> {
  const result: Record<number, Founder> = {}
  
  for (const [key, founder] of Object.entries(founders)) {
    result[parseInt(key)] = {
      id: founder.id,
      name: founder.name,
      company: founder.company,
      description: founder.description,
      founded: founder.founded,
      valuation: founder.valuation
    }
  }
  
  return result
}

import type { Founder } from '@seedhunter/shared'
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
 * Get a founder by their ID/index
 */
export function getFounderById(id: number): Founder | null {
  const founder = founders[String(id)]
  if (!founder) return null
  
  return {
    id: founder.id,
    name: founder.name,
    company: founder.company,
    description: founder.description,
    founded: founder.founded,
    valuation: founder.valuation
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

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

// Art styles available
export const ART_STYLES = ['lowpoly', 'popart'] as const
export type ArtStyle = typeof ART_STYLES[number]

// Total unique card variants = founders × art styles
export const TOTAL_CARD_VARIANTS = TOTAL_FOUNDERS * ART_STYLES.length

/**
 * Get a random card variant (gridIndex + artStyle) for a new player
 * Each founder has 2 copies - one per art style
 */
export function getRandomCardVariant(): { gridIndex: number; artStyle: ArtStyle } {
  // Pick a random variant from all possible (founders × art styles)
  const variantIndex = Math.floor(Math.random() * TOTAL_CARD_VARIANTS)
  
  // Convert to gridIndex and artStyle
  const gridIndex = variantIndex % TOTAL_FOUNDERS
  const artStyleIndex = Math.floor(variantIndex / TOTAL_FOUNDERS)
  
  return {
    gridIndex,
    artStyle: ART_STYLES[artStyleIndex]
  }
}

/**
 * Get a random founder index for a new player
 * @deprecated Use getRandomCardVariant() instead
 */
export function getRandomFounderIndex(): number {
  return Math.floor(Math.random() * TOTAL_FOUNDERS)
}

/**
 * Get a random art style for a founder card
 */
export function getRandomArtStyle(): ArtStyle {
  return ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)]
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

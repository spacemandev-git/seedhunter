// ============================================
// Basic Profanity Filter
// ============================================

// Common profanity words (shortened list for demonstration)
// In production, use a comprehensive word list
const PROFANITY_LIST = new Set([
  // Common English profanity
  'fuck', 'fucking', 'fucked', 'fucker', 'fuckers',
  'shit', 'shitting', 'shitty', 'bullshit',
  'ass', 'asshole', 'assholes',
  'bitch', 'bitches', 'bitchy',
  'damn', 'damned', 'dammit',
  'crap', 'crappy',
  'dick', 'dicks', 'dickhead',
  'cock', 'cocks',
  'pussy', 'pussies',
  'cunt', 'cunts',
  'bastard', 'bastards',
  'whore', 'whores',
  'slut', 'sluts',
  'piss', 'pissed', 'pissing',
  'nigger', 'nigga', 'niggas',
  'faggot', 'fag', 'fags',
  'retard', 'retarded', 'retards',
  // Common attempts to evade
  'f*ck', 'f**k', 'fu*k', 'fuk', 'phuck',
  'sh*t', 's**t', 'sh1t',
  'b*tch', 'b1tch',
  'd*ck', 'd1ck',
  'a$$', '@ss', 'a**',
])

// Regex pattern to detect leet speak variations
const LEET_REPLACEMENTS: [RegExp, string][] = [
  [/0/g, 'o'],
  [/1/g, 'i'],
  [/3/g, 'e'],
  [/4/g, 'a'],
  [/5/g, 's'],
  [/7/g, 't'],
  [/8/g, 'b'],
  [/@/g, 'a'],
  [/\$/g, 's'],
  [/\*/g, ''],
]

/**
 * Normalize text for profanity checking
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase()
  
  // Apply leet speak replacements
  for (const [pattern, replacement] of LEET_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }
  
  // Remove repeated characters (e.g., "fuuuck" -> "fuck")
  normalized = normalized.replace(/(.)\1{2,}/g, '$1$1')
  
  return normalized
}

/**
 * Check if text contains profanity
 */
export function containsProfanity(text: string): boolean {
  const normalized = normalizeText(text)
  const words = normalized.split(/\s+/)
  
  for (const word of words) {
    // Check exact match
    if (PROFANITY_LIST.has(word)) {
      return true
    }
    
    // Check if word contains profanity as substring (with word boundary)
    for (const profanity of PROFANITY_LIST) {
      if (word.includes(profanity) && profanity.length >= 4) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Filter profanity by replacing with asterisks
 */
export function filterProfanity(text: string): string {
  const words = text.split(/(\s+)/)
  
  return words.map(word => {
    // Preserve whitespace
    if (/^\s+$/.test(word)) {
      return word
    }
    
    const normalized = normalizeText(word)
    
    // Check if word is profane
    for (const profanity of PROFANITY_LIST) {
      if (normalized === profanity || 
          (normalized.includes(profanity) && profanity.length >= 4)) {
        // Replace with asterisks, preserving first and last char if long enough
        if (word.length > 3) {
          return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1]
        }
        return '*'.repeat(word.length)
      }
    }
    
    return word
  }).join('')
}

/**
 * Filter for display - admins see original, others see filtered
 */
export function filterForDisplay(text: string, viewerIsAdmin: boolean): string {
  if (viewerIsAdmin) {
    return text
  }
  return filterProfanity(text)
}

/**
 * Load custom word list (for extending the built-in list)
 */
export function addProfanityWords(words: string[]): void {
  for (const word of words) {
    PROFANITY_LIST.add(word.toLowerCase())
  }
}

/**
 * Check if a word is in the profanity list
 */
export function isProfanityWord(word: string): boolean {
  return PROFANITY_LIST.has(word.toLowerCase())
}

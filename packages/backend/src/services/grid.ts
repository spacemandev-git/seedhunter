import { GraphQLClient, gql } from 'graphql-request'
import type { GridProject } from '@seedhunter/shared'

const GRID_ENDPOINT = 'https://beta.node.thegrid.id/graphql'

const client = new GraphQLClient(GRID_ENDPOINT)

// Cache for total project count (refreshed every hour)
let cachedTotalProjects: number | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// Cache for individual projects (to avoid repeated fetches)
const projectCache = new Map<number, { project: GridProject; timestamp: number }>()
const PROJECT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get total number of projects in The Grid
 */
export async function getTotalProjects(): Promise<number> {
  const now = Date.now()
  
  if (cachedTotalProjects !== null && now - cacheTimestamp < CACHE_TTL) {
    return cachedTotalProjects
  }
  
  const query = gql`
    query {
      profileInfos(limit: 10000) {
        name
      }
    }
  `
  
  try {
    const data = await client.request<{ profileInfos: { name: string }[] }>(query)
    cachedTotalProjects = data.profileInfos.length
    cacheTimestamp = now
    return cachedTotalProjects
  } catch (error) {
    console.error('Failed to fetch total projects from The Grid:', error)
    // Return cached value if available, otherwise default
    return cachedTotalProjects ?? 2555
  }
}

/**
 * Get a random project index for a new user
 */
export async function getRandomProjectIndex(): Promise<number> {
  const total = await getTotalProjects()
  return Math.floor(Math.random() * total)
}

/**
 * Fetch a project by its index in The Grid
 */
export async function getProjectByIndex(index: number): Promise<GridProject | null> {
  const now = Date.now()
  
  // Check cache first
  const cached = projectCache.get(index)
  if (cached && now - cached.timestamp < PROJECT_CACHE_TTL) {
    return cached.project
  }
  
  const query = gql`
    query GetProject($offset: Int!) {
      profileInfos(limit: 1, offset: $offset) {
        name
        logo
        tagLine
        descriptionShort
        profileSector {
          name
        }
        profileType {
          name
        }
        urls {
          url
          urlType {
            name
          }
        }
        root {
          socials {
            socialType {
              name
            }
            urls {
              url
            }
          }
        }
      }
    }
  `
  
  try {
    const data = await client.request<{
      profileInfos: Array<{
        name: string
        logo: string | null
        tagLine: string | null
        descriptionShort: string | null
        profileSector: { name: string } | null
        profileType: { name: string } | null
        urls: Array<{ url: string; urlType: { name: string } | null }>
        root: {
          socials: Array<{
            socialType: { name: string } | null
            urls: Array<{ url: string }>
          }>
        } | null
      }>
    }>(query, { offset: index })
    
    if (!data.profileInfos || data.profileInfos.length === 0) {
      return null
    }
    
    const profile = data.profileInfos[0]
    
    // Extract Twitter/X handle from socials
    let xHandle: string | null = null
    if (profile.root?.socials) {
      const twitterSocial = profile.root.socials.find(
        s => s.socialType?.name?.toLowerCase().includes('twitter') || 
             s.socialType?.name?.toLowerCase().includes('x')
      )
      if (twitterSocial?.urls?.[0]?.url) {
        // Extract handle from URL like https://twitter.com/SomeHandle
        const match = twitterSocial.urls[0].url.match(/(?:twitter\.com|x\.com)\/([^\/\?]+)/i)
        if (match) {
          xHandle = match[1]
        }
      }
    }
    
    // Get main website URL
    const mainUrl = profile.urls?.find(u => u.urlType?.name === 'Main')?.url || 
                    profile.urls?.[0]?.url || null
    
    const project: GridProject = {
      gridIndex: index,
      name: profile.name,
      logo: profile.logo,
      tagLine: profile.tagLine,
      description: profile.descriptionShort,
      sector: profile.profileSector?.name || null,
      type: profile.profileType?.name || null,
      websiteUrl: mainUrl,
      xHandle
    }
    
    // Cache the project
    projectCache.set(index, { project, timestamp: now })
    
    return project
  } catch (error) {
    console.error(`Failed to fetch project at index ${index} from The Grid:`, error)
    return null
  }
}

/**
 * Fetch multiple projects by their indices (batch)
 */
export async function getProjectsByIndices(indices: number[]): Promise<Map<number, GridProject>> {
  const results = new Map<number, GridProject>()
  
  // Fetch in parallel
  const promises = indices.map(async (index) => {
    const project = await getProjectByIndex(index)
    if (project) {
      results.set(index, project)
    }
  })
  
  await Promise.all(promises)
  return results
}

/**
 * Clear project cache (useful for admin operations)
 */
export function clearProjectCache(): void {
  projectCache.clear()
  cachedTotalProjects = null
  cacheTimestamp = 0
}

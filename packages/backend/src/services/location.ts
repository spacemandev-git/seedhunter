import { prisma } from '../db'
import type { AdminLocation } from '@seedhunter/shared'

// ============================================
// Admin Location Management
// ============================================

/**
 * Update an admin's location
 */
export async function updateAdminLocation(
  adminId: string,
  lat: number,
  lng: number
): Promise<void> {
  await prisma.admin.update({
    where: { id: adminId },
    data: {
      locationLat: lat,
      locationLng: lng,
      locationUpdatedAt: new Date()
    }
  })
}

/**
 * Set admin location visibility
 */
export async function setAdminVisibility(
  adminId: string,
  visible: boolean
): Promise<void> {
  await prisma.admin.update({
    where: { id: adminId },
    data: { locationVisible: visible }
  })
}

/**
 * Get all admin locations (for public map)
 */
export async function getAdminLocations(): Promise<AdminLocation[]> {
  const admins = await prisma.admin.findMany({
    where: {
      locationLat: { not: null },
      locationLng: { not: null }
    },
    select: {
      username: true,
      locationLat: true,
      locationLng: true,
      locationVisible: true,
      locationUpdatedAt: true
    }
  })
  
  return admins.map(admin => ({
    username: admin.username,
    location: admin.locationVisible
      ? { lat: admin.locationLat!, lng: admin.locationLng! }
      : '<encrypted>',
    updatedAt: admin.locationUpdatedAt?.getTime() ?? null
  }))
}

/**
 * Get a specific admin's location
 */
export async function getAdminLocation(adminId: string): Promise<AdminLocation | null> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      username: true,
      locationLat: true,
      locationLng: true,
      locationVisible: true,
      locationUpdatedAt: true
    }
  })
  
  if (!admin || admin.locationLat === null || admin.locationLng === null) {
    return null
  }
  
  return {
    username: admin.username,
    location: admin.locationVisible
      ? { lat: admin.locationLat, lng: admin.locationLng }
      : '<encrypted>',
    updatedAt: admin.locationUpdatedAt?.getTime() ?? null
  }
}

/**
 * Clear admin location (stop broadcasting)
 */
export async function clearAdminLocation(adminId: string): Promise<void> {
  await prisma.admin.update({
    where: { id: adminId },
    data: {
      locationLat: null,
      locationLng: null,
      locationUpdatedAt: null
    }
  })
}

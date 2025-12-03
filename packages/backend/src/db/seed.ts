import { prisma } from './index'

interface AdminAccount {
  username: string
  password: string
}

function parseAdminAccounts(): AdminAccount[] {
  const accounts: AdminAccount[] = []
  
  // Try JSON format first: ADMIN_ACCOUNTS=[{"username":"admin","password":"pass"},...]
  const jsonAccounts = process.env.ADMIN_ACCOUNTS
  if (jsonAccounts) {
    try {
      const parsed = JSON.parse(jsonAccounts)
      if (Array.isArray(parsed)) {
        accounts.push(...parsed)
      }
    } catch {
      // Try comma-separated format: ADMIN_ACCOUNTS=admin1:pass1,admin2:pass2
      const pairs = jsonAccounts.split(',')
      for (const pair of pairs) {
        const [username, password] = pair.trim().split(':')
        if (username && password) {
          accounts.push({ username: username.trim(), password: password.trim() })
        }
      }
    }
  }
  
  // Fallback to single admin env vars
  if (accounts.length === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin'
    const password = process.env.ADMIN_PASSWORD || 'admin123'
    accounts.push({ username, password })
  }
  
  return accounts
}

async function seed() {
  console.log('🌱 Seeding database...')
  
  // Create admin accounts
  const adminAccounts = parseAdminAccounts()
  console.log(`  Creating ${adminAccounts.length} admin account(s)...`)
  
  for (const account of adminAccounts) {
    // Hash password (using Bun's built-in with bcrypt to match auth service)
    const passwordHash = await Bun.password.hash(account.password, {
      algorithm: 'bcrypt',
      cost: 10
    })
    
    const admin = await prisma.admin.upsert({
      where: { username: account.username },
      update: { passwordHash },  // Update password if admin exists
      create: {
        username: account.username,
        passwordHash,
      },
    })
    
    console.log(`  ✓ Admin created: ${admin.username}`)
  }
  
  // Note: Cards are no longer stored locally. Projects are fetched from The Grid API.
  console.log('  ℹ Projects are fetched dynamically from The Grid API')
  
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

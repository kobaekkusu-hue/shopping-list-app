import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
    const isProduction = process.env.NODE_ENV === 'production'
    const connectionString = process.env.DATABASE_URL

    console.log(`[Prisma] Initializing client. env=${process.env.NODE_ENV}, has_url=${!!connectionString}`)

    if (!connectionString) {
        if (isProduction) {
            // ビルド時などは警告に留める（エラーメッセージを詳細にする）
            console.error('❌ FATAL: DATABASE_URL is not set in production environment.')
            return new PrismaClient()
        }
        throw new Error('DATABASE_URL is not set.')
    }

    const pool = new pg.Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter })
}

// 開発環境において、Next.jsのホットリロード時にPrismaClientのインスタンスが増殖して
// コネクションプールを枯渇させるのを防ぐためのグローバル変数の型定義
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

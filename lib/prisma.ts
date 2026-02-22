import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
        // Vercelのログで目立つようにエラーを出力
        const errorMsg = '❌ ERROR: DATABASE_URL is not set. Check your Vercel Environment Variables.'
        console.error(errorMsg)

        if (process.env.NODE_ENV === 'production') {
            // 本番環境では、接続できないクライアントで続行させず例外を投げる
            throw new Error(errorMsg)
        }
    }

    const pool = new pg.Pool({
        connectionString,
        // localhost への自動フォールバックを避けるための設定
        host: connectionString ? undefined : 'missing-database-url-host'
    })
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

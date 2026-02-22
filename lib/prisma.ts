import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
    const connectionString = process.env.DATABASE_URL

    if (!connectionString) {
        // Vercelのデプロイ時のビルドプロセス（DATABASE_URLが環境変数にない状態）で
        // ビルドを失敗させないよう、警告のみを出力して例外は投げないようにする。
        console.warn('⚠️ WARNING: DATABASE_URL is not set. This is expected during Vercel build if not provided, but must be set for runtime.')
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

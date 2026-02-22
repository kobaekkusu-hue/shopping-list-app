import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const prismaClientSingleton = () => {
    const connectionString = process.env.DATABASE_URL

    // ビルド中（Vercelのビルドサーバーなど）は DATABASE_URL がなくてもエラーにせず、
    // 実際にクエリが実行されるタイミングでエラーになるように警告に留める
    if (!connectionString && process.env.NODE_ENV === 'production') {
        console.warn('⚠️ DATABASE_URL is not set. Database operations will fail at runtime.')
        // ダミーのクライアントを返すが、未接続状態で初期化される
        return new PrismaClient()
    }

    const pool = new pg.Pool({ connectionString: connectionString || 'postgresql://localhost:5432' })
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
導入。

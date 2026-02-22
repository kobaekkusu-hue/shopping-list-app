export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 材料アイテムのチェック状態（購入済みフラグ）の更新
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { itemId, isChecked } = body;

        if (!itemId || typeof isChecked !== 'boolean') {
            return NextResponse.json({ error: 'Missing or invalid itemId / isChecked' }, { status: 400 });
        }

        const updatedItem = await prisma.ingredientItem.update({
            where: { id: itemId },
            data: { isChecked }
        });

        return NextResponse.json({ success: true, item: updatedItem });
    } catch (error) {
        console.error('Error updating item check status:', error);
        return NextResponse.json({ error: 'Failed to update check status' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { scrapeRecipe } from '@/lib/scraper';
import { aggregateIngredients } from '@/lib/gemini';
import { DayMenu } from '@/app/types';

// POSTリクエスト: URLのリストを受け取り、一括でスクレイピング＆集約を行う
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { urls, ingredientsData } = body;

        // 再集計モード: クライアントからフィルタリング済みのテキスト配列が送られてくる場合
        if (ingredientsData && Array.isArray(ingredientsData)) {
            const combinedRawText = ingredientsData.join('\n\n');
            if (!combinedRawText.trim()) {
                return NextResponse.json({ error: 'No ingredients found to aggregate', ingredients: [] });
            }

            // AIで集約のみ行う
            const ingredients = await aggregateIngredients(combinedRawText);
            return NextResponse.json({ ingredients });
        }

        // 通常モード: URLからスクレイピング
        if (!urls || !Array.isArray(urls)) {
            return NextResponse.json({ error: 'URLs array is required' }, { status: 400 });
        }

        // 1. 全URLをスクレイピング
        const rawIngredientsList: string[] = [];
        const menus: DayMenu[] = [];

        for (const url of urls) {
            const data = await scrapeRecipe(url);
            if (data) {
                // 日付文字列から曜日を計算
                let dayOfWeek = '';
                if (data.dateStr && data.dateStr.length === 8) {
                    const year = parseInt(data.dateStr.substring(0, 4));
                    const month = parseInt(data.dateStr.substring(4, 6)) - 1;
                    const day = parseInt(data.dateStr.substring(6, 8));
                    const dateObj = new Date(year, month, day);
                    const days = ['日', '月', '火', '水', '木', '金', '土'];
                    dayOfWeek = days[dateObj.getDay()];
                }

                // AIに渡すテキストにヘッダーを付与
                const formattedRawText = data.rawIngredients
                    ? `【${dayOfWeek} 曜日: ${data.title}】\n${data.rawIngredients} `
                    : '';

                if (formattedRawText) {
                    rawIngredientsList.push(formattedRawText);
                }

                // メニュー情報を保存
                menus.push({
                    date: data.dateStr,
                    dayOfWeek,
                    url: data.url,
                    status: 'success',
                    dishes: data.dishes,
                    rawIngredients: formattedRawText // 生データも保存してフロントに返す
                });

            } else {
                // 取得失敗時の情報を保存
                menus.push({
                    date: '',
                    dayOfWeek: '',
                    url: url,
                    status: 'failed',
                    dishes: []
                });
            }
            // Rate Limit回避のためのウェイト
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const combinedRawText = rawIngredientsList.join('\n\n');

        if (!combinedRawText.trim()) {
            return NextResponse.json({ error: 'No ingredients found to aggregate', recipes: menus }, { status: 400 });
        }

        // 2. AIで集約
        const ingredients = await aggregateIngredients(combinedRawText);

        return NextResponse.json({ ingredients, recipes: menus });

    } catch (error) {
        console.error('Error in aggregate API:', error);
        return NextResponse.json({ error: 'Failed to generate shopping list' }, { status: 500 });
    }
}

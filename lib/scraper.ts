import * as cheerio from 'cheerio';
import { ScrapedData, Dish } from '@/app/types';

export async function scrapeRecipe(url: string): Promise<ScrapedData | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch ${url}: ${response.statusText}`);
            return null;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // タイトルの取得
        const title = $('h1.main_tit').text().trim();

        // 料理リストの抽出 (Tailwind化対応: h2タグ「～の作り方」から抽出)
        const dishes: Dish[] = [];

        // ページ内の全h2を取得し、料理名を探す
        $('h2').each((i, el) => {
            const text = $(el).text().trim();
            if (text.endsWith('の作り方')) {
                const dishTitle = text.replace('の作り方', '');

                // 親要素を遡ってコンテナを探し、そこから画像とリンクを探す
                // js-tab-content や section-content がコンテナの可能性が高い
                const container = $(el).closest('.js-tab-content, .section-content');

                // 画像を探す (アイコンなどを除外)
                let img = container.find('img').filter((j, imgEl) => {
                    const src = $(imgEl).attr('src') || $(imgEl).attr('data-src');
                    return !!src && !src.includes('icon') && !src.includes('logo');
                }).first().attr('src');

                // data-srcがある場合はそちらを優先 (Lazy load対応)
                const lazyImg = container.find('img').filter((j, imgEl) => !!$(imgEl).attr('data-src')).first().attr('data-src');
                if (lazyImg) img = lazyImg;

                // リンクを探す (/recipe/dish/ を含むもの)
                const link = container.find('a[href*="/recipe/dish/"]').first().attr('href');

                // 重複チェック (同じ料理が複数取れる場合があるため)
                const exists = dishes.some(d => d.title === dishTitle);
                if (!exists) {
                    dishes.push({
                        type: dishes.length === 0 ? 'main' : 'side', // 最初の1つを主菜、以降を副菜とする
                        title: dishTitle,
                        url: link ? `https://www.lettuceclub.net${link}` : '',
                        imageUrl: img || '' // 画像が取れなくてもエラーにしない
                    });
                }
            }
        });

        // もし上記ロジックで取れなかった場合のフォールバック (古い構造など)
        if (dishes.length === 0) {
            $('.item_main, .item_sub').each((i, el) => {
                const dishTitle = $(el).find('.w_tit').text().trim();
                const dishUrl = $(el).find('a').attr('href');
                const img = $(el).find('img').attr('src');
                if (dishTitle) {
                    dishes.push({
                        type: $(el).hasClass('item_main') ? 'main' : 'side',
                        title: dishTitle,
                        url: dishUrl ? `https://www.lettuceclub.net${dishUrl}` : '',
                        imageUrl: img
                    });
                }
            });
        }

        // URLから日付文字列を抽出 (k20260216 -> 20260216)
        const dateMatch = url.match(/k(\d{8})/);
        const dateStr = dateMatch ? dateMatch[1] : '';

        // 材料の取得 (既存ロジック: h2の次)
        const ingredientsHeader = $('h2').filter((i, el) => {
            return $(el).text().includes('献立の材料');
        }).first();

        let rawIngredients = '';

        if (ingredientsHeader.length > 0) {
            // レタスクラブの構造: 
            // <div class="..."><h2>献立の材料</h2></div>
            // <div class="...">...（材料リスト）</div>
            // という構造になっているため、h2の親要素の次の兄弟要素を取得する
            const parent = ingredientsHeader.parent();
            const parentNext = parent.next();

            if (parentNext.length > 0) {
                rawIngredients = parentNext.text().trim();
            }
        }

        return {
            url,
            dateStr,
            title,
            rawIngredients,
            dishes
        };

    } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        return null;
    }
}

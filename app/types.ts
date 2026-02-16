// 料理（主菜・副菜）の1品ごとの情報
export interface Dish {
    type: 'main' | 'side' | 'soup' | 'other';
    title: string;
    url: string; // 個別レシピのURLがあれば
    imageUrl?: string;
}

export interface DayMenu {
    date: string; // YYYYMMDD
    dayOfWeek: string;
    url: string;
    status: 'success' | 'failed';
    dishes: Dish[]; // 主菜・副菜のリスト
}

export interface Ingredient {
    name: string;
    amount: string;
    category: string;
    usedDays: string[];
}

export interface ScrapedData {
    url: string;
    dateStr: string;
    title: string; // 献立全体のタイトル
    rawIngredients: string;
    dishes: Dish[]; // スクレイピングした料理リスト
}

export interface ShoppingList {
    recipes: DayMenu[]; // 名称変更: recipes -> menus
    ingredients: Ingredient[];
}

// 固定カテゴリの定義
export const SHOPPING_CATEGORIES = [
    '野菜・きのこ',
    '肉・ハム・ベーコン',
    '魚・海鮮',
    '卵・豆腐・納豆',
    '乳製品（牛乳・ヨーグルト・チーズ）',
    '調味料・油',
    '米・パン・麺類・シリアル',
    '冷凍食品',
    '缶詰・瓶詰め・乾物',
    '飲料・お菓子'
] as const;

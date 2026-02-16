import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ingredient, SHOPPING_CATEGORIES } from '@/app/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function aggregateIngredients(rawText: string): Promise<Ingredient[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // モデル一覧から確認された最軽量モデル: gemini-flash-lite-latest
  // 理由: 503(高負荷)回避のため、最も軽量なLite版を使用
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite-latest' });

  const categoriesList = SHOPPING_CATEGORIES.join('、');

  const prompt = `
  以下のテキストは、複数のレシピの材料リストを結合したものです。
  【】で囲まれた部分は、そのレシピの日付（曜日）と料理名を示しています。

  これを解析し、買い物リストとして使えるように、同じ食材の分量を合算してまとめてください。
  また、その食材が「何曜日の献立に使われているか」もリスト化してください。
  
  出力は以下のJSON形式のみでお願いします。Markdownのコードブロックは不要です。
  
  [
    {
      "name": "食材名（例: 玉ねぎ）",
      "amount": "合算した分量（例: 2個）",
      "category": "カテゴリ名",
      "usedDays": ["月", "水"] 
    }
  ]
  
  ルール:
  1. 表記ゆれは統一してください（例: "鶏もも肉"と"とり肉" -> "鶏もも肉"）。
  
  2. 分量は可能な限り計算して合算してください（例: "1/2個" + "1.5個" -> "2個"）。
     - 分量が明記されていない飲料（牛乳など）やパック商品は、「1本」「1パック」などの適切な単位でカウントしてください（デフォルト値として「1本」を使用して構いません）。

  3. **重要: 調味料も全て集計してください。** マヨネーズ、片栗粉、サラダ油、塩、こしょう、醤油など、家庭にある基本的な調味料も含めてリストアップしてください。

  4. **「合わせ調味料」は集計しないでください。** 代わりに、その中身（構成する調味料）を集計してください。
     - 例: レシピに「合わせ調味料（酒大さじ1、醤油大さじ1）」とある場合 -> リストには「酒」「醤油」をそれぞれ追加し、「合わせ調味料」という項目は作らないでください。

  5. カテゴリは必ず以下のリストから最も適切なものを選んでください（カテゴリ名は正確に一致させてください）。
     リスト: [${categoriesList}]

  6. usedDaysには、その食材が登場するセクションの曜日（月、火、水、木、金、土、日）を重複なくリストアップしてください。
  
  入力テキスト:
  ${rawText}
  `;

  // リトライロジック (最大3回, 指数バックオフ + 初期ウェイト増加)
  let retries = 3;
  let delay = 5000; // 初回5秒待機から開始

  while (retries > 0) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // JSONのパース（Markdownブロック除去）
      const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const ingredients: Ingredient[] = JSON.parse(jsonString);
        return ingredients;
      } catch (e) {
        console.error("JSON parse error:", e);
        console.error("Raw text:", text);
        // JSONパースエラー時はフォールバックへ
        break;
      }

    } catch (error: any) {
      console.error(`Error calling Gemini API (retries left: ${retries - 1}):`, error.message);

      if (error.status === 429 || error.message?.includes('429')) {
        // Rate Limitなら長く待って再試行
        console.log(`Rate limit exceeded. Waiting ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // 待機時間を倍に (5s -> 10s -> 20s)
        retries--;
        continue;
      }

      // 503 Service Unavailable もリトライ対象にする
      if (error.status === 503 || error.message?.includes('503')) {
        console.log(`Service unavailable. Waiting ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        retries--;
        continue;
      }

      // その他の致命的なエラーは諦める
      break;
    }
  }

  // リトライ失敗後のフォールバック
  console.warn('All retries failed or fatal error. Falling back to raw text parsing.');

  // 生テキストをそのまま返すのではなく、少し整形して返す
  // 材料リストっぽい行だけ抽出する簡易ロジック
  const fallbackList: Ingredient[] = rawText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('【')) // ヘッダー行を除外
    .map((line, index) => ({
      name: line.length > 20 ? line.substring(0, 20) + '...' : line, // 長すぎる場合はカット
      amount: '',
      category: 'その他（AI生成失敗）',
      usedDays: []
    }));

  return fallbackList;
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ingredient, SHOPPING_CATEGORIES } from '@/app/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function aggregateIngredients(rawText: string): Promise<Ingredient[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  // 試行するモデルの優先順位
  // 1. gemini-2.5-flash: ユーザー指定
  const MODELS = ['gemini-2.5-flash'];

  const categoriesList = SHOPPING_CATEGORIES.join('、');

  const prompt = `
  以下のテキストは、複数のレシピの材料リストを結合したものです。
  【】で囲まれた部分は、そのレシピの日付（曜日）と料理名を示しています。

  これを解析し、買い物リストとして使えるように、同じ食材の分量を合算してまとめてください。
  また、その食材が「何曜日の献立に使われているか」もリスト化してください。
  
  まず、思考プロセス（Step-by-stepの計算過程やカテゴリ分類の根拠）を出力し、
  その後に以下のJSON形式で結果を出力してください。
  
  出力形式:
  思考プロセス:
  (ここに計算過程などを記述)
  
  \`\`\`json
  [
    {
      "name": "食材名（例: 玉ねぎ）",
      "amount": "合算した分量（例: 2個）",
      "category": "カテゴリ名",
      "usedDays": ["月", "水"] 
    }
  ]
  \`\`\`
  
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

  // モデルごとのループ
  for (const modelName of MODELS) {
    try {
      console.log(`Trying model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      // リトライループ (最大3回リトライ)
      let retries = 3;
      while (retries >= 0) {
        try {
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          // JSONパース
          // CoTがあるため、```json ... ``` を探す
          const jsonMatch = text.match(/```json([\s\S]*?)```/);

          if (jsonMatch && jsonMatch[1]) {
            const jsonString = jsonMatch[1].trim();
            const ingredients: Ingredient[] = JSON.parse(jsonString);
            return ingredients;
          }

          // JSONブロックが見つからない場合
          try {
            const ingredients: Ingredient[] = JSON.parse(text.trim());
            return ingredients;
          } catch (e) {
            throw new Error('Valid JSON block not found');
          }

        } catch (genError: any) {
          console.error(`Error with ${modelName}:`, genError.message);

          const isRateLimit = genError.status === 429 || genError.message?.includes('429');
          const isServerErr = genError.status === 503 || genError.message?.includes('503');

          // レート制限やサーバーエラーなら待機してリトライ
          if ((isRateLimit || isServerErr) && retries > 0) {
            // 待機時間を段階的に増やす (10s -> 20s -> 40s)
            const waitTime = (4 - retries) * 10000;
            console.log(`Retrying ${modelName} in ${waitTime / 1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
            retries--;
            continue;
          }

          // リトライなし、または致命的エラーならループを抜ける
          throw genError;
        }
      }

    } catch (error: any) {
      console.warn(`Model ${modelName} failed. Trying next model...`);
      // 次のモデルへループ継続
      continue;
    }
  }

  // 全モデル失敗時のフォールバック
  console.warn('All models failed or fatal error. Falling back to raw text parsing.');

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

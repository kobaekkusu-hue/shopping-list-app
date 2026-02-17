'use client';

import { useState } from 'react';
import { ShoppingList, Ingredient, SHOPPING_CATEGORIES } from './types'; // Ingredientを戻す
import { format, addDays, startOfWeek, addWeeks } from 'date-fns';
import { ShoppingBag, Calendar, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'; // アイコン追加

export default function Home() {
  // 週の開始日（月曜日基準）を管理
  const [selectedDate, setSelectedDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ShoppingList | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  // 有効な日付（再集計用）
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());

  // 週を変更する関数
  const changeWeek = (offset: number) => {
    setSelectedDate(prev => addWeeks(prev, offset));
  };

  const generateList = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setCheckedItems(new Set());
    setActiveDates(new Set());

    // 選択された月曜日から金曜日までの日付を計算
    const dateStrings = [];
    for (let i = 0; i < 5; i++) {
      const date = addDays(selectedDate, i);
      dateStrings.push(format(date, 'yyyyMMdd'));
    }

    // URLを生成 (kYYYYMMDD形式)
    const urls = dateStrings.map(d => `https://www.lettuceclub.net/recipe/kondate/detail/k${d}/`);

    try {
      const response = await fetch('/api/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 部分的にレシピ取れたかもしれないのでdataがあれば表示したいが、今回はエラー時はエラーとして扱う
        throw new Error(data.error || 'リストの生成に失敗しました');
      }

      setResult(data);

      // 初期状態では成功した全日付をActiveにする
      if (data.recipes) {
        const successDates = data.recipes
          .filter((r: any) => r.status === 'success')
          .map((r: any) => r.date);
        setActiveDates(new Set(successDates));
      }

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('予期せぬエラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const updateList = async () => {
    if (!result) return;

    setLoading(true);
    setError('');

    // Activeな日付のrawIngredientsを収集
    const targetIngredients: string[] = [];
    result.recipes.forEach(recipe => {
      if (activeDates.has(recipe.date) && recipe.rawIngredients) {
        targetIngredients.push(recipe.rawIngredients);
      }
    });

    if (targetIngredients.length === 0) {
      setError('集計対象の献立がありません');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientsData: targetIngredients }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '再集計に失敗しました');
      }

      // ingredientsのみ更新
      setResult(prev => prev ? { ...prev, ingredients: data.ingredients } : null);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('予期せぬエラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDate = (date: string) => {
    // resultがない場合は何もしない
    if (!result) return;

    const newActive = new Set(activeDates);
    if (newActive.has(date)) {
      newActive.delete(date);
    } else {
      newActive.add(date);
    }
    setActiveDates(newActive);
  };

  const toggleItem = (name: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(name)) {
      newChecked.delete(name);
    } else {
      newChecked.add(name);
    }
    setCheckedItems(newChecked);
  };

  // カテゴリごとのグループ化
  const groupIngredients = (ingredients: Ingredient[]) => {
    return ingredients.reduce((acc, curr) => {
      const category = curr.category || 'その他';
      if (!acc[category]) acc[category] = [];
      acc[category].push(curr);
      return acc;
    }, {} as Record<string, Ingredient[]>);
  };

  // 期間表示用文字列
  const weekLabel = `${format(selectedDate, 'M/d')} ~ ${format(addDays(selectedDate, 4), 'M/d')}`;

  return (
    <main className="container-custom">
      {/* Header */}
      <header className="text-center mb-6 md:mb-8">
        <h1 className="text-2xl md:text-4xl font-bold gradient-text mb-2 flex items-center justify-center gap-2 md:gap-3">
          <ShoppingBag className="w-6 h-6 md:w-8 md:h-8 text-pink-400" />
          AI Shopping List
        </h1>
        <p className="text-sm md:text-base text-gray-500 font-medium px-4">レタスクラブの献立から、あなたのための買い物リストを提案します</p>
      </header>

      {/* Control Panel */}
      <div className="glass-panel p-4 md:p-6 mb-6 md:mb-8 text-center animate-fade-in shadow-xl mx-auto max-w-2xl md:max-w-none">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mb-4 md:mb-6">
          <div className="flex items-center gap-2 md:gap-4 bg-white/80 p-1.5 md:p-2 rounded-full shadow-sm backdrop-blur-sm w-full md:w-auto justify-between md:justify-start">
            <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-pink-100 rounded-full text-pink-500 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-2 md:px-4 font-bold text-gray-700 text-sm md:text-base">
              <Calendar className="w-4 h-4 md:w-5 md:h-5 text-pink-400" />
              <span>{weekLabel}</span>
            </div>
            <button onClick={() => changeWeek(1)} className="p-2 hover:bg-pink-100 rounded-full text-pink-500 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={generateList}
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 px-8 w-full md:w-auto py-3 md:py-2 text-base md:text-lg shadow-lg active:scale-95 transition-transform"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
            {loading ? 'AIが考え中...' : 'リストを作成'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50/90 backdrop-blur-sm text-red-500 p-4 rounded-xl flex items-center justify-center gap-2 border border-red-100">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="grid md:grid-cols-3 gap-8 animate-fade-in-up">
          {/* Left Column: Recipes */}
          <div className="md:col-span-1 space-y-4">
            <div className="sticky top-4 bg-transparent pb-2 z-10">
              <h2 className="text-xl font-bold text-gray-700 flex items-center gap-2 mb-2">
                <span className="bg-pink-100 text-pink-500 p-1 rounded">📅</span> 今週の献立
              </h2>
              <p className="text-xs text-gray-500 mb-2">不要な曜日のチェックを外して「再集計」を押してください</p>
              <button
                onClick={updateList}
                disabled={loading}
                className="w-full bg-white/50 hover:bg-white border border-pink-200 text-pink-600 font-bold py-2 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔄'} 選択した献立で再集計
              </button>
            </div>
            {result.recipes.map((menu, idx) => {
              const isActive = activeDates.has(menu.date);
              return (
                <div key={idx} className={`relative transition-all duration-300 ${isActive ? '' : 'opacity-50 grayscale'}`}>
                  <div className="absolute top-2 right-2 z-20">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => menu.status === 'success' && toggleDate(menu.date)}
                      disabled={menu.status === 'failed'}
                      className="w-5 h-5 accent-pink-500 cursor-pointer"
                    />
                  </div>
                  <a
                    href={menu.status === 'success' ? menu.url : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`block card group relative overflow-hidden ${menu.status === 'failed' ? 'border-red-200 bg-red-50' : isActive ? 'hover:border-pink-300' : 'border-gray-200'}`}
                  >
                    <div className="flex flex-col h-full">
                      <div className="text-xs font-bold text-gray-400 mb-2 flex justify-between items-center border-b pb-1">
                        <span className="text-lg text-pink-500">{menu.dayOfWeek ? `${menu.dayOfWeek}` : '-'}</span>
                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">{menu.date}</span>
                      </div>

                      {menu.dishes && menu.dishes.length > 0 ? (
                        <div className="space-y-2">
                          {menu.dishes.map((dish, dIdx) => (
                            <div key={dIdx} className="flex items-start gap-2">
                              <span className={dish.type === 'main' ? 'tag-main shrink-0' : 'tag-side shrink-0'}>
                                {dish.type === 'main' ? '主' : '副'}
                              </span>
                              <span className={`text-sm leading-tight ${dish.type === 'main' ? 'font-bold text-gray-700' : 'text-gray-600'}`}>
                                {dish.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`font-bold ${menu.status === 'failed' ? 'text-gray-400' : 'text-gray-800'}`}>
                          {menu.status === 'failed' ? '取得失敗' : 'データなし'}
                        </div>
                      )}

                      {menu.status === 'failed' && (
                        <div className="text-red-400 text-xs mt-2 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> 取得失敗
                        </div>
                      )}
                    </div>
                  </a>
                </div>
              );
            })}
          </div>

          {/* Right Column: Shopping List */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="bg-green-100 text-green-500 p-1 rounded">🛒</span> お買い物リスト
            </h2>

            <div className="space-y-6 pb-20">
              {SHOPPING_CATEGORIES.map((category) => {
                const items = groupIngredients(result.ingredients)[category] || [];
                const hasItems = items.length > 0;

                return (
                  <div key={category} className={`glass-panel p-5 ${!hasItems ? 'opacity-60' : ''}`}>
                    <h3 className="text-lg font-bold text-gray-600 mb-3 border-b border-gray-100 pb-2 flex justify-between items-center">
                      {category}
                      {!hasItems && <span className="text-xs font-normal text-gray-400">無し</span>}
                    </h3>

                    {hasItems ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {items.map((item, idx) => {
                          const key = `${category}-${item.name}-${idx}`;
                          const isChecked = checkedItems.has(key);
                          return (
                            <div
                              key={key}
                              className={`flex items-start gap-3 p-2 rounded-lg transition-all cursor-pointer ${isChecked ? 'bg-gray-50 opacity-50' : 'hover:bg-white/50'}`}
                              onClick={() => toggleItem(key)}
                            >
                              <label className="flex items-start gap-3 w-full cursor-pointer group">
                                <div className="relative pt-1 flex-shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleItem(key)}
                                    className="checkbox-custom appearance-none w-5 h-5 border-2 border-gray-300 rounded focus:outline-none checked:bg-pink-500 checked:border-pink-500 transition-colors"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline mb-1">
                                    <span className={`font-medium text-base truncate pr-2 ${isChecked ? 'line-through text-gray-400 decoration-gray-300' : 'text-gray-700 group-hover:text-pink-600 transition-colors'}`}>
                                      {item.name}
                                    </span>
                                    <span className={`text-sm whitespace-nowrap ${isChecked ? 'text-gray-300' : 'text-pink-500 font-bold'}`}>
                                      {item.amount}
                                    </span>
                                  </div>

                                  {/* 使用曜日のバッジ表示 */}
                                  {item.usedDays && item.usedDays.length > 0 && (
                                    <div className={`flex flex-wrap gap-1 mt-0.5 ${isChecked ? 'opacity-50' : ''}`}>
                                      {item.usedDays.map(day => (
                                        <span key={day} className={`day-badge day-badge-${day} shadow-sm`}>{day}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-400 py-2 pl-2">
                        必要な材料はありません
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Raw Data Display */}
            <div className="mt-12 border-t border-gray-200 pt-8">
              <details className="group">
                <summary className="flex items-center gap-2 cursor-pointer text-gray-400 hover:text-gray-600 transition-colors list-none">
                  <span className="transform group-open:rotate-90 transition-transform">▶</span>
                  <span className="font-bold text-sm">解析用生データを表示</span>
                </summary>
                <div className="mt-4 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto shadow-inner">
                  <pre>
                    {result.recipes.map(r => r.rawIngredients).filter(Boolean).join('\n\n-------------------\n\n') || "データなし"}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

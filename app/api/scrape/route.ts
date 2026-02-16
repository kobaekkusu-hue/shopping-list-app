import { NextResponse } from 'next/server';
import { scrapeRecipe } from '@/lib/scraper';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
        return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    const data = await scrapeRecipe(targetUrl);

    if (!data) {
        return NextResponse.json({ error: 'Failed to scrape data' }, { status: 500 });
    }

    return NextResponse.json(data);
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || !q.trim()) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Endpoint gợi ý tìm kiếm chính thức của YouTube client
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`
    );
    const data = await res.json();
    // data[1] chứa mảng các cụm từ gợi ý
    return NextResponse.json({ suggestions: data[1] || [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
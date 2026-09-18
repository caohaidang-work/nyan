import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  try {
    const ytDlpPath = path.join(process.cwd(), 'yt-dlp.exe');

    // Tìm kiếm 15 video liên quan nhất bằng ytsearch15
    const { stdout } = await execFileAsync(ytDlpPath, [
      `ytsearch15:${query}`,
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
    ]);

    const data = JSON.parse(stdout);
    const entries = data.entries || [];

    const results = entries.map((item: any) => ({
      id: item.id,
      title: item.title,
      author: item.uploader || item.channel || 'Nghệ sĩ',
      duration: item.duration_string || '',
      thumbnail: `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    }));

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Lỗi tìm kiếm: ' + err.message }, { status: 500 });
  }
}
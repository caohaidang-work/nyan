import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import path from 'path';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('id');

  if (!videoId) {
    return NextResponse.json({ error: 'Thiếu ID bài hát' }, { status: 400 });
  }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const ytDlpPath = process.platform === 'win32' ? path.join(process.cwd(), 'yt-dlp.exe') : 'yt-dlp';

    // Chạy trực tiếp file yt-dlp.exe từ thư mục gốc
    const { stdout } = await execFileAsync(ytDlpPath, [
      videoUrl,
      '--dump-single-json',
      '--no-warnings',
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    ]);

    const output = JSON.parse(stdout);

    if (!output || !output.url) {
      return NextResponse.json(
        { error: 'Không tìm thấy link audio' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      title: output.title || 'Unknown Title',
      author: output.uploader || output.channel || 'Unknown Artist',
      thumbnail: output.thumbnail || '',
      streamUrl: output.url,
    });
  } catch (err: any) {
    console.error('yt-dlp error:', err);
    return NextResponse.json(
      { error: 'Lỗi bóc tách: ' + (err.message || 'Không thể lấy dữ liệu') },
      { status: 500 }
    );
  }
}
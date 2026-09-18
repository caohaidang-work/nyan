import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Chưa đăng nhập Google' }, { status: 401 });
  }

  try {
    // 1. Lấy danh sách Playlist của người dùng
    const playlistRes = await fetch(
      'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=20',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const playlists = await playlistRes.json();

    // 2. Lấy danh sách bài hát đã thích (Liked Videos)
    const likedRes = await fetch(
      'https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&myRating=like&maxResults=20',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const likedSongs = await likedRes.json();

    return NextResponse.json({
      playlists: (playlists.items || []).map((p: any) => ({
        id: p.id,
        title: p.snippet.title,
        thumbnail: p.snippet.thumbnails?.medium?.url || '',
        count: p.contentDetails.itemCount,
      })),
      likedSongs: (likedSongs.items || []).map((v: any) => ({
        id: v.id,
        title: v.snippet.title,
        author: v.snippet.channelTitle,
        thumbnail: v.snippet.thumbnails?.medium?.url || '',
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { 
  Play, Pause, Search, Loader2, LogIn, Heart, 
  Home as HomeIcon, X, SkipForward, SkipBack, Repeat, Disc
} from 'lucide-react';

interface VideoItem {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  duration?: string;
}

interface CurrentTrack extends VideoItem {
  streamUrl: string;
}

export default function CDPlayerApp() {
  const [query, setQuery] = useState('lofi chill vibes');
  const [searchResults, setSearchResults] = useState<VideoItem[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Suggestions Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Player States
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Google Auth
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<{ likedSongs: any[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'library'>('home');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentList = activeTab === 'library' && userData ? userData.likedSongs : searchResults;

  // Đóng gợi ý khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce gọi API gợi ý YouTube
  useEffect(() => {
    if (!query.trim() || !showSuggestions) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, showSuggestions]);

  // Nạp danh sách ban đầu
  useEffect(() => {
    handleSearch('y2k underground chill');
  }, []);

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setShowSuggestions(false);
    setLoadingSearch(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await res.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch {
      alert('Không tìm được bài hát');
    } finally {
      setLoadingSearch(false);
    }
  };

  const selectSuggestion = (text: string) => {
    setQuery(text);
    setShowSuggestions(false);
    handleSearch(text);
  };

  const loginGoogle = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
    onSuccess: async (tokenResponse) => {
      setUserToken(tokenResponse.access_token);
      try {
        const res = await fetch('/api/user/library', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const data = await res.json();
        setUserData(data);
        setActiveTab('library');
      } catch {
        alert('Lỗi nạp danh sách yêu thích');
      }
    },
  });

  const playVideo = async (item: VideoItem) => {
    setLoadingTrack(true);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
      }

      const res = await fetch(`/api/stream?id=${item.id}`);
      const data = await res.json();
      if (data.error || !data.streamUrl) throw new Error(data.error);

      const track: CurrentTrack = { ...item, streamUrl: data.streamUrl };
      setCurrentTrack(track);

      if (audioRef.current) {
        audioRef.current.src = track.streamUrl;
        audioRef.current.load();
        await audioRef.current.play();
        setIsPlaying(true);
      }

      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title,
          artist: track.author,
          artwork: [{ src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }],
        });
        navigator.mediaSession.setActionHandler('play', () => {
          audioRef.current?.play();
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          audioRef.current?.pause();
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => handleNextTrack());
        navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevTrack());
      }
    } catch (err: any) {
      setIsPlaying(false);
      alert(err.message || 'Không thể phát bài này');
    } finally {
      setLoadingTrack(false);
    }
  };

  // Logic chuyển bài kế tiếp (Autoplay)
  const handleNextTrack = useCallback(() => {
    if (!currentTrack || currentList.length === 0) return;
    const currentIndex = currentList.findIndex((item) => item.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % currentList.length;
    playVideo(currentList[nextIndex]);
  }, [currentTrack, currentList]);

  // Logic quay về bài trước
  const handlePrevTrack = useCallback(() => {
    if (!currentTrack || currentList.length === 0) return;
    const currentIndex = currentList.findIndex((item) => item.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + currentList.length) % currentList.length;
    playVideo(currentList[prevIndex]);
  }, [currentTrack, currentList]);

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (!audioRef.current.src && currentTrack) {
        await playVideo(currentTrack);
      } else if (audioRef.current.src) {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans select-none overflow-hidden">
      
      {/* ===================== SIDEBAR TRÁI: ĐĨA CD XOAY & PLAYER PANEL ===================== */}
      <aside
        className={`bg-neutral-950 border-r border-neutral-900 p-6 flex flex-col justify-between shrink-0 h-full overflow-y-auto transition-all duration-500 ease-in-out z-20 ${
          currentTrack 
            ? 'w-80 sm:w-96 translate-x-0 opacity-100 shadow-[10px_0_30px_rgba(0,0,0,0.8)]' 
            : 'w-0 p-0 border-none -translate-x-full opacity-0 overflow-hidden'
        }`}
      >
        {currentTrack && (
          <>
            {/* Header Mini Panel */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-900">
              <span className="text-xs font-semibold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5">
                <Disc size={13} className={isPlaying ? 'animate-spin text-white' : ''} /> Now Playing
              </span>
              <button
                onClick={() => {
                  audioRef.current?.pause();
                  setIsPlaying(false);
                  setCurrentTrack(null);
                }}
                className="text-neutral-500 hover:text-white p-1 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* HỘP ĐĨA CD MICA JEWEL CASE CHÍNH ĐANG PHÁT */}
            <div className="my-auto py-2 flex flex-col items-center">
              <div className="relative w-full aspect-square max-w-[280px] p-3 bg-neutral-900/40 rounded-2xl border border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.9)] backdrop-blur-xl flex items-center justify-center overflow-hidden">
                
                {/* Khớp nhựa trong suốt mép trái và phải */}
                <div className="absolute left-1.5 top-4 bottom-4 w-1.5 bg-white/20 rounded-full" />
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-8 border border-white/30 rounded-sm bg-white/5" />
                <div className="absolute right-1.5 top-8 w-1 h-6 bg-white/20 rounded-full" />
                <div className="absolute right-1.5 bottom-8 w-1 h-6 bg-white/20 rounded-full" />

                {/* Vệt bóng gương chéo */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none z-20" />

                {/* Vòng khay đĩa (Tray Ring) */}
                <div className="w-[92%] aspect-square rounded-full border border-white/15 p-1 flex items-center justify-center relative">
                  
                  {/* ĐĨA CD XOAY KHI ĐANG PHÁT NHẠC */}
                  <div
                    className={`relative w-full h-full rounded-full overflow-hidden shadow-2xl flex items-center justify-center border border-white/30 ${
                      isPlaying ? 'animate-[spin_5s_linear_infinite]' : ''
                    }`}
                    style={{ transformOrigin: 'center' }}
                  >
                    <img
                      src={currentTrack.thumbnail}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover filter contrast-110"
                    />

                    {/* Hologram phản quang cầu vồng */}
                    <div className="absolute inset-0 bg-[conic-gradient(from_45deg,transparent,rgba(255,255,255,0.2),transparent,rgba(255,255,255,0.2),transparent)] mix-blend-overlay pointer-events-none" />

                    {/* Lỗ trục tâm đĩa CD trong suốt */}
                    <div className="absolute w-1/4 aspect-square rounded-full bg-black/60 backdrop-blur-md border-2 border-white/40 shadow-inner flex items-center justify-center">
                      <div className="w-1/2 aspect-square rounded-full bg-black border border-white/60 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-neutral-800" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Thông tin bài hát bên dưới */}
              <div className="w-full text-left mt-5 px-1">
                <h3 className="font-semibold text-sm text-white truncate lowercase">
                  {currentTrack.title}
                </h3>
                <p className="text-xs text-neutral-400 truncate mt-1">
                  {currentTrack.author}
                </p>
              </div>

              {/* Seek Bar */}
              <div className="w-full mt-5 px-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Bộ điều khiển Play/Pause, Next/Prev */}
              <div className="flex items-center justify-center gap-5 mt-4">
                <button
                  onClick={handlePrevTrack}
                  disabled={loadingTrack}
                  className="text-neutral-400 hover:text-white transition p-2 active:scale-95"
                >
                  <SkipBack size={18} />
                </button>

                <button
                  onClick={togglePlay}
                  disabled={loadingTrack}
                  className="w-11 h-11 bg-white text-black hover:scale-105 active:scale-95 rounded-full flex items-center justify-center transition shadow-lg"
                >
                  {loadingTrack ? (
                    <Loader2 className="animate-spin text-black" size={18} />
                  ) : isPlaying ? (
                    <Pause size={18} className="fill-current" />
                  ) : (
                    <Play size={18} className="fill-current ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleNextTrack}
                  disabled={loadingTrack}
                  className="text-neutral-400 hover:text-white transition p-2 active:scale-95"
                >
                  <SkipForward size={18} />
                </button>
              </div>
            </div>

            {/* Chế độ Tự động chuyển bài (Autoplay) */}
            <div className="pt-3 border-t border-neutral-900 flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">Audio Stream 160kbps</span>
              <button
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition ${
                  isAutoPlay 
                    ? 'border-white text-white bg-white/10' 
                    : 'border-neutral-800 text-neutral-500'
                }`}
              >
                <Repeat size={11} /> Autoplay: {isAutoPlay ? 'On' : 'Off'}
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ===================== KHU VỰC PHẢI: TÌM KIẾM & DANH SÁCH COMPACT ===================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Header với Search Autocomplete & Google Auth */}
        <header className="h-16 border-b border-neutral-900 px-6 sm:px-8 flex items-center justify-between gap-4 bg-black/60 backdrop-blur-md shrink-0 z-30">
          <div ref={searchContainerRef} className="flex-1 max-w-sm relative">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch(query);
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search songs or artist..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-full py-2 pl-4 pr-10 text-xs focus:outline-none focus:border-neutral-500 text-neutral-200 transition"
              />
              <button type="submit" className="absolute right-3.5 text-neutral-500 hover:text-white">
                <Search size={14} />
              </button>
            </form>

            {/* Dropdown gợi ý từ khóa kiểu YouTube */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl py-1.5 shadow-2xl z-50 overflow-hidden">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectSuggestion(item)}
                    className="px-4 py-2 hover:bg-neutral-800 flex items-center gap-3 cursor-pointer text-xs text-neutral-300 transition"
                  >
                    <Search size={12} className="text-neutral-500 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!userToken ? (
            <button
              onClick={() => loginGoogle()}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold px-4 py-2 rounded-full border border-neutral-800 transition shrink-0"
            >
              <LogIn size={13} /> Google Sync
            </button>
          ) : (
            <button
              onClick={() => setActiveTab(activeTab === 'home' ? 'library' : 'home')}
              className="flex items-center gap-1.5 bg-neutral-900 text-neutral-300 text-xs px-4 py-2 rounded-full border border-neutral-800 hover:text-white transition shrink-0"
            >
              {activeTab === 'home' ? <Heart size={13} className="fill-rose-500 text-rose-500" /> : <HomeIcon size={13} />}
              {activeTab === 'home' ? 'Liked Discs' : 'Browse'}
            </button>
          )}
        </header>

        {/* Danh sách đĩa CD thu gọn (Dense Compact Grid) */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          {activeTab === 'library' && userData ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold tracking-wider uppercase text-neutral-400 flex items-center gap-2">
                <Heart size={15} className="fill-rose-500 text-rose-500" /> Liked Discs ({userData.likedSongs.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {userData.likedSongs.map((song) => (
                  <CompactCDCard 
                    key={song.id} 
                    item={song} 
                    isSelected={currentTrack?.id === song.id}
                    onClick={() => playVideo(song)} 
                  />
                ))}
              </div>
            </div>
          ) : (
            loadingSearch ? (
              <div className="py-28 flex flex-col items-center justify-center gap-3 text-neutral-500">
                <Loader2 className="animate-spin text-neutral-400" size={28} />
                <p className="text-xs uppercase tracking-wider">Loading collection...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {searchResults.map((item) => (
                  <CompactCDCard 
                    key={item.id} 
                    item={item} 
                    isSelected={currentTrack?.id === item.id}
                    onClick={() => playVideo(item)} 
                  />
                ))}
              </div>
            )
          )}
        </main>
      </div>

      {/* Engine âm thanh tự động chuyển bài */}
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          if (isAutoPlay) {
            handleNextTrack();
          } else {
            setIsPlaying(false);
          }
        }}
        playsInline
      />
    </div>
  );
}

// Component thẻ đĩa CD trong suốt nhỏ gọn
function CompactCDCard({ item, isSelected, onClick }: { item: VideoItem; isSelected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex flex-col cursor-pointer group transition-transform duration-300 hover:-translate-y-1"
    >
      {/* VỎ ĐĨA MICA JEWEL CASE NHỎ GỌN */}
      <div className={`relative w-full aspect-square p-2 bg-neutral-900/30 rounded-xl border backdrop-blur-md flex items-center justify-center overflow-hidden transition-colors ${
        isSelected ? 'border-white bg-neutral-900/70 shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'border-white/15 hover:border-white/30'
      }`}>
        {/* Khớp bản lề nhựa mép trái */}
        <div className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-white/20 rounded-full" />
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-6 border border-white/30 rounded-sm bg-white/5" />
        
        {/* Vệt phản quang kính */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none z-20 group-hover:via-white/20 transition" />

        {/* Khay đĩa tròn */}
        <div className="w-[90%] aspect-square rounded-full border border-white/15 p-0.5 flex items-center justify-center relative">
          <div className="relative w-full h-full rounded-full overflow-hidden shadow-lg flex items-center justify-center border border-white/20">
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-full h-full object-cover filter contrast-105"
            />
            
            {/* Vệt bóng CD */}
            <div className="absolute inset-0 bg-[conic-gradient(from_60deg,transparent,rgba(255,255,255,0.15),transparent,rgba(255,255,255,0.15),transparent)] mix-blend-overlay pointer-events-none" />

            {/* Trục tâm nhỏ */}
            <div className="absolute w-1/4 aspect-square rounded-full bg-black/70 border border-white/40 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" />
            </div>
          </div>
        </div>

        {item.duration && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[9px] font-mono px-1 py-0.5 rounded text-neutral-300 z-20">
            {item.duration}
          </span>
        )}
      </div>

      {/* Tên bài chữ thường thanh lịch */}
      <h4 className="mt-2 text-xs font-medium text-neutral-300 truncate group-hover">
        {item.title}
      </h4>
    </div>
  );
}
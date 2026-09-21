export interface EmbedSource {
  name: string;
  url: string;
}

export const getMovieEmbedSources = (movieId: number): EmbedSource[] => [
  {
    name: 'Vidlink',
    url: `https://vidlink.pro/movie/${movieId}?autoplay=false`,
  },
  {
    name: 'VidCore',
    url: `https://vidcore.net/movie/${movieId}?autoplay=false`,
  },
  {
    name: '2Embed',
    url: `https://www.2embed.cc/embed/${movieId}`,
  },
  {
    name: 'SuperEmbed',
    url: `https://multiembed.mov/?video_id=${movieId}&tmdb=1`,
  },
];

export const getTVEmbedSources = (
  tvId: number,
  season: number,
  episode: number,
): EmbedSource[] => {
  const vidCoreUrl =
    `https://vidcore.net/tv/${tvId}/${season}/${episode}?autoplay=false`;

  return [
    {
      name: 'Vidlink',
      url: `https://vidlink.pro/tv/${tvId}/${season}/${episode}?autoplay=false&fallback_url=${encodeURIComponent(vidCoreUrl)}`,
    },
    {
      name: 'VidCore',
      url: vidCoreUrl,
    },
    {
      name: '2Embed',
      url: `https://www.2embed.cc/embedtv/${tvId}&s=${season}&e=${episode}`,
    },
    {
      name: 'SuperEmbed',
      url: `https://multiembed.mov/?video_id=${tvId}&tmdb=1&s=${season}&e=${episode}`,
    },
  ];
};

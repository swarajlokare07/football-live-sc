import { useEffect, useState } from "react";
import { fetchMatchHighlights } from "../service/youtubeHighlights";

export default function Highlights() {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetchMatchHighlights()
      .then((result) => {
        if (active) setHighlights(result.highlights);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Football highlights could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      id="highlights"
      className="bg-[#0a0a0a] px-4 py-12 text-white sm:px-6 sm:py-16 lg:px-8"
      aria-labelledby="highlights-title"
    >
      <div className="mx-auto max-w-7xl">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-red-400">
          Watch
        </p>
        <h2 id="highlights-title" className="mb-6 text-2xl font-black sm:text-3xl">
          Football Highlights
        </h2>

        {loading ? (
          <p role="status" className="text-sm text-white/60">
            Loading latest highlights...
          </p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        ) : highlights.length === 0 ? (
          <p className="text-sm text-white/60">No highlights are available right now.</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map((highlight) => (
              <article
                key={highlight.videoId}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <iframe
                  className="aspect-video w-full"
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(highlight.videoId)}`}
                  title={highlight.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
                <div className="p-4">
                  <h3 className="line-clamp-2 text-sm font-bold">{highlight.title}</h3>
                  <p className="mt-2 text-xs text-white/50">{highlight.channelTitle}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

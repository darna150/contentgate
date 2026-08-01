export type StudioPreviewImageSources = {
  instantSrc: string;
  highResolutionSrc: string | null;
};

function scaledCreativePreviewUrl(src: string) {
  if (!src.includes("/api/creative/")) return src;

  const absolute = src.startsWith("http://") || src.startsWith("https://");
  const url = new URL(src, "https://contentgate.local");
  url.searchParams.set("scale", "2");
  return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Keep the lightweight Studio thumbnail as the first paint, then resolve the
 * best available authored/rendered image for a silent in-place upgrade.
 */
export function studioPreviewImageSources(input: {
  src: string;
  highResolutionSrc?: string;
}): StudioPreviewImageSources {
  const highResolutionSrc =
    input.highResolutionSrc ?? scaledCreativePreviewUrl(input.src);

  return {
    instantSrc: input.src,
    highResolutionSrc:
      highResolutionSrc === input.src ? null : highResolutionSrc,
  };
}

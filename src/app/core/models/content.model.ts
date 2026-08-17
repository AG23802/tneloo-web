export type MediaType = 'image' | 'video';

// A creator's own teaser/portfolio upload - publicly browsable (Home/Search),
// never the paid product itself. Collection: `content`, role-gated to
// creators only (see firestore.rules).
export interface Content {
  id?: string;
  ownerId: string;
  type: MediaType;

  url: string;
  // Video: a generated poster frame, so grids/sliders can show a still
  // without loading the whole video. Always null for images.
  thumbnailUrl?: string | null;

  width?: number;
  height?: number;

  // Video-specific, nullable. Seconds. Never set for images.
  duration?: number | null;

  // Storage bucket path, kept alongside `url` so deletion doesn't have to
  // parse it back out of a download URL.
  storagePath?: string;

  createdAt?: any;
}

// Rate limiter for TrailNote
// Simple time-based rate limiting to prevent rapid-fire requests

let last = 0;
export function allowEvery(ms=5000){
  const now = Date.now();
  if (now - last >= ms) { last = now; return true; }
  return false;
}


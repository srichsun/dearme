// Is there a newer build than the one running? The page's own module script
// carries the build's hash in its name; the server's current index.html
// carries the latest. Compare the two — no version endpoint needed.
export function bundleOf(html) {
  const m = (html || "").match(/assets\/index-[^"']+\.js/);
  return m ? m[0] : null;
}

export function currentBundle(doc = document) {
  const script = doc.querySelector('script[type="module"][src*="assets/index-"]');
  return script ? bundleOf(script.getAttribute("src")) : null;
}

// The short hash of the running build, e.g. "q-kIlrxq", for the footer —
// so "which version do you have?" has a one-word answer.
export function buildStamp(doc = document) {
  const b = currentBundle(doc);
  const m = b && b.match(/index-([^.]+)\.js/);
  return m ? m[1] : "dev";
}

// Fetch the live index.html past every cache and compare. Resolves to true
// when a newer build is out, false otherwise (including on any error).
export async function newerBuildExists(fetchFn = fetch, doc = document) {
  const running = currentBundle(doc);
  if (!running) return false;
  try {
    const res = await fetchFn("/meals", { cache: "no-store" });
    if (!res.ok) return false;
    const latest = bundleOf(await res.text());
    return Boolean(latest) && latest !== running;
  } catch {
    return false;
  }
}

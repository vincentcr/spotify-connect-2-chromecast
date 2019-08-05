export function parse() {
  const q = window.location.search.slice(1);
  const kvPairs = q.split("&");
  const obj: { [k: string]: string | undefined } = {};
  for (const kv of kvPairs) {
    const [k, v] = kv.split("=");
    obj[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return obj;
}

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

export function encode(obj: { [key: string]: any }) {
  let q = "";
  for (const [k, v] of Object.entries(obj)) {
    const sep = q.length === 0 ? "?" : "&";
    q += sep + encodeURIComponent(k) + "=" + encodeURIComponent(v);
  }

  return q;
}

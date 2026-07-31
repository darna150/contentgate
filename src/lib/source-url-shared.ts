import { isIP } from "node:net";

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    hellip: "…",
    laquo: "«",
    ldquo: "“",
    lsquo: "‘",
    lt: "<",
    nbsp: " ",
    ndash: "–",
    quot: '"',
    raquo: "»",
    rdquo: "”",
    rsquo: "’",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith("#")) {
      const isHex = code[1]?.toLowerCase() === "x";
      const point = Number.parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

export function titleFromHtml(html: string, fallback: string) {
  const openGraph = html.match(
    /<meta\s+[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i
  )?.[1];
  const title = openGraph ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return decodeHtmlEntities((title ?? fallback).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function readableTextFromHtml(html: string) {
  const withoutHiddenContent = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|canvas|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ");

  const preferred =
    withoutHiddenContent.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    withoutHiddenContent.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    withoutHiddenContent.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    withoutHiddenContent;

  return decodeHtmlEntities(
    preferred
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/(address|article|blockquote|div|dl|fieldset|figure|h[1-6]|header|li|main|ol|p|pre|section|table|tr|ul)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isBlockedIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

export function isBlockedNetworkAddress(rawAddress: string) {
  const address = rawAddress.replace(/^\[|\]$/g, "").toLowerCase();
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version !== 6) return true;

  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mappedIpv4) return isBlockedIpv4(mappedIpv4);
  return (
    address === "::" ||
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe8") ||
    address.startsWith("fe9") ||
    address.startsWith("fea") ||
    address.startsWith("feb") ||
    address.startsWith("ff") ||
    address.startsWith("2001:db8:")
  );
}

export function normalizeSourceUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("Enter a complete website URL, including https://.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only public HTTP and HTTPS pages can be imported.");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing usernames or passwords cannot be imported.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Only standard website ports can be imported.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".test") ||
    (isIP(hostname) > 0 && isBlockedNetworkAddress(hostname))
  ) {
    throw new Error("Only publicly accessible website URLs can be imported.");
  }

  url.hash = "";
  return url.toString();
}

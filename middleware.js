import { sha256 } from "./js/sha256.js";

// Vercel Middleware to inject environment variables
export default async function middleware(request) {
  // Get the URL from the request
  const url = new URL(request.url);

  console.log(`Vercel Middleware: 处理请求 - ${url.pathname}`);

  // 跳过API和静态资源
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.includes(".js") ||
    url.pathname.includes(".css") ||
    url.pathname.includes(".png") ||
    url.pathname.includes(".jpg") ||
    url.pathname.includes(".jpeg") ||
    url.pathname.includes(".gif") ||
    url.pathname.includes(".svg") ||
    url.pathname.includes(".ico") ||
    url.pathname.includes(".woff") ||
    url.pathname.includes(".woff2") ||
    url.pathname.includes(".ttf") ||
    url.pathname.includes(".eot")
  ) {
    console.log(`Vercel Middleware: 跳过静态资源 - ${url.pathname}`);
    return;
  }

  // 跳过watch.html，因为它只是一个中转页面，会自动跳转到player.html
  if (url.pathname === "/watch.html") {
    console.log(`Vercel Middleware: 跳过中转页面 - ${url.pathname}`);
    return;
  }

  // 改进路径匹配：处理所有可能的HTML页面路径，包括搜索页面
  const isHtmlPage =
    url.pathname.endsWith(".html") ||
    url.pathname === "/" ||
    url.pathname === "" ||
    !url.pathname.includes(".") ||
    url.pathname.startsWith("/s=") ||
    url.pathname.includes("?s=");

  if (!isHtmlPage) {
    console.log(`Vercel Middleware: 跳过非HTML页面 - ${url.pathname}`);
    return;
  }

  // Fetch the original response
  const response = await fetch(request);

  // Check if it's an HTML response
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    console.log(`Vercel Middleware: 非HTML响应，跳过处理 - ${contentType}`);
    return response;
  }

  // Get the HTML content
  const originalHtml = await response.text();

  console.log(`Vercel Middleware: 处理HTML内容 - 长度: ${originalHtml.length}`);

  // 尝试多种方式获取环境变量
  const password =
    process.env.PASSWORD ||
    (typeof globalThis !== "undefined" && globalThis.PASSWORD) ||
    "";

  let passwordHash = "";
  if (password) {
    passwordHash = await sha256(password);
    console.log(
      `Vercel Middleware: 密码已设置，哈希长度: ${passwordHash.length}`
    );
  } else {
    console.log(`Vercel Middleware: 密码未设置`);
  }

  // 替换密码占位符
  const originalPlaceholder = 'window.__ENV__.PASSWORD = "{{PASSWORD}}";';
  const replacement = `window.__ENV__.PASSWORD = "${passwordHash}";`;

  if (originalHtml.includes(originalPlaceholder)) {
    const modifiedHtml = originalHtml.replace(originalPlaceholder, replacement);
    console.log(
      `Vercel Middleware: 成功替换密码占位符 - 路径: ${url.pathname}`
    );

    return new Response(modifiedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } else {
    console.log(`Vercel Middleware: 未找到密码占位符 - 路径: ${url.pathname}`);
    // 尝试查找类似的占位符
    const placeholderIndex = originalHtml.indexOf("{{PASSWORD}}");
    if (placeholderIndex !== -1) {
      console.log(
        `Vercel Middleware: 找到PASSWORD占位符，但格式不匹配 - 位置: ${placeholderIndex}`
      );
      console.log(
        `Vercel Middleware: 占位符上下文: ${originalHtml.substring(
          placeholderIndex - 30,
          placeholderIndex + 30
        )}`
      );
    }
  }

  return response;
}

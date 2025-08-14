export async function GET() {
  const urls = [
    { loc: "https://mallumeet.netlify.app/", lastmod: new Date().toISOString() },
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `<url>
  <loc>${url.loc}</loc>
  <lastmod>${url.lastmod}</lastmod>
</url>`
  )
  .join("")}
</urlset>`;

  return new Response(sitemap, { headers: { "Content-Type": "application/xml" } });
}

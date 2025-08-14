export async function GET() {
  return new Response(
    `User-agent: *
Allow: /
Sitemap: https://mallumeet.netlify.app/sitemap.xml`,
    { headers: { "Content-Type": "text/plain" } }
  );
}

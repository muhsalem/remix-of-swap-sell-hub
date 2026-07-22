import { createFileRoute, Link } from "@tanstack/react-router";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BookOpen, Clock } from "lucide-react";
import { BLOG_POSTS } from "@/lib/blog-content";

const SITE = "https://badelbarter.lovable.app";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "المدونة — نصائح المقايضة والتسعير الذكي | بدِّل" },
      {
        name: "description",
        content:
          "مقالات ودلائل شاملة حول المقايضة الذكية، التسعير العادل، التداول الآمن، وضوابط المقايضة الشرعية في العالم العربي.",
      },
      { property: "og:title", content: "مدونة بدِّل — المقايضة الذكية العادلة" },
      { property: "og:description", content: "دلائل ونصائح عملية للمقايضة والبيع الآمن في السعودية ومصر." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/blog` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/blog` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "مدونة بدِّل",
          url: `${SITE}/blog`,
          inLanguage: "ar",
          blogPost: BLOG_POSTS.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            url: `${SITE}/blog/${p.slug}`,
            datePublished: p.publishedAt,
            description: p.description,
          })),
        }),
      },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <div dir="rtl" className="min-h-dvh bg-background">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-mono rounded-full uppercase tracking-wider mb-4">
            <BookOpen className="size-3" />
            المدونة
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold mb-3">
            دلائل ونصائح للمقايضة الذكية
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            كل ما تحتاج معرفته عن المقايضة العادلة، التسعير الذكي، والتداول الآمن في السعودية ومصر.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-5">
          {BLOG_POSTS.map((p) => (
            <Link
              key={p.slug}
              to="/blog/$slug"
              params={{ slug: p.slug }}
              className="block bg-card rounded-3xl ring-1 ring-black/5 p-6 hover:shadow-lg hover:ring-primary/20 transition-all"
            >
              <div className="flex items-center gap-2 text-xs mb-3">
                <span className="px-2 py-0.5 bg-accent/10 text-accent-foreground rounded-full font-bold">
                  {p.category}
                </span>
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {p.readMinutes} د قراءة
                </span>
              </div>
              <h2 className="font-display text-xl font-extrabold mb-2 leading-tight">{p.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

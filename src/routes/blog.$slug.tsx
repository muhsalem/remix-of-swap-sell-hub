import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ArrowRight, Clock, Calendar } from "lucide-react";
import { BLOG_POSTS, getPostBySlug } from "@/lib/blog-content";

const SITE = "https://badelbarter.lovable.app";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPostBySlug(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    if (!post) {
      return { meta: [{ title: "المقال غير موجود — بدِّل" }] };
    }
    const url = `${SITE}/blog/${params.slug}`;
    return {
      meta: [
        { title: `${post.title} | مدونة بدِّل` },
        { name: "description", content: post.description },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "article:published_time", content: post.publishedAt },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.publishedAt,
            inLanguage: "ar",
            author: { "@type": "Organization", name: "بدِّل" },
            publisher: { "@type": "Organization", name: "بدِّل" },
            mainEntityOfPage: { "@type": "WebPage", "@id": url },
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <div dir="rtl" className="min-h-dvh bg-background">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-extrabold mb-3">المقال غير موجود</h1>
        <p className="text-muted-foreground mb-6">قد يكون الرابط قديماً أو المقال حُذف.</p>
        <Link to="/blog" className="text-primary font-bold hover:underline">
          العودة إلى المدونة
        </Link>
      </main>
      <Footer />
    </div>
  ),
  errorComponent: ({ reset }) => (
    <div dir="rtl" className="min-h-dvh bg-background">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-extrabold mb-3">حدث خطأ غير متوقع</h1>
        <button onClick={reset} className="text-primary font-bold hover:underline">
          إعادة المحاولة
        </button>
      </main>
      <Footer />
    </div>
  ),
  component: BlogArticle,
});

function BlogArticle() {
  const { post } = Route.useLoaderData();
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 2);

  return (
    <div dir="rtl" className="min-h-dvh bg-background">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ArrowRight className="size-4" />
          كل المقالات
        </Link>

        <div className="flex items-center gap-2 text-xs mb-4">
          <span className="px-2 py-0.5 bg-accent/10 text-accent-foreground rounded-full font-bold">
            {post.category}
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Clock className="size-3" />
            {post.readMinutes} د قراءة
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="size-3" />
            {new Date(post.publishedAt).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
          {post.title}
        </h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">{post.description}</p>

        <article className="prose-content space-y-5 text-base leading-loose">
          {post.content.split("\n\n").map((block, i) => {
            if (block.startsWith("## ")) {
              return (
                <h2 key={i} className="font-display text-2xl font-extrabold mt-8 mb-2">
                  {block.slice(3)}
                </h2>
              );
            }
            if (block.startsWith("- ")) {
              const items = block.split("\n").map((l) => l.replace(/^- /, ""));
              return (
                <ul key={i} className="list-disc pr-6 space-y-1.5">
                  {items.map((it, j) => (
                    <li key={j}>{it}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-foreground/90">
                {block}
              </p>
            );
          })}
        </article>

        <div className="mt-12 p-6 rounded-3xl bg-primary/5 ring-1 ring-primary/20 text-center">
          <h3 className="font-display text-xl font-extrabold mb-2">جاهز لتجربة المقايضة الذكية؟</h3>
          <p className="text-sm text-muted-foreground mb-4">
            انشر عرضك مجاناً في أقل من دقيقة ودع محرك الـ AI يساعدك على تسعيره بعدالة.
          </p>
          <Link
            to="/new-listing"
            className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all"
          >
            أضف عرضك الآن
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-border">
            <h3 className="font-display text-xl font-extrabold mb-4">مقالات ذات صلة</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  to="/blog/$slug"
                  params={{ slug: p.slug }}
                  className="block bg-card rounded-2xl ring-1 ring-black/5 p-5 hover:shadow-md hover:ring-primary/20 transition-all"
                >
                  <div className="text-xs text-muted-foreground mb-1">{p.category}</div>
                  <div className="font-bold text-sm leading-snug">{p.title}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

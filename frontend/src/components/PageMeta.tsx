import { Helmet } from "react-helmet-async";

const BASE_URL = "https://leadhive.work";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;
const SITE_NAME = "LeadHive";

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface FaqSchemaItem {
  question: string;
  answer: string;
}

interface PageMetaProps {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
  ogImage?: string;
  noindex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  faqItems?: FaqSchemaItem[];
  articlePublished?: string;
  articleModified?: string;
  schemaType?: "WebPage" | "FAQPage" | "Article" | "ContactPage" | "AboutPage";
  extraSchema?: object;
}

export default function PageMeta({
  title,
  description,
  path,
  ogType = "website",
  ogImage = DEFAULT_IMAGE,
  noindex = false,
  breadcrumbs,
  faqItems,
  articlePublished,
  articleModified,
  schemaType = "WebPage",
  extraSchema,
}: PageMetaProps) {
  const canonicalUrl = `${BASE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  const breadcrumbSchema = breadcrumbs && breadcrumbs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "LeadHive",
        "item": BASE_URL,
      },
      ...breadcrumbs.map((bc, i) => ({
        "@type": "ListItem",
        "position": i + 2,
        "name": bc.name,
        "item": `${BASE_URL}${bc.url}`,
      })),
    ],
  } : null;

  const faqSchema = faqItems && faqItems.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
      },
    })),
  } : null;

  const webPageSchema = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "name": fullTitle,
    "description": description,
    "url": canonicalUrl,
    "isPartOf": {
      "@type": "WebSite",
      "name": SITE_NAME,
      "url": BASE_URL,
    },
    "publisher": {
      "@type": "Organization",
      "name": "株式会社LEADMARK",
      "url": BASE_URL,
    },
    ...(articlePublished ? { "datePublished": articlePublished } : {}),
    ...(articleModified ? { "dateModified": articleModified } : {}),
    ...(extraSchema || {}),
  };

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      <link rel="canonical" href={canonicalUrl} />

      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="ja_JP" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      <script type="application/ld+json">
        {JSON.stringify(webPageSchema)}
      </script>

      {breadcrumbSchema && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      )}

      {faqSchema && (
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      )}
    </Helmet>
  );
}

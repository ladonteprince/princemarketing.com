export function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PrinceMarketing",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://princemarketing.com",
    description: "AI-powered marketing platform that creates content, schedules posts, and manages social media for business owners.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "29",
      highPrice: "199",
      priceCurrency: "USD",
    },
    creator: {
      "@type": "Organization",
      name: "PrinceMarketing",
      url: "https://princemarketing.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

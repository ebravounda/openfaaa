import { Helmet } from "react-helmet-async";

const SITE = "https://openfactura.es";
const DEFAULT_IMAGE = `${SITE}/og-image.jpg`;

// SEO por página. Para páginas privadas usar noindex.
export function Seo({ title, description, path = "/", image = DEFAULT_IMAGE, noindex = false }) {
  const fullTitle = title ? `${title} | OpenFactura.es` : "OpenFactura.es | Facturación para autónomos y pymes en España";
  const url = `${SITE}${path}`;
  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="OpenFactura.es" />
      <meta property="og:locale" content="es_ES" />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}

export default Seo;

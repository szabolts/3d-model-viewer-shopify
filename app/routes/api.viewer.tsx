import { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { generateViewerHTML } from "../templates/model-viewer";

export async function loader({ request }: LoaderFunctionArgs) {
  // Use public app proxy authentication
  const { admin } = await authenticate.public.appProxy(request);

  // Get model URL from request
  const url = new URL(request.url);
  const modelUrl = url.searchParams.get('model') || '';
  
  // Get shop domain
  const shopResponse = await admin.graphql(`
    query {
      shop {
        myshopifyDomain
      }
    }
  `);
  
  const { data } = await shopResponse.json();
  const shopDomain = data?.shop?.myshopifyDomain || '';

  // Generate HTML with viewer code
  const html = generateViewerHTML(modelUrl);

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "Content-Security-Policy": `frame-ancestors 'self' https://${shopDomain} https://*.myshopify.com https://admin.shopify.com https://online-store-web.shopifyapps.com;`,
      "X-Frame-Options": "ALLOW-FROM *"
    }
  });
}
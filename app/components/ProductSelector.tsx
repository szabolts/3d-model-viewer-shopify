import { BlockStack, Button, Card, Text, ResourceList, ResourceItem, Thumbnail, LegacyCard, InlineStack } from '@shopify/polaris';
import { ImageIcon } from '@shopify/polaris-icons';

interface Product {
  id: string;
  title: string;
  images?: Array<{ url: string }>;
  variants?: Array<{ nodes: Array<{ priceV2?: { amount: number } }> }>;
}

interface ProductSelectorProps {
  product: Product | null;
  onSelectProduct: () => void;
}

export function ProductSelector({ product, onSelectProduct }: ProductSelectorProps) {
  return (
    <Card>
      <BlockStack gap="500">
        <InlineStack align="space-between">
          <Text as="h2" variant="headingMd">
            Product
          </Text>
          <Button variant="plain" onClick={onSelectProduct}>
            {product ? 'Change product' : 'Select product'}
          </Button>
        </InlineStack>
        {product ? (
          <LegacyCard>
            <ResourceItem
              id={product.id}
              media={
                product.images?.[0]?.url ? (
                  <Thumbnail
                    source={product.images[0].url}
                    alt={product.title}
                    size="small"
                  />
                ) : (
                  <Thumbnail source={ImageIcon} size="small" alt="" />
                )
              }
              accessibilityLabel={`View details for ${product.title}`}
              onClick={() => {}}
            >
              <Text variant="bodyMd" fontWeight="bold" as="h3">
                {product.title}
              </Text>
              <div>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD'
                }).format(product.variants?.[0]?.nodes?.[0]?.priceV2?.amount || 0)}
              </div>
            </ResourceItem>
          </LegacyCard>
        ) : (
          <Text as="p" variant="bodyMd">
            No product selected
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
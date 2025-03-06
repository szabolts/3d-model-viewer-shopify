import { Card, BlockStack, Text } from '@shopify/polaris';
import ThreeJSViewer from './ThreeJsViewer';

interface ModelPreviewProps {
  modelUrl: string;
  settings: any;
}

export function ModelPreview({ modelUrl, settings }: ModelPreviewProps) {
  return (
    <Card>
      <BlockStack gap="500">
        <Text as="h2" variant="headingLg">
          3D Model Preview
        </Text>
        {modelUrl ? (
          <ThreeJSViewer 
            modelUrl={modelUrl} 
            settings={settings} 
          />
        ) : (
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              No model to preview
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}
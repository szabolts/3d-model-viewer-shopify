import { BlockStack, Card, Text } from '@shopify/polaris';
import { ModelDropZone } from './ModelDropZone';

interface ModelUploaderProps {
  formState: any;
  onFileUpload: (file: File) => void;
}

export function ModelUploader({ formState, onFileUpload }: ModelUploaderProps) {
  return (
    <Card>
      <BlockStack gap="500">
        <Text as="h2" variant="headingMd">
          {formState.id !== "new" ? "Update 3D Model" : "Upload 3D Model"}
        </Text>
        <ModelDropZone
          onFileUpload={(file) => onFileUpload(file)}
          currentModel={formState.id !== "new" ? {
            url: formState.modelUrl,
            filename: formState.modelFileName,
            fileSize: formState.filesize,
            preview: formState.preview,
          } : null}
        />
      </BlockStack>
    </Card>
  );
}
import { useState, useCallback } from 'react';
import { BlockStack, DropZone, Text, InlineStack, Thumbnail, Button, Card } from '@shopify/polaris';
import { SandboxIcon, SaveIcon } from '@shopify/polaris-icons';

interface ModelDropZoneProps {
  onFileUpload: (file: File) => void;
  currentModel: {
    url: string;
    filename: string;
    fileSize?: number;
    preview: string;
  } | null;
}

export function ModelDropZone({ onFileUpload, currentModel }: ModelDropZoneProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dropError, setDropError] = useState(false);

  const handleDrop = useCallback(
    (_droppedFiles: File[], acceptedFiles: File[], rejectedFiles: File[]) => {
      console.log('Drop event:', {
        accepted: acceptedFiles.map(f => f.name),
        rejected: rejectedFiles.map(f => f.name)
      });

      setDropError(rejectedFiles.length > 0);
      
      if (acceptedFiles.length > 0) {
        setFiles(acceptedFiles);
        onFileUpload(acceptedFiles[0]);
      }
    },
    [onFileUpload]
  );

  const fileUpload = !files.length && (
    <DropZone.FileUpload actionHint="Accepts .glb files up to 500MB" />
  );

  const uploadedFiles = files.length > 0 && (
    <BlockStack gap="300">
      {files.map((file, index) => (
        <InlineStack key={index} align="space-between" blockAlign="center">
          <Text variant="bodyMd" as="span">
            {file.name}
          </Text>
          <Text variant="bodyMd" as="span">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </Text>
        </InlineStack>
      ))}
    </BlockStack>
  );

  const handleDownload = async () => {
    if (!currentModel?.url) return;
  
    try {
      // Create download link
      const a = document.createElement('a');
      a.href = currentModel.url;
      a.download = currentModel.filename || 'model.glb';
      document.body.appendChild(a);
      
      // Trigger download dialog
      a.click();
      
      // Cleanup
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <BlockStack gap="400">
      {currentModel && (
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="400" align="space-between" blockAlign="center">
              <InlineStack gap="400" blockAlign="center">
                <Thumbnail
                  source={currentModel.preview || SandboxIcon}
                  size="small"
                  alt={currentModel.filename}
                />
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    {currentModel.filename || 'Current Model'}
                  </Text>
                  <Text as="span" variant="bodyMd">
                    Size: {currentModel.fileSize ? (currentModel.fileSize / 1024 / 1024).toFixed(2) : 0} MB
                  </Text>
                </BlockStack>
              </InlineStack>
              <Button
                accessibilityLabel="Download model"
                onClick={handleDownload}
                icon={SaveIcon}
              >
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      )}
      <DropZone
        accept="model/gltf-binary,.glb"
        type="file"
        onDrop={handleDrop}
        allowMultiple={false}
        errorOverlayText="File type must be .glb"
        overlayText="Drop .glb file to upload"
      >
        {uploadedFiles}
        {fileUpload}
      </DropZone>
      {dropError && (
        <Text as="span" variant="bodyMd" tone="critical">
          Please upload a valid .glb file
        </Text>
      )}
    </BlockStack>
  );
}
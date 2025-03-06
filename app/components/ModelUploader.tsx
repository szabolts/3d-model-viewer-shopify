import { useState, useCallback, useRef } from 'react';
import { BlockStack, Card, Text, DropZone, InlineStack, Thumbnail, Button } from '@shopify/polaris';
import { SandboxIcon, SaveIcon } from '@shopify/polaris-icons';

interface ModelUploaderProps {
  onFileUpload: (file: File) => void;
  isSubmitting?: boolean;
  currentModel?: {
    url: string;
    filename: string;
    fileSize?: number;
    preview: string;
  } | null;
  isNewModel?: boolean;
  saveSettings?: (event?: React.FormEvent) => void;
  handleDiscard?: (event?: React.FormEvent) => void;
}



export function ModelUploader({ 
  onFileUpload,
  isSubmitting = false, 
  currentModel, 
  isNewModel = false,
  saveSettings,
  handleDiscard
}: ModelUploaderProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dropError, setDropError] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (_droppedFiles: File[], acceptedFiles: File[], rejectedFiles: File[]) => {
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

  // TODO: not opening save window
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

  // Edit model
  if (currentModel && !isNewModel) {
    return (
      <Card>
        <BlockStack gap="500">
          <Text as="h2" variant="headingMd">
            Current 3D Model
          </Text>
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
                Download
              </Button>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
    );
  }

  // New
  return (
    <Card>
      <form 
        data-save-bar 
        onSubmit={saveSettings}
        onReset={handleDiscard}
      >
        <input 
          type="hidden" 
          ref={hiddenInputRef}
          name="model-upload-timestamp"
          onChange={() => {}} 
        />
        <BlockStack gap="500">
          <Text as="h2" variant="headingMd">
            Upload 3D Model
          </Text>
          <BlockStack gap="400">
            <DropZone
              accept="model/gltf-binary,.glb"
              type="file"
              onDrop={handleDrop}
              allowMultiple={false}
              disabled={isSubmitting}
              errorOverlayText="File type must be .glb"
              overlayText={isSubmitting ? "Uploading..." : "Drop .glb file to upload"}
            >
              {uploadedFiles}
              {fileUpload}
            </DropZone>
            {dropError && (
              <Text as="span" variant="bodyMd" tone="critical">
                Please upload a valid .glb file
              </Text>
            )}
            {files.length > 0 && (
              <Text as="p" variant="bodySm" tone="subdued">
                Click "Save" to upload the model
              </Text>
            )}
          </BlockStack>
        </BlockStack>
      </form>
    </Card>
  );
}
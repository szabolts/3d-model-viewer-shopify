import { useState, useCallback, useEffect } from "react";
import { json, redirect } from "@remix-run/react";
import {
  useParams,
  useLoaderData,
  useNavigation,
  useNavigate,
  useSubmit,
  useLocation
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Layout,
  Page,
  BlockStack,
  Card,
  InlineStack,
  Button,
  Text
} from "@shopify/polaris";
import { ModelControls } from '../components/ModelControls';
import { ModelPreview } from '../components/ModelPreview';
import { ModelUploader } from '../components/ModelUploader';
import { defaultSettings } from '../utils/viewer';

async function waitForMediaReady(admin, mediaId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await admin.graphql(`
      query GetMediaStatus($mediaId: ID!) {
        node(id: $mediaId) {
          ... on Media {
            status
            ... on Model3d {
              mediaErrors {
                code
                details
                message
              }
            }
          }
        }
      }
    `, {
      variables: {
        mediaId: mediaId
      }
    });

    const result = await response.json();
    const node = result.data?.node;
    const status = node?.status;
    const mediaErrors = node?.mediaErrors || [];

    console.log(`Media status check attempt ${i + 1}:`, status);
    
    if (mediaErrors.length > 0) {
      console.error("Media processing errors:", mediaErrors);
    }

    if (status === 'READY') {
      return true;
    } else if (status === 'FAILED') {
      throw new Error(
        mediaErrors.length > 0 
          ? `Media processing failed: ${mediaErrors.map(e => e.message).join(', ')}` 
          : 'Media processing failed'
      );
    }

    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for media to be ready');
}

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      id: "new",
      modelFile: null,
      modelFileName: "",
    });
  }

  const response = await admin.graphql(`
    query {
      files(first: 250) {
        nodes {
          ... on Model3d {
            id
            filename
            alt
            sources {
              filesize
              format
              url
            }
            preview {
              image {
                url
              }
            }
          }
        }
      }
    }
  `);

  const responseJson = await response.json();
  const models = responseJson.data?.files?.nodes || [];
  const model = models.find(m => m?.id === `gid://shopify/Model3d/${params.id}`);

  if (!model) {
    throw new Response("Model not found", { status: 404 });
  }

  const transformedModel = {
    ...model,
    sources: model.sources || [],
    filesize: model.sources?.[0]?.filesize || 0,
    url: model.sources?.find(source => source?.format === 'glb')?.url || '',
    preview: model.preview?.image?.url || '',
    alt: model.alt || ''
  };

  return json({
    id: params.id,
    modelFile: null,
    modelFileName: transformedModel.filename || '',
    modelUrl: transformedModel.url,
    preview: transformedModel.preview,
    alt: transformedModel.alt,
    filesize: transformedModel.filesize,
  });
}

export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const file = formData.get('modelFile');
    const filename = formData.get('filename') || file.name;
    const fileSize = formData.get('fileSize') || file.size.toString();

    if (!file || !(file instanceof File)) {
      return json({ success: false, error: 'No valid file provided' }, { status: 400 });
    }

    // 1. Generate staged upload URL
    const stagedResponse = await admin.graphql(`
      mutation generateStagedUploads($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: [{
          filename,
          mimeType: "model/gltf-binary",
          resource: "MODEL_3D",
          fileSize: fileSize
        }]
      }
    });

    const responseJson = await stagedResponse.json();
    const target = responseJson.data?.stagedUploadsCreate?.stagedTargets?.[0];

    if (!target) {
      return json({ success: false, error: "Failed to get upload URL" }, { status: 500 });
    }

    // 2. Upload the file
    const uploadFormData = new FormData();
    target.parameters.forEach(param => {
      uploadFormData.append(param.name, param.value);
    });
    uploadFormData.append('file', file);

    const uploadResponse = await fetch(target.url, {
      method: 'POST',
      body: uploadFormData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload error response:", errorText);
      return json({ 
        success: false, 
        error: `Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`
      }, { status: 500 });
    }

    // 3. Create file in Shopify
    const fileCreateResponse = await admin.graphql(`
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            alt
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        files: [{
          alt: filename,
          contentType: "MODEL_3D",
          originalSource: target.resourceUrl
        }]
      }
    });

    const fileCreateJson = await fileCreateResponse.json();
    
    if (fileCreateJson.data?.fileCreate?.userErrors?.length > 0) {
      return json({ 
        success: false,
        error: fileCreateJson.data.fileCreate.userErrors[0].message
      }, { status: 500 });
    }

    const fileId = fileCreateJson.data?.fileCreate?.files?.[0]?.id;
    
    // 4. Wait for media to be ready before redirecting
    try {
      await waitForMediaReady(admin, fileId);
      console.log("Media is ready!");
      
      const modelIdMatch = fileId.match(/\/Model3d\/(\d+)$/);
      const modelId = modelIdMatch ? modelIdMatch[1] : null;

      // Only redirect after media is confirmed ready
      if (modelId) {
        // Redirect to the model's edit page instead of the models list
        return redirect(`/app/models/${modelId}?success=true&message=Model uploaded successfully&t=${Date.now()}`);
      } else {
        // Fallback to models list if we can't parse the ID
        return redirect(`/app?success=true&message=Model uploaded successfully`);
      }
    } catch (error) {
      console.error("Error waiting for media ready:", error);
      
      // Check if the file was created at least, even if processing failed
      return json({ 
        success: false,
        fileId,
        error: error.message || "Model upload failed during processing",
        resourceUrl: target.resourceUrl,
        suggestion: "Try uploading a simpler model or check the model for errors."
      });
    }

  } catch (error) {
    console.error("Action error:", error);
    return json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export default function ModelForm() {
  const model = useLoaderData();
  const submit = useSubmit();
  const params = useParams();
  const [formState, setFormState] = useState(model);
  const [settings, setSettings] = useState(defaultSettings);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const location = useLocation();
  const nav = useNavigation();
  const navigate = useNavigate();

  // Show toast on successful upload
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const success = params.get('success');
    const message = params.get('message');
    
    if (success === 'true' && message) {
      shopify.toast.show(message);
      
      // Remove the query params after showing the toast
      const newUrl = location.pathname; 
      window.history.replaceState({}, '', newUrl);
    }
  }, [location]);

  // Reset component when id changes
  useEffect(() => {
    setFormState(model);
    setHasLoadedSettings(false);
    setSettings(defaultSettings);
    setIsLoading(true);
    setUploadFormData(null);
  }, [model, params.id]);

  // Load settings from DB
  useEffect(() => {
    if (formState.modelUrl && !hasLoadedSettings) {
      setIsLoading(true);
      fetch(`/app/models/settings?modelUrl=${encodeURIComponent(formState.modelUrl)}`)
        .then(response => response.json())
        .then(data => {
          if (data.settings) {
            setSettings(data.settings);
            setHasLoadedSettings(true);
          }
          setIsLoading(false);
        })
        .catch(error => {
          console.error("Error loading settings:", error);
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [formState.modelUrl, hasLoadedSettings]);

  const handleFileUpload = useCallback((file) => {
    setFormState(prev => ({
      ...prev,
      modelFile: file,
      modelFileName: file.name
    }));
    
    // Prepare data
    const data = new FormData();
    data.append('modelFile', file);
    data.append('filename', file.name);
    data.append('fileSize', file.size.toString());
    data.append('mimeType', 'model/gltf-binary');
    
    // Store the form data to be submitted later when save is clicked
    setUploadFormData(data);
    setHasUnsavedChanges(true);
  }, []);

  const [uploadFormData, setUploadFormData] = useState(null);

  const handleSettingChange = useCallback((category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSaveCameraPosition = useCallback((cameraData) => {
    setSettings(prev => ({
      ...prev,
      camera: {
        ...prev.camera,
        position: cameraData.position,
        target: cameraData.target
      }
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = useCallback(async (event) => {
    if (event) {
      event.preventDefault();
    }

    if (uploadFormData) {
      setIsLoading(true);
      
      submit(uploadFormData, {
        method: 'post',
        encType: 'multipart/form-data'
      });
      
      // Clear the form data after submission
      setUploadFormData(null);
      return;
    }
    
    if (hasUnsavedChanges && formState.modelUrl) {
      try {
        const response = await fetch('/app/models/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            modelUrl: formState.modelUrl,
            settings
          }),
        });

        const data = await response.json();
        if (data.success) {
          shopify.toast.show('Settings saved successfully');
          setHasUnsavedChanges(false);
        } else {
          shopify.toast.show(data.error || 'Failed to save settings', { isError: true });
        }
      } catch (error) {
        console.error("Error saving settings:", error);
        shopify.toast.show('Error saving settings', { isError: true });
      }
    }
  }, [formState.modelUrl, settings, hasUnsavedChanges, uploadFormData, submit]);

  const handleDiscard = useCallback(() => {
    if (hasUnsavedChanges) {
      setHasLoadedSettings(false);
      setHasUnsavedChanges(false);
      shopify.toast.show('Changes discarded');
    }
  }, [hasUnsavedChanges]);

  return (
    <Page>
      <ui-title-bar
        title={formState.id !== "new" ? "Edit 3D model" : "Add new 3D model"}
      >
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          Models
        </button>
      </ui-title-bar>

      <Layout>
        <Layout.Section>
          {isLoading ? (
            <Card>
              <BlockStack gap="500" align="center">
                <Text as="h2" variant="headingLg">
                  Loading model settings...
                </Text>
              </BlockStack>
            </Card>
          ) : (
            <ModelPreview
              modelUrl={formState.modelUrl}
              settings={settings}
            />
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            {formState.id !== "new" && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Model URL</Text>
                  <InlineStack gap="300" align="space-between">
                    <Text as="span" variant="bodyMd" fontWeight="medium" breakWord>
                      {formState.modelUrl}
                    </Text>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(formState.modelUrl);
                        shopify.toast.show('Model URL copied to clipboard');
                      }}
                      size="slim"
                    >
                      Copy URL
                    </Button>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued" truncate>
                    Use this URL in the 3D Model Viewer app block settings
                  </Text>
                </BlockStack>
              </Card>
            )}
            
            {formState.id !== "new" && (
              <ModelControls
                settings={settings}
                onSettingChange={handleSettingChange}
                onPositionChange={() => {}}
                onSaveCameraPosition={handleSaveCameraPosition}
                modelUrl={formState.modelUrl}
                hasUnsavedChanges={hasUnsavedChanges}
                setHasUnsavedChanges={setHasUnsavedChanges}
                saveSettings={handleSave}
                handleDiscard={handleDiscard}
              />
            )}
            
            {formState.id === "new" ? (
              <ModelUploader 
                onFileUpload={handleFileUpload}
                isNewModel={true}
                isSubmitting={nav.state === "submitting"}
                saveSettings={handleSave}
                handleDiscard={handleDiscard}
            />
            ) : (
              <ModelUploader 
                onFileUpload={handleFileUpload}
                isNewModel={false}
                currentModel={{
                  url: formState.modelUrl,
                  filename: formState.modelFileName,
                  fileSize: formState.filesize,
                  preview: formState.preview
                }}
              />
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
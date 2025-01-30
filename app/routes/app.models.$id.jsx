import { useState, useCallback } from "react";
import { json, redirect } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  Button,
  InlineStack,
  Layout,
  Page,
  Text,
  Thumbnail,
  BlockStack,
  PageActions,
  DropZone,
  LegacyStack,
  Box
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import ThreeJSViewer from "../components/threejs-viewer";

async function waitForMediaReady(admin, mediaId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await admin.graphql(`
      query GetMediaStatus($mediaId: ID!) {
        node(id: $mediaId) {
          ... on Media {
            status
          }
        }
      }
    `, {
      variables: {
        mediaId: mediaId 
      }
    });

    const result = await response.json();
    const status = result.data?.node?.status;

    console.log(`Media status check attempt ${i + 1}:`, status);

    if (status === 'READY') {
      return true;
    } else if (status === 'FAILED') {
      throw new Error('Media processing failed');
    }

    // Wait 2 seconds before next check
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Timeout waiting for media to be ready');
}

async function attachModelToProduct(admin, productId, resourceUrl) {
  const response = await admin.graphql(`
    mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
      productCreateMedia(media: $media, productId: $productId) {
        media {
          ... on Model3d {
            id
            mediaContentType
            status
            preview {
              image {
                url
              }
            }
            sources {
              format
              url
              mimeType
            }
          }
        }
        mediaUserErrors {
          code
          field
          message
        }
        product {
          id
        }
      }
    }
  `, {
    variables: {
      productId: productId,
      media: [{
        mediaContentType: "MODEL_3D",
        originalSource: resourceUrl,
        alt: "3D Model"
      }]
    }
  });

  const json = await response.json();
  console.log('Product media creation response:', json);

  if (json.data?.productCreateMedia?.mediaUserErrors?.length > 0) {
    throw new Error(json.data.productCreateMedia.mediaUserErrors[0].message);
  }

  return json.data.productCreateMedia;
}

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      id: "new",
      title: "",
      productId: "",
      productVariantId: "",
      productTitle: "",
      productHandle: "",
      productAlt: "",
      productImage: "",
      modelFile: null,
      modelFileName: "",
      media: { nodes: [] }
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
      products(first: 100) {
        nodes {
          id
          title
          handle
          variants(first: 1) {
            nodes {
              id
            }
          }
          images(first: 1) {
            nodes {
              url
              altText
            }
          }
          media(first: 10) {
            nodes {
              ... on Model3d {
                id
                sources {
                  filesize
                  format
                  url
                }
              }
            }
          }
        }
      }
    }
  `);

  const responseJson = await response.json();
  const models = responseJson.data?.files?.nodes || [];
  const products = responseJson.data?.products?.nodes || [];

  
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
    products: products.filter(product => 
      product.media.nodes.some(media => media.id === model.id)
    ).map(product => ({
      id: product.id,
      title: product.title,
      mediaIds: product.media.nodes
        .filter(media => media.id === model.id)
        .map(media => media.id)
    }))
  });
}

export async function action({ request }) {
  try {
    const { admin } = await authenticate.admin(request);
    const formData = await request.formData();
    
    const modelId = formData.get("modelId");
    const products = JSON.parse(formData.get('products') || '[]');
    const file = formData.get('modelFile');
    
    console.log('Action started:', {
      modelId,
      productsCount: products.length,
      hasFile: !!file,
      fileName: file?.name
    });

    if (!file || !(file instanceof File)) {
      throw new Error('No valid file provided');
    }

    // Generate staged upload URL
    const stagedResponse = await admin.graphql(`
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
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
          filename: file.name,
          mimeType: "model/gltf-binary",
          resource: "MODEL_3D",
          fileSize: `${file.size}`
        }]
      }
    });

    const uploadData = await stagedResponse.json();
    const target = uploadData.data?.stagedUploadsCreate?.stagedTargets?.[0];

    if (!target) {
      throw new Error("Failed to get upload URL");
    }

    // Upload file
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
      throw new Error("Failed to upload file");
    }

    // Create media for each product
    console.log('Creating media for products:', products.length);

    for (const product of products) {
      console.log('Processing product:', product.id);
      
      const response = await admin.graphql(`
        mutation productCreateMedia($media: [CreateMediaInput!]!, $productId: ID!) {
          productCreateMedia(media: $media, productId: $productId) {
            media {
              ... on Model3d {
                id
                status
                sources {
                  format
                  mimeType
                  url
                  filesize
                }
              }
              mediaErrors {
                code
                details
                message
              }
            }
            mediaUserErrors {
              code
              field
              message
            }
          }
        }
      `, {
        variables: {
          productId: product.id,
          media: [{
            mediaContentType: "MODEL_3D",
            originalSource: target.resourceUrl,
            alt: formData.get("alt") || "3D Model"
          }]
        }
      });
    
      const result = await response.json();
      
      if (result.data?.productCreateMedia?.mediaUserErrors?.length > 0) {
        throw new Error(result.data.productCreateMedia.mediaUserErrors[0].message);
      }
    
      const mediaId = result.data?.productCreateMedia?.media?.[0]?.id;
      if (!mediaId) {
        throw new Error('Failed to get media ID');
      }
    
      console.log('Waiting for media to be processed...');
      await waitForMediaReady(admin, mediaId);
      console.log('Media processing complete');
    }
    
    return redirect("/app");
  } catch (error) {
    console.error("Action error:", error);
    return json({ errors: { model: error.message } }, { status: 500 });
  }
}

const ModelDropZone = ({ onFileUpload, currentModel }) => {
  const [files, setFiles] = useState([]);
  const [dropError, setDropError] = useState(false);

  const handleDrop = useCallback(
    (_droppedFiles, acceptedFiles, rejectedFiles) => {
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

  return (
    <BlockStack gap="400">
      {currentModel && (
        <Box padding="400" background="bg-surface-secondary" borderRadius="200">
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">Current Model</Text>
            <Text as="span" variant="bodyMd">URL: {currentModel.url}</Text>
            {currentModel.filename && (
              <Text as="span" variant="bodyMd">Filename: {currentModel.filename}</Text>
            )}
          </BlockStack>
        </Box>
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
};

export default function ProductForm() {
  const product = useLoaderData();
  const [formState, setFormState] = useState(product);
  const [cleanFormState, setCleanFormState] = useState(product);
  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);

  const nav = useNavigation();
  const isSaving = nav.state === "submitting";
  const navigate = useNavigate();
  const submit = useSubmit();

  async function selectProduct() {
    const products = await window.shopify.resourcePicker({
      type: 'product',
      multiple: true,
      selectionIds: formState.products?.map(product => ({
        id: product.id
      })) || []
    });
  
    if (products) {
      setFormState({
        ...formState,
        products: products.map(product => ({
          id: product.id,
          title: product.title
        }))
      });
    }
  }

  function handleSave() {
    const data = new FormData();
    console.log('Saving form with state:', formState);
    
    if (formState.id === "new") {
      // New model case - require file upload
      if (formState.modelFile) {
        data.append("modelFile", formState.modelFile);
        console.log('Added new model file:', formState.modelFile.name);
      }
    } else {
      // Existing model case - pass URL
      const modelUrl = formState.media?.nodes?.[0]?.sources?.find(s => s.format === 'glb')?.url;
      if (modelUrl) {
        data.append("modelUrl", modelUrl);
        console.log('Added existing model URL:', modelUrl);
      }
      
      // Allow overriding with new file if provided
      if (formState.modelFile) {
        data.append("modelFile", formState.modelFile);
        console.log('Added new model file:', formState.modelFile.name);
      }
    }
    
    if (formState.products?.length) {
      data.append("products", JSON.stringify(formState.products));
      console.log('Added products:', formState.products);
    }
  
    data.append("modelId", formState.id);
    data.append("alt", formState.alt || "");
    
    setCleanFormState({ ...formState });
    submit(data, { method: "post", encType: "multipart/form-data" });
  }

  const model3d = product.media?.nodes?.find(media => 
    media.mediaContentType === 'MODEL_3D'
  );
  const glbSource = model3d?.sources?.find(source => 
    source.format === 'glb'
  );
  const modelUrl = formState.id === "new" 
  ? formState.modelUrl 
  : glbSource?.url;    


  return (
    <Page>
    <ui-title-bar title={formState.id !== "new" ? "Edit 3D model" : "Add new 3D model"}>
      <button variant="breadcrumb" onClick={() => navigate("/app")}>
        Models
      </button>
    </ui-title-bar>
    <Layout>
    <Layout.Section>
        <Card>
          <BlockStack gap="500">
            <Text as="h2" variant="headingLg">
              3D Model Preview
            </Text>
            {(modelUrl || formState.modelUrl) ? (
              <ThreeJSViewer modelUrl={modelUrl || formState.modelUrl} />
            ) : (
              <BlockStack gap="200" alignment="center">
                <Text as="p" variant="bodyMd" color="subdued">
                  No model to preview
                </Text>
                {formState.id === "new" && (
                  <Text as="p" variant="bodyMd" color="subdued">
                    Upload a model to see the preview
                  </Text>
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Layout.Section>
      <Layout.Section variant="oneThird">
        <BlockStack gap="500">
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingLg">
                  Products
                </Text>
                <Button variant="plain" onClick={selectProduct}>
                  {formState.products?.length ? 'Change products' : 'Select products'}
                </Button>
              </InlineStack>
              {formState.products?.length > 0 ? (
                <BlockStack gap="200">
                  {formState.products.map(product => (
                    <Text key={product.id} as="span" variant="bodyMd">
                      {product.title}
                    </Text>
                  ))}
                </BlockStack>
              ) : (
                <Text as="p" variant="bodyMd" color="subdued">
                  No products selected
                </Text>
              )}
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="500">
              <Text as="h2" variant="headingLg">
                {formState.id !== "new" ? "Update 3D Model" : "Upload 3D Model"}
              </Text>
              <ModelDropZone 
                onFileUpload={(file) => {
                  setFormState({
                    ...formState,
                    modelFile: file,
                    modelFileName: file.name
                  });
                }}
                currentModel={formState.id !== "new" ? {
                  url: formState.modelUrl,
                  filename: formState.modelFileName
                } : null}
              />
            </BlockStack>
          </Card>
        </BlockStack>
      </Layout.Section>
      <Layout.Section>
        <PageActions
          primaryAction={{
            content: "Save",
            loading: isSaving,
            disabled: !isDirty || isSaving,
            onAction: handleSave,
          }}
        />
      </Layout.Section>
    </Layout>
  </Page>
  );
}
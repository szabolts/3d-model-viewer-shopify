import { useState, useCallback, useEffect } from "react";
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
  Layout,
  Page,
  BlockStack,
  PageActions
} from "@shopify/polaris";
import { ModelControls } from '../components/ModelControls';
import { ModelPreview } from '../components/ModelPreview';
import { ProductSelector } from '../components/ProductSelector';
import { ModelUploader } from '../components/ModelUploader';
import { defaultSettings, prepareFormData } from '../components/utils';

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

async function getCurrentProductsForModel(admin, modelId) {
  if (modelId === "new") return [];

  const response = await admin.graphql(`
    query getModelMediaConnections($id: ID!) {
      product(id: $id) {
        media(first: 50) {
          nodes {
            ... on Model3d {
              id
            }
          }
        }
      }
    }
  `, {
    variables: {
      id: `gid://shopify/Model3d/${modelId}`
    }
  });

  const json = await response.json();
  return json.data?.product?.media?.nodes?.map(node => node.id) || [];
}

async function uploadNewModel(admin, file) {
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
        filename: file.name,
        mimeType: "model/gltf-binary",
        resource: "MODEL_3D",
        fileSize: file.size.toString()
      }]
    }
  });

  const uploadData = await stagedResponse.json();
  const target = uploadData.data?.stagedUploadsCreate?.stagedTargets?.[0];

  if (!target) {
    throw new Error("Failed to get upload URL");
  }

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

  return target.resourceUrl;
}

async function attachModelToProduct(admin, productId, resourceUrl) {
  console.log('Attaching model to product:', { productId, resourceUrl });

  const response = await admin.graphql(`
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          ... on Model3d {
            id
            status
            sources {
              format
              url
            }
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
      productId: productId,
      media: [{
        originalSource: resourceUrl,
        mediaContentType: "MODEL_3D",
        alt: "3D Model"
      }]
    }
  });

  const json = await response.json();
  console.log('Product media creation response:', json);

  if (json.data?.productCreateMedia?.mediaUserErrors?.length > 0) {
    const error = json.data.productCreateMedia.mediaUserErrors[0];
    throw new Error(`Media creation error: ${error.message} (${error.code})`);
  }

  return json.data?.productCreateMedia?.media?.[0];
}

async function removeModelFromProduct(admin, productId, modelId) {
  console.log('Removing model from product:', { productId, modelId });

  const response = await admin.graphql(`
    mutation productDeleteMedia($input: ProductDeleteMediaInput!) {
      productDeleteMedia(input: $input) {
        deletedMediaIds
        mediaUserErrors {
          code
          field
          message
        }
      }
    }
  `, {
    variables: {
      input: {
        mediaIds: [`gid://shopify/Model3d/${modelId}`],
        productId: productId
      }
    }
  });

  const json = await response.json();
  console.log('Product media deletion response:', json);

  if (json.data?.productDeleteMedia?.mediaUserErrors?.length > 0) {
    const error = json.data.productDeleteMedia.mediaUserErrors[0];
    throw new Error(`Media deletion error: ${error.message} (${error.code})`);
  }

  return json.data?.productDeleteMedia?.deletedMediaIds;
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
              price
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
    const product = JSON.parse(formData.get('product') || '{}');
    const file = formData.get('modelFile');

    if (!product.id) {
      throw new Error('No product selected');
    }

    if (modelId === "new") {
      if (!file || !(file instanceof File)) {
        throw new Error('No valid file provided for new model');
      }

      const resourceUrl = await uploadNewModel(admin, file);
      await attachModelToProduct(admin, product.id, resourceUrl);
    } else {
      const modelUrl = await getModelUrl(admin, modelId);
      await attachModelToProduct(admin, product.id, modelUrl);
    }

    return redirect("/app");
  } catch (error) {
    console.error("Action error:", error);
    return json({ errors: { model: error.message } }, { status: 500 });
  }
}

async function getModelUrl(admin, modelId) {
  const response = await admin.graphql(`
    query getModel($id: ID!) {
      node(id: $id) {
        ... on Model3d {
          sources {
            url
            format
          }
        }
      }
    }
  `, {
    variables: {
      id: `gid://shopify/Model3d/${modelId}`
    }
  });

  const json = await response.json();
  const glbSource = json.data?.node?.sources?.find(s => s.format === 'glb');

  if (!glbSource?.url) {
    throw new Error('Could not find GLB source URL for model');
  }

  return glbSource.url;
}

export default function ProductForm() {
  const product = useLoaderData();
  const [formState, setFormState] = useState(product);
  const [cleanFormState, setCleanFormState] = useState(product);
  const [settings, setSettings] = useState(defaultSettings);

  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);
  const nav = useNavigation();
  const navigate = useNavigate();
  const submit = useSubmit();

  const handleSelectProduct = async () => {
    const products = await window.shopify.resourcePicker({
      type: 'product',
      multiple: false, // Only allow selecting one product
      selectionIds: formState.product ? [{ id: formState.product.id }] : []
    });

    if (products) {
      setFormState({
        ...formState,
        product: {
          id: products[0].id,
          title: products[0].title
        }
      });
    }
  };

  const handleFileUpload = (file) => {
    setFormState({
      ...formState,
      modelFile: file,
      modelFileName: file.name
    });
  };

  const handleSettingChange = (category, setting, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleSaveCameraPosition = (cameraData) => {
    setSettings(prev => ({
      ...prev,
      camera: {
        ...prev.camera,
        position: cameraData.position,
        target: cameraData.target
      }
    }));
  };

  const handleSave = useCallback(() => {
    const data = prepareFormData(formState);
    setCleanFormState({ ...formState });
    submit(data, { method: "post", encType: "multipart/form-data" });
  }, [formState, submit]);

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
          <ModelPreview
            modelUrl={formState.modelUrl}
            settings={settings}
          />
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="500">
            <ProductSelector
              product={formState.product}
              onSelectProduct={handleSelectProduct}
            />
            <ModelControls
              settings={settings}
              onSettingChange={handleSettingChange}
              onPositionChange={() => { }}
              onSaveCameraPosition={handleSaveCameraPosition}
            />
            <ModelUploader
              formState={formState}
              onFileUpload={handleFileUpload}
            />
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Save",
              loading: nav.state === "submitting",
              disabled: !isDirty || nav.state === "submitting",
              onAction: handleSave,
            }}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
export function prepareFormData(formState) {
  const data = new FormData();

  if (formState.id === "new") {
    if (formState.modelFile) {
      data.append("modelFile", formState.modelFile);
    }
  } else {
    const modelUrl = formState.media?.nodes?.[0]?.sources?.find(s => s.format === 'glb')?.url;
    if (modelUrl) {
      data.append("modelUrl", modelUrl);
    }
    if (formState.modelFile) {
      data.append("modelFile", formState.modelFile);
    }
  }

  if (formState.product) {
    data.append("product", JSON.stringify(formState.product));
  }

  data.append("modelId", formState.id);
  data.append("alt", formState.alt || "");

  return data;
}

export const defaultSettings = {
  camera: {
    fov: 75,
    position: [3, 3, 3]
  },
  material: {
    clearcoatRoughness: 0,
    metalness: 1,
    roughness: 0
  },
  lighting: {
    ambientLight: false,
    intensity: 1
  }
};
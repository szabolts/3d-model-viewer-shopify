import React, { useRef, useEffect } from 'react';

interface WebGLViewerProps {
  modelUrl: string;
  cameraSettings?: {
    fov?: number;
    position?: [number, number, number];
  };
  materialSettings?: {
    clearcoatRoughness?: number;
    metalness?: number;
    roughness?: number;
  };
  lightingSettings?: {
    ambientLight?: boolean;
    intensity?: number;
  };
}

export default function WebGLiframe({ 
  modelUrl, 
  cameraSettings = {},
  materialSettings = {},
  lightingSettings = {}
}: WebGLViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initial URL params
  const params = new URLSearchParams({
    model: modelUrl,
    envMap: '/images/sunflowers_puresky_8k.hdr',
    ...cameraSettings.position && {
      cameraX: cameraSettings.position[0].toString(),
      cameraY: cameraSettings.position[1].toString(),
      cameraZ: cameraSettings.position[2].toString()
    },
    ...cameraSettings.fov && { fov: cameraSettings.fov.toString() },
    ...lightingSettings.ambientLight !== undefined && { 
      ambientLight: lightingSettings.ambientLight.toString(),
      lightIntensity: lightingSettings.intensity?.toString() || '1'
    }
  });

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // Send material settings
    iframe.contentWindow.postMessage({
      type: 'material',
      value: materialSettings
    }, '*');

    // Send lighting settings  
    iframe.contentWindow.postMessage({
      type: 'lighting',
      value: lightingSettings
    }, '*');

  }, [materialSettings, lightingSettings]);

  return (
    <iframe
      ref={iframeRef}
      src={`/iframe/webgl.html?${params.toString()}`}
      style={{
        width: '100%',
        height: '540px',
        border: 'none',
        borderRadius: '10px'
      }}
      title="WebGL 3D Viewer"
    />
  );
}
import React, { useRef, useEffect } from 'react';

interface WebGPUViewerProps {
  modelUrl: string;
  cameraSettings?: {
    fov?: number;
    position?: [number, number, number];
    target?: [number, number, number];
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
  onCameraPositionSave?: (position: [number, number, number]) => void;
}



export default function WebGPUiframe({
  modelUrl,
  cameraSettings = {},
  materialSettings = {},
  lightingSettings = {},
  onCameraPositionSave
}: WebGPUViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initial URL params for first load
  const params = new URLSearchParams({
    model: modelUrl,
    envMap: '/images/sunflowers_puresky_8k.hdr'
  });


  // Add message listener for camera position updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'camera' && event.data.action === 'positionUpdate') {
        onCameraPositionSave?.(event.data.position as [number, number, number]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCameraPositionSave]);


  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    // Send initial camera settings once the iframe is loaded
    iframe.addEventListener('load', () => {
      iframe.contentWindow?.postMessage({
        type: 'cameraPosition',
        value: {
          position: cameraSettings.position || [3, 3, 3],
          target: cameraSettings.target || [0, 0, 0]
        }
      }, '*');
    });
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    if (cameraSettings.fov) {
      iframe.contentWindow.postMessage({
        type: 'cameraFov',
        value: cameraSettings.fov
      }, '*');
    }

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

  }, [cameraSettings, materialSettings, lightingSettings]);


  return (
    <iframe
      ref={iframeRef}
      src={`/iframe/index.html?${params.toString()}`}
      style={{
        width: '100%',
        height: '540px',
        border: 'none',
        borderRadius: '10px'
      }}
      title="WebGPU 3D Viewer"
    />
  );
}
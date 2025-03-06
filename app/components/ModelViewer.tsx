import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ModelSettings, ViewerMessage, defaultSettings } from '../types/viewer';

interface ModelViewerProps {
  modelUrl: string;
  rendererType: 'webgpu' | 'webgl';
  cameraSettings?: ModelSettings['camera'];
  materialSettings?: ModelSettings['material'];
  lightingSettings?: ModelSettings['lighting'];
  envMapPath?: string;
  onCameraPositionSave?: (position: [number, number, number], target: [number, number, number]) => void;
}

export default function ModelViewer({
  modelUrl,
  rendererType,
  cameraSettings = defaultSettings.camera,
  materialSettings = defaultSettings.material,
  lightingSettings = defaultSettings.lighting,
  envMapPath = '/images/sunflowers_puresky_2k.hdr',
  onCameraPositionSave
}: ModelViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  
  // URL parameters for initial iframe load
  const mountParamsRef = useRef<URLSearchParams | null>(null);
  if (!mountParamsRef.current) {
    mountParamsRef.current = new URLSearchParams({
      model: modelUrl,
      envMap: envMapPath,
      fov: `${cameraSettings.fov}`,
      cameraX: `${cameraSettings.position[0]}`,
      cameraY: `${cameraSettings.position[1]}`,
      cameraZ: `${cameraSettings.position[2]}`,
      targetX: `${cameraSettings.target?.[0] || 0}`,
      targetY: `${cameraSettings.target?.[1] || 0}`,
      targetZ: `${cameraSettings.target?.[2] || 0}`,
      clearcoatRoughness: `${materialSettings.clearcoatRoughness}`,
      metalness: `${materialSettings.metalness}`,
      roughness: `${materialSettings.roughness}`,
      ambientLight: `${lightingSettings.ambientLight}`,
      lightIntensity: `${lightingSettings.intensity}`
    });
  }
  
  // Safe message sending helper
  const sendIframeMessage = useCallback((type: string, value: any) => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage({ type, value }, '*');
    } catch (error) {
      console.error('Error sending message to iframe:', error);
    }
  }, []);

  // Add message listener for camera position updates
  useEffect(() => {
    const handleMessage = (event: MessageEvent<ViewerMessage>) => {
      if (event.data.type === 'camera' && event.data.action === 'positionSaved') {
        const position = event.data.data?.position as [number, number, number];
        const target = event.data.data?.target as [number, number, number];
        
        if (onCameraPositionSave && position && target) {
          onCameraPositionSave(position, target);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onCameraPositionSave]);

  // Handle iframe load
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    const handleLoad = () => {
      setIsIframeLoaded(true);
    };
    
    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  // Send settings changes to iframe - with debounce protection via useRef
  const prevSettings = useRef({
    cameraFov: cameraSettings.fov,
    cameraPositionX: cameraSettings.position?.[0],
    cameraPositionY: cameraSettings.position?.[1], 
    cameraPositionZ: cameraSettings.position?.[2],
    cameraTargetX: cameraSettings.target?.[0],
    cameraTargetY: cameraSettings.target?.[1],
    cameraTargetZ: cameraSettings.target?.[2],
    materialClearcoatRoughness: materialSettings.clearcoatRoughness,
    materialMetalness: materialSettings.metalness,
    materialRoughness: materialSettings.roughness,
    lightingAmbient: lightingSettings.ambientLight,
    lightingIntensity: lightingSettings.intensity,
    envMapPath: envMapPath
  });

  // Effect for syncing settings changes with iframe
  useEffect(() => {
    if (!isIframeLoaded) return;

    // Camera position changed
    if (
      cameraSettings.position && 
      (
        cameraSettings.position[0] !== prevSettings.current.cameraPositionX ||
        cameraSettings.position[1] !== prevSettings.current.cameraPositionY ||
        cameraSettings.position[2] !== prevSettings.current.cameraPositionZ ||
        cameraSettings.target?.[0] !== prevSettings.current.cameraTargetX ||
        cameraSettings.target?.[1] !== prevSettings.current.cameraTargetY ||
        cameraSettings.target?.[2] !== prevSettings.current.cameraTargetZ
      )
    ) {
      sendIframeMessage('cameraPosition', {
        position: cameraSettings.position,
        target: cameraSettings.target
      });
      
      // Update previous values
      prevSettings.current.cameraPositionX = cameraSettings.position[0];
      prevSettings.current.cameraPositionY = cameraSettings.position[1];
      prevSettings.current.cameraPositionZ = cameraSettings.position[2];
      
      if (cameraSettings.target) {
        prevSettings.current.cameraTargetX = cameraSettings.target[0];
        prevSettings.current.cameraTargetY = cameraSettings.target[1];
        prevSettings.current.cameraTargetZ = cameraSettings.target[2];
      }
    }
    
    // FOV changed
    if (cameraSettings.fov && cameraSettings.fov !== prevSettings.current.cameraFov) {
      sendIframeMessage('cameraFov', cameraSettings.fov);
      prevSettings.current.cameraFov = cameraSettings.fov;
    }
    
    // Material settings changed
    if (
      materialSettings.clearcoatRoughness !== prevSettings.current.materialClearcoatRoughness ||
      materialSettings.metalness !== prevSettings.current.materialMetalness ||
      materialSettings.roughness !== prevSettings.current.materialRoughness
    ) {
      sendIframeMessage('material', materialSettings);
      prevSettings.current.materialClearcoatRoughness = materialSettings.clearcoatRoughness;
      prevSettings.current.materialMetalness = materialSettings.metalness;
      prevSettings.current.materialRoughness = materialSettings.roughness;
    }
    
    // Lighting settings changed
    if (
      lightingSettings.ambientLight !== prevSettings.current.lightingAmbient ||
      lightingSettings.intensity !== prevSettings.current.lightingIntensity
    ) {
      sendIframeMessage('lighting', lightingSettings);
      prevSettings.current.lightingAmbient = lightingSettings.ambientLight;
      prevSettings.current.lightingIntensity = lightingSettings.intensity;
    }
    
    // Environment map changed
    if (envMapPath !== prevSettings.current.envMapPath) {
      sendIframeMessage('envMap', envMapPath);
      prevSettings.current.envMapPath = envMapPath;
    }
    
  }, [
    isIframeLoaded,
    cameraSettings.position, 
    cameraSettings.target,
    cameraSettings.fov,
    materialSettings.clearcoatRoughness,
    materialSettings.metalness,
    materialSettings.roughness,
    lightingSettings.ambientLight,
    lightingSettings.intensity,
    envMapPath,
    sendIframeMessage
  ]);

  // Determine which iframe HTML file to use
  const iframeSrc = rendererType === 'webgpu' 
    ? `/iframe/index.html?${mountParamsRef.current?.toString()}`
    : `/iframe/webgl.html?${mountParamsRef.current?.toString()}`;

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      style={{
        width: '100%',
        height: '540px',
        border: 'none',
        borderRadius: '10px'
      }}
      title={`${rendererType.toUpperCase()} 3D Viewer`}
    />
  );
}
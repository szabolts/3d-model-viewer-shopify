import React, { useState, useEffect } from "react";
import { 
  Button, 
  Popover, 
  ActionList, 
  Text,
  InlineStack
} from '@shopify/polaris';
import '../styles/threejs-viewer.css';
import ModelViewer from './ModelViewer';
import { ModelSettings } from '../types/viewer';

interface ThreeJSViewerProps {
  modelUrl: string;
  settings: ModelSettings;
  onCameraPositionSave?: (position: [number, number, number], target: [number, number, number]) => void;
}

export default function ThreeJSViewer({ 
  modelUrl, 
  settings,
  onCameraPositionSave
}: ThreeJSViewerProps) {
  const [rendererType, setRendererType] = useState<'webgpu' | 'webgl'>('webgpu');
  const [isPopoverActive, setIsPopoverActive] = useState(false);
  const [isWebGPUAvailable, setIsWebGPUAvailable] = useState(true);

  const handleRendererChange = (newType: 'webgpu' | 'webgl') => {
    setRendererType(newType);  
  };

  useEffect(() => {
    // Listen for messages from the iframe about renderer type
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'renderer') {
        // Update renderer type based on what's actually being used
        setRendererType(event.data.rendererType);
        
        // Update WebGPU availability
        if (event.data.rendererType === 'webgl' && event.data.webgpuAvailable === false) {
          setIsWebGPUAvailable(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="canvas-container">
      <div className="controls-header">
        <InlineStack gap="300" align="center" blockAlign="center">
          <Popover
            active={isPopoverActive && isWebGPUAvailable}
            activator={
              <Button
                disclosure
                onClick={() => isWebGPUAvailable && setIsPopoverActive(!isPopoverActive)}
                tone={rendererType === 'webgpu' ? 'success' : 'critical'}
                disabled={!isWebGPUAvailable}
              >
                Renderer: {rendererType.toUpperCase()}
              </Button>
            }
            onClose={() => setIsPopoverActive(false)}
          >
            <ActionList
              items={[
                {
                  content: 'WebGPU',
                  active: rendererType === 'webgpu',
                  disabled: !isWebGPUAvailable,
                  onAction: () => {
                    handleRendererChange('webgpu');
                    setIsPopoverActive(false);
                  },
                },
                {
                  content: 'WebGL',
                  active: rendererType === 'webgl',
                  onAction: () => {
                    handleRendererChange('webgl');
                    setIsPopoverActive(false);
                  },
                },
              ]}
            />
          </Popover>
          
          {!isWebGPUAvailable && (
            <Text as="span" variant="bodySm" tone="subdued">
              WebGPU not available in this browser
            </Text>
          )}
        </InlineStack>
      </div>
      <div className="viewer-layout">
        <div className="canvas-wrapper">
          <ModelViewer
            modelUrl={modelUrl}
            rendererType={rendererType}
            cameraSettings={settings.camera}
            materialSettings={settings.material}
            lightingSettings={settings.lighting}
            envMapPath={settings.envMapPath}
            onCameraPositionSave={onCameraPositionSave}
          />
        </div>
      </div>
    </div>
  );
}
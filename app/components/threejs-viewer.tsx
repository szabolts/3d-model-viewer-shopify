import React, { useState } from "react";
import { 
  Button, 
  Popover, 
  ActionList, 
  Box, 
  RangeSlider, 
  Card,
  Text,
  Checkbox
} from '@shopify/polaris';
import './threejs-viewer.css';

import  WebGPUiframe from './WebGPUiframe';
import WebGLiframe from './WebGLiframe';

interface ThreeJSViewerProps {
  modelUrl: string;
  settings: {
    camera: {
      fov: number;
      position: [number, number, number];
    };
    material: {
      clearcoatRoughness: number;
      metalness: number;
      roughness: number;
    };
    lighting: {
      ambientLight: boolean;
      intensity: number;
    };
  };
}


export default function ThreeJSViewer({ modelUrl, settings }: ThreeJSViewerProps) {
  const [rendererType, setRendererType] = useState<'webgpu' | 'webgl' >('webgpu');
  const [isPopoverActive, setIsPopoverActive] = useState(false);

  const handleRendererChange = (newType: 'webgpu' | 'webgl' ) => {
    // setTimeout( ()=>{
      setRendererType(newType);
    // }, 1000);    
  };

  return (
    <div className="canvas-container">
      <div className="controls-header">
        <Popover
          active={isPopoverActive}
          activator={
            <Button
              disclosure
              onClick={() => setIsPopoverActive(!isPopoverActive)}
              tone="critical"
            >
              Renderer: {rendererType}
            </Button>
          }
          onClose={() => setIsPopoverActive(false)}
        >
          <ActionList
            items={[
              {
                content: 'WebGPU',
                active: rendererType === 'webgpu',
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
      </div>
      <div className="viewer-layout">
        <div className="canvas-wrapper">
          {rendererType === 'webgpu' ? (
            <WebGPUiframe 
              modelUrl={modelUrl} 
              cameraSettings={settings.camera}
              materialSettings={settings.material}
              lightingSettings={settings.lighting}
            />
          ) : (
            <WebGLiframe
              modelUrl={modelUrl}
              cameraSettings={settings.camera}
              materialSettings={settings.material} 
              lightingSettings={settings.lighting}
            />
          )}
        </div>
      </div>
  </div>
  );
}
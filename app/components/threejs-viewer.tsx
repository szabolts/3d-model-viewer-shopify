import React, { Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, OrbitControls, useGLTF, Stats, Bounds } from "@react-three/drei";
import { Button, Popover, ActionList } from '@shopify/polaris';
import * as THREE from 'three';
import { WebGPURenderer } from "three/webgpu";
import './threejs-viewer.css';

// WebGPU inicializáló komponens
function WebGPUInitializer() {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    let webGPURenderer: WebGPURenderer | null = null;
    let originalDOMElement: HTMLElement | null = null;
    let animationFrameId: number;

    const initWebGPU = async () => {
      if (!navigator.gpu) {
        console.error('WebGPU not supported');
        return;
      }
    
      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
        const device = await adapter?.requestDevice();
        
        if (device) {
          // New canvas for WebGPU
          const webgpuCanvas = document.createElement('canvas');
          webgpuCanvas.width = gl.domElement.width;
          webgpuCanvas.height = gl.domElement.height;
          
          const gpuContext = webgpuCanvas.getContext('webgpu');
          if (!gpuContext) {
            console.error('WebGPU context not available');
            return;
          }
          
          
          gpuContext.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: 'premultiplied'
          });
          
          // Initialize 
          webGPURenderer = new WebGPURenderer({ device, antialias: false });
          
          // Replace canvases
          originalDOMElement = gl.domElement;
          originalDOMElement.parentNode?.replaceChild(webGPURenderer.domElement, originalDOMElement);
          
          webGPURenderer.setSize(webgpuCanvas.width, webgpuCanvas.height);
          webGPURenderer.setPixelRatio(window.devicePixelRatio);
    
          const animate = () => {
            animationFrameId = requestAnimationFrame(animate);
            webGPURenderer?.renderAsync(scene, camera);
          };
          animate();
        }
      } catch (error) {
        console.error('WebGPU initialization failed:', error);
      }
    };
    
    initWebGPU();
    
    return () => {
      if (webGPURenderer && originalDOMElement) {
        cancelAnimationFrame(animationFrameId);
        webGPURenderer.dispose();
        originalDOMElement.parentNode?.replaceChild(
          originalDOMElement,
          webGPURenderer.domElement
        );
      }
    };
  }, [gl, scene, camera]);

  return null;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function ThreeJSViewer({ modelUrl }: { modelUrl: string }) {
  const [rendererType, setRendererType] = useState<'webgpu' | 'webgl'>('webgpu');
  const [isPopoverActive, setIsPopoverActive] = useState(false);

  return (
    <div className="canvas-container">
      <div>
        <Popover
          active={isPopoverActive}
          activator={
            <Button
              disclosure
              onClick={() => setIsPopoverActive(!isPopoverActive)}
              tone="critical"
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
                onAction: () => {
                  setRendererType('webgpu');
                  setIsPopoverActive(false);
                },
              },
              {
                content: 'WebGL',
                active: rendererType === 'webgl',
                onAction: () => {
                  setRendererType('webgl');
                  setIsPopoverActive(false);
                },
              },
            ]}
          />
        </Popover>
      </div>

      <Canvas 
        key={rendererType}
        camera={{ position: [3, 3, 3] }}
        gl={{ 
          powerPreference: 'high-performance',
          antialias: false,
          alpha: true,
          
         }}
      >
        {rendererType === 'webgpu' && <WebGPUInitializer />}
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} intensity={10} />
        <directionalLight position={[-5, 5, 5]} intensity={10} />
        
        <pointLight position={[0, 0, 0]} intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Bounds fit clip observe margin={1.2}>
          <Suspense fallback={null}>
            {modelUrl && <Model url={modelUrl} />}
          </Suspense>
        </Bounds>
        <CameraControls 
          truckSpeed={0}
          smoothTime={1}
          
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
      <Stats />
    </div>
  );
}
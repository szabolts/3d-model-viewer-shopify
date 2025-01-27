import React, { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls, OrbitControls, useGLTF, Stats, Bounds } from "@react-three/drei";
import * as THREE from 'three'
import { WebGPURenderer } from "three/webgpu";
import './threejs-viewer.css'

// WebGPU inicializáló komponens
function WebGPUInitializer() {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    async function initWebGPU() {
      if (!navigator.gpu) {
        console.error('WebGPU is not supported');
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter?.requestDevice();
        
        if (device) {
          const renderer = new WebGPURenderer();
          renderer.setSize(gl.domElement.width, gl.domElement.height);
          renderer.setPixelRatio(window.devicePixelRatio);
          
          // Eredeti renderer lecserélése
          gl.domElement.parentNode?.replaceChild(
            renderer.domElement,
            gl.domElement
          );
          console.log(renderer.info)
          
          // Animációs loop
          function animate() {
            requestAnimationFrame(animate);
            renderer.renderAsync(scene, camera);
          }
          animate();
        }
      } catch (error) {
        console.error('WebGPU initialization failed:', error);
      }
    }

    initWebGPU();
  }, [gl, scene, camera]);

  return null;
}

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

export default function ThreeJSViewer({ modelUrl }: { modelUrl: string }) {
  return (
    <div className="canvas-container">
      <Canvas style={{ height: "100%" }} camera={{ position: [3, 3, 3] }}>
        <WebGPUInitializer />
        <ambientLight intensity={1} />
        <directionalLight position={[5, 5, 5]} intensity={10} />
        <directionalLight position={[-5, 5, 5]} intensity={10} />
        <directionalLight position={[5, -5, 5]} intensity={2} />
        <directionalLight position={[5, 5, -5]} intensity={2} />
        <pointLight position={[0, 0, 0]} intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        <Bounds fit clip observe margin={1.2}>
        <Suspense fallback={null}>
          {modelUrl ? <Model url={modelUrl} /> : null}
        </Suspense>
        </Bounds>
        <CameraControls 
          truckSpeed={0}
          smoothTime={1}
          minDistance={3}
          maxDistance={6}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>
      <Stats />
    </div>
  );
}

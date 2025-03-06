export function generateViewerHTML(modelUrl: string): string {
    return `
      <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>WebGPU 3D Model Viewer</title>
        <script type="importmap">
        {
            "imports": {
              "three": "https://cdn.jsdelivr.net/npm/three@0.173/build/three.module.js",
              "three/webgpu": "https://cdn.jsdelivr.net/npm/three@0.173/build/three.webgpu.js",
              "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.173/examples/jsm/",
              "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.173/examples/jsm/",
              "three/tsl": "https://cdn.jsdelivr.net/npm/three@0.173/build/three.tsl.js",
              "stats-gl": "https://cdn.jsdelivr.net/npm/stats-gl@3.6.0/dist/main.js"
            }
        }
        </script>
        <style>
            body, html {
                margin: 0;
                height: 100%;
                overflow: hidden;
                background-color: transparent;
            }
            canvas {
                display: block;
                width: 100%;
                height: 100%;
            }
        </style>
    </head>
    <body>
        <script type="module">
            import * as THREE from 'three/webgpu';
            import * as THREEGL from 'three';
            import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
            import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
            import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

            let renderer, scene, camera, controls, currentModel;

            async function createRenderer() {
              if (navigator.gpu) {
                try {
                  const adapter = await navigator.gpu.requestAdapter();
                  if (adapter) {
                    const device = await adapter.requestDevice();
                    renderer = new THREE.WebGPURenderer({
                      antialias: true,
                      powerPreference: "high-performance"
                    });
                    await renderer.init();
                    console.log('Using WebGPU renderer');
                    return renderer;
                  }
                } catch (error) {
                  console.warn('WebGPU initialization failed:', error);
                }
              }
              
              console.log('Falling back to WebGL renderer');
              renderer = new THREEGL.WebGLRenderer({ 
                antialias: true,
                powerPreference: "high-performance",
                alpha: true
              });
              return renderer;
            }

            async function init() {
              const modelUrl = "${modelUrl}";
              
              scene = new THREE.Scene();
              camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
              camera.position.set(3, 3, 3);
              
              renderer = await createRenderer();
              renderer.toneMapping = THREE.ACESFilmicToneMapping;
              renderer.toneMappingExposure = 1;
              renderer.setSize(window.innerWidth, window.innerHeight);
              document.body.appendChild(renderer.domElement);
              
              controls = new OrbitControls(camera, renderer.domElement);
              
              // Load environment map from CDN
              new RGBELoader()
                .load('https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/textures/equirectangular/royal_esplanade_1k.hdr', (texture) => {
                  texture.mapping = THREE.EquirectangularReflectionMapping;
                  scene.background = texture;
                  scene.environment = texture;
                  
                  // Load model after environment map is ready
                  if (modelUrl) {
                    loadModel(modelUrl);
                  }
                });
              
              animate();
            }

            function loadModel(url) {
              const loader = new GLTFLoader();
              loader.load(
                url,
                function (gltf) {
                  if (currentModel) {
                    scene.remove(currentModel);
                  }

                  currentModel = gltf.scene;
                  
                  // Auto-size and center model
                  const box = new THREE.Box3().setFromObject(currentModel);
                  const size = box.getSize(new THREE.Vector3());
                  const center = box.getCenter(new THREE.Vector3());
                  
                  const maxSize = Math.max(size.x, size.y, size.z);
                  const scale = 2 / maxSize;
                  currentModel.scale.multiplyScalar(scale);
                  
                  currentModel.position.x = -center.x * scale;
                  currentModel.position.y = -center.y * scale;
                  currentModel.position.z = -center.z * scale;
                  
                  currentModel.traverse((child) => {
                    if (child.isMesh) {
                      // Set model material properties
                      child.material.metalness = 1;
                      child.material.roughness = 0;
                      child.material.clearcoatRoughness = 0;
                    }
                  });
                  
                  scene.add(currentModel);
                },
                function (error) {
                  console.error('An error happened loading the model', error);
                  const errorDiv = document.createElement('div');
                  errorDiv.style.color = 'white';
                  errorDiv.style.padding = '20px';
                  errorDiv.style.textAlign = 'center';
                  errorDiv.style.background = 'rgba(0,0,0,0.7)';
                  errorDiv.innerHTML = '<h3>Error loading 3D model</h3><p>' + error.message + '</p>';
                  document.body.appendChild(errorDiv);
                }
              );
            }

            async function animate() {
              requestAnimationFrame(animate);
              controls.update();
              
              if (renderer instanceof THREE.WebGPURenderer) {
                await renderer.renderAsync(scene, camera);
              } else {
                renderer.render(scene, camera);
              }
            }

            window.addEventListener('resize', () => {
              camera.aspect = window.innerWidth / window.innerHeight;
              camera.updateProjectionMatrix();
              renderer.setSize(window.innerWidth, window.innerHeight);
            });
            
            init().catch(console.error);
        </script>
    </body>
    </html>
    `;
  }
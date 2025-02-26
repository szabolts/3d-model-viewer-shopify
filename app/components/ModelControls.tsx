import {
  Card,
  BlockStack,
  Text,
  RangeSlider,
  Checkbox,
  Button,
  Box,
  Collapsible,
  Tabs
} from '@shopify/polaris';
import { ChevronDownIcon, ChevronUpIcon, TargetIcon } from '@shopify/polaris-icons';
import { useEffect, useCallback, useState } from 'react';

interface ModelSettings {
  camera: {
    fov: number;
    position: [number, number, number];
    target?: [number, number, number]; 
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
}

interface ModelControlsProps {
  settings: ModelSettings;
  onSettingChange: (category: string, setting: string, value: number | boolean) => void;
  onPositionChange: (axis: number, value: number) => void;
  onSaveCameraPosition?: (cameraData: {
    position: [number, number, number];
    target: [number, number, number];
  }) => void;
}

export function ModelControls({ settings, onSettingChange, onPositionChange, onSaveCameraPosition }: ModelControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  const handleTabChange = useCallback(
    (selectedTabIndex: number) => setSelectedTab(selectedTabIndex),
    [],
  );

  const tabs = [
    {
      id: 'camera-settings',
      content: 'Camera',
      accessibilityLabel: 'Camera settings',
      panelID: 'camera-settings-content',
    },
    {
      id: 'model-settings',
      content: 'Model',
      panelID: 'model-settings-content',
    },
    {
      id: 'lighting-settings',
      content: 'Lighting',
      panelID: 'lighting-settings-content',
    },
  ];

  const handleSavePosition = () => {
    // Send message to iframe
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'camera',
        action: 'savePosition'  // Changed from 'cameraPosition' to 'savePosition'
      }, '*');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'camera' && event.data.action === 'positionSaved') {
        const { position, target } = event.data.data;
        console.log('Saving camera position:', { position, target });
  
        // Convert position and target to proper tuple types
        const positionTuple = position as [number, number, number];
        const targetTuple = target as [number, number, number];
  
        if (onSaveCameraPosition) {
          onSaveCameraPosition({
            position: positionTuple,
            target: targetTuple
          });
        }
      }
    };
  
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSaveCameraPosition]);

  const renderCameraSettings = () => (
    <BlockStack gap="400">
      <RangeSlider
        label="Field of View"
        value={settings.camera.fov}
        suffix={
          <p style={{ minWidth: '24px', textAlign: 'right' }}>
            {settings.camera.fov}
          </p>
        }
        onChange={value => onSettingChange('camera', 'fov', value)}
        min={30}
        max={120}
        step={1}
      />
      <Box>
        <BlockStack gap="300">
          <Button
            onClick={handleSavePosition}
            icon={TargetIcon}
          >
            Save Current Camera Position
          </Button>
          <Text as="p" variant="bodyMd">
            Position - X: {settings.camera.position[0].toFixed(2)},
            Y: {settings.camera.position[1].toFixed(2)},
            Z: {settings.camera.position[2].toFixed(2)}
          </Text>
          {settings.camera.target && (
            <Text as="p" variant="bodyMd">
              Target - X: {settings.camera.target[0].toFixed(2)},
              Y: {settings.camera.target[1].toFixed(2)},
              Z: {settings.camera.target[2].toFixed(2)}
            </Text>
          )}
        </BlockStack>
      </Box>
    </BlockStack>
  );

  const renderModelSettings = () => (
    <BlockStack gap="400">
      <RangeSlider
        label="Clearcoat Roughness"
        value={settings.material.clearcoatRoughness}
        onChange={value => onSettingChange('material', 'clearcoatRoughness', value)}
        min={0}
        max={1}
        step={0.01}
      />
      <RangeSlider
        label="Metalness"
        value={settings.material.metalness}
        onChange={value => onSettingChange('material', 'metalness', value)}
        min={0}
        max={1}
        step={0.01}
      />
      <RangeSlider
        label="Roughness"
        value={settings.material.roughness}
        onChange={value => onSettingChange('material', 'roughness', value)}
        min={0}
        max={1}
        step={0.01}
      />
    </BlockStack>
  );

  const renderLightingSettings = () => (
    <BlockStack gap="400">
      <Checkbox
        label="Ambient Light"
        checked={settings.lighting.ambientLight}
        onChange={checked => onSettingChange('lighting', 'ambientLight', checked)}
      />
      <RangeSlider
        label="Light Intensity"
        value={settings.lighting.intensity}
        onChange={value => onSettingChange('lighting', 'intensity', value)}
        min={0}
        max={5}
        step={0.1}
        disabled={!settings.lighting.ambientLight}
      />
    </BlockStack>
  );

  return (
    <Card>
      <BlockStack gap="200">
        <Box>
          <Button
            onClick={() => setIsOpen(!isOpen)}
            icon={isOpen ? ChevronUpIcon : ChevronDownIcon}
            fullWidth
          >
            Settings
          </Button>
        </Box>

        <Collapsible
          open={isOpen}
          id="model-controls-collapsible"
        >
          
            <Tabs
              tabs={tabs}
              selected={selectedTab}
              onSelect={handleTabChange}
              fitted
            >
              <Box padding="400">
                {selectedTab === 0 && renderCameraSettings()}
                {selectedTab === 1 && renderModelSettings()}
                {selectedTab === 2 && renderLightingSettings()}
              </Box>
            </Tabs>
          
        </Collapsible>
      </BlockStack>
    </Card>
  );
}
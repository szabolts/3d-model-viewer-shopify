import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Thumbnail,
  Text,
  Button,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  IndexFiltersProps,
  TabProps,
  InlineStack
} from "@shopify/polaris";
import { ImageIcon } from '@shopify/polaris-icons';
import { useState, useCallback, useMemo, useEffect } from 'react';
import "../styles/index-table.css";

function ClientOnly({ children }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return children;
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    query {
      shop {
        name
      }
      files(first: 250) {
        nodes {
          ... on Model3d {
            id
            filename
            createdAt
            originalSource {
              filesize
              format
              url
            }
            sources {
              filesize
              format
              url
            }
            alt
            preview {
              image {
                url
              }
            }
          }
        }
      }
    }
  `);

  const json = await response.json();

  const models = json.data.files.nodes.filter(node => node && Object.keys(node).length > 0) || [];

  return {
    models,
    shop: json.data.shop
  };
}

const ModelTable = ({ models = [] }) => {
  return (
    <ClientOnly>
      <IndexTable
        resourceName={{
          singular: "3D Model",
          plural: "3D Models",
        }}
        itemCount={models?.length || 0}
        headings={[
          { title: " " },
          { title: "Model Name" },
          { title: "Date Added" },
          { title: "Size" },
          { title: "Actions" }
        ]}
        hasZebraStriping
        selectable={false}
      >
        {models?.map((model, index) => (
          <ModelTableRow key={model.id} model={model} index={index} />
        ))}
      </IndexTable>
    </ClientOnly>
  );
};

const ModelTableRow = ({ model, index }) => {
  const navigate = useNavigate();

  const sizeMB = model.originalSource?.filesize
    ? (model.originalSource.filesize / (1024 * 1024)).toFixed(2)
    : (model.sources?.[0]?.filesize / (1024 * 1024))?.toFixed(2) || '0.00';

  const dateAdded = new Date(model.createdAt).toLocaleDateString();
  const numericId = model.id.split('/').pop();
  const appUrl = `/app/models/${numericId}`;

  return (
    <IndexTable.Row id={model.id} position={index}>
      <IndexTable.Cell className="thumbnail-cell">
        <Thumbnail
          source={model.preview?.image?.url || ImageIcon}
          alt={model.alt || model.filename}
          size="small"
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="bold">
          {model.filename}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd">
          {dateAdded}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" alignment="start" numeric>
          {sizeMB} MB
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="300">
          <Button onClick={() => navigate(appUrl)} size="slim">
            Edit
          </Button>
          <Button
            onClick={() => {
              const modelUrl = model.sources?.find(s => s.format === 'glb')?.url;
              if (modelUrl) {
                navigator.clipboard.writeText(modelUrl);
                shopify.toast.show('Model URL copied to clipboard');
              }
            }}
            size="slim"
            variant="plain"
          >
            Copy URL
          </Button>
        </InlineStack>
      </IndexTable.Cell>
    </IndexTable.Row>
  );
};

export default function Index() {
  const { models } = useLoaderData();
  const navigate = useNavigate();
  const [sortSelected, setSortSelected] = useState(['filename asc']);
  const [queryValue, setQueryValue] = useState('');
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Default);
  const [selected, setSelected] = useState(0);

  const tabs: TabProps[] = [
    {
      content: 'All',
      id: 'all',
      isLocked: true,
    }
  ];

  const sortOptions: IndexFiltersProps['sortOptions'] = [
    { label: 'Model name', value: 'filename asc', directionLabel: 'A-Z' },
    { label: 'Model name', value: 'filename desc', directionLabel: 'Z-A' },
    { label: 'Date', value: 'date asc', directionLabel: 'Oldest' },
    { label: 'Date', value: 'date desc', directionLabel: 'Newest' },
    { label: 'Size', value: 'size asc', directionLabel: 'Smallest' },
    { label: 'Size', value: 'size desc', directionLabel: 'Largest' },
  ];

  const filters: IndexFiltersProps['filters'] = [];
  const appliedFilters: IndexFiltersProps['appliedFilters'] = [];

  const handleFiltersQueryChange = useCallback(
    (value: string) => setQueryValue(value),
    [],
  );

  const handleQueryClear = useCallback(() => setQueryValue(''), []);
  
  const handleFiltersClearAll = useCallback(() => {
    handleQueryClear();
  }, [handleQueryClear]);

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      if (!queryValue) return true;
      return model.filename.toLowerCase().includes(queryValue.toLowerCase());
    });
  }, [models, queryValue]);

  const sortedModels = useMemo(() => {
    const [field, direction] = sortSelected[0].split(' ');
    return [...filteredModels].sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'filename':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'size':
          const aSize = a.originalSource?.filesize || a.sources?.[0]?.filesize || 0;
          const bSize = b.originalSource?.filesize || b.sources?.[0]?.filesize || 0;
          comparison = aSize - bSize;
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredModels, sortSelected]);

  return (
    <Page>
      <ui-title-bar title="3D Models">
        <button variant="primary" onClick={() => navigate("/app/models/new")}>
          Add 3D Model
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="100">
            {models.length > 0 ? (
              <>
                <IndexFilters
                  sortOptions={sortOptions}
                  sortSelected={sortSelected}
                  queryValue={queryValue}
                  queryPlaceholder="Search models"
                  onQueryChange={handleFiltersQueryChange}
                  onQueryClear={handleQueryClear}
                  onSort={setSortSelected}
                  cancelAction={{
                    onAction: handleQueryClear,
                    disabled: false,
                    loading: false,
                  }}
                  tabs={tabs}
                  selected={selected}
                  onSelect={setSelected}
                  filters={filters}
                  appliedFilters={appliedFilters}
                  onClearAll={handleFiltersClearAll}
                  mode={mode}
                  setMode={setMode}
                  autoFocusSearchField={false}
                />
                <ModelTable models={sortedModels} />
              </>
            ) : (
              <EmptyState
                heading="No 3D models added yet"
                action={{
                  content: 'Add 3D model',
                  onAction: () => navigate("/app/models/new")
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png" >
                <p>Add 3D models to enhance your product visualization.</p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
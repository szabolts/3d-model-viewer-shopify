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
  Popover,
  BlockStack,
  Box,
  Link,
  IndexFilters,
  useSetIndexFiltersMode,
  IndexFiltersMode,
  useBreakpoints,
  IndexFiltersProps,
  TabProps,

} from "@shopify/polaris";
import { ImageIcon } from '@shopify/polaris-icons';
import { useState, useEffect, useCallback, useMemo } from 'react';

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
        id
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
      products(first: 250) {
        nodes {
          id
          title
          handle
          media(first: 10) {
            nodes {
              ... on Model3d {
                id
              }
            }
          }
        }
      }
    }
  `);

  const json = await response.json();

  const models = json.data.files.nodes.filter(node => node && Object.keys(node).length > 0) || [];
  const products = json.data.products.nodes || [];

  // match models and products
  const modelsWithProducts = models.map(model => {
    const referencingProducts = products.filter(product =>
      product.media.nodes.some(media => media.id === model.id)
    ).map(product => ({
      id: product.id,
      title: product.title
    }));

    return {
      ...model,
      products: referencingProducts
    };
  });

  return {
    models: modelsWithProducts,
    shop: json.data.shop
  };
}

const ModelTable = ({ models = [], shop }) => {
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
          { title: "Size", alignment: 'end' },
          { title: "References" },
          { title: "Actions" }
        ]}
        hasZebraStriping
        selectable={false}
      >
        {models?.map((model) => (
          <ModelTableRow key={model.id} model={model} shop={shop} />
        ))}
      </IndexTable>
    </ClientOnly>
  );
};

const ModelTableRow = ({ model, shop }) => {
  const navigate = useNavigate();

  const sizeMB = model.originalSource?.filesize
    ? (model.originalSource.filesize / (1024 * 1024)).toFixed(2)
    : (model.sources?.[0]?.filesize / (1024 * 1024))?.toFixed(2) || '0.00';

  const dateAdded = new Date(model.createdAt).toLocaleDateString();
  const numericId = model.id.split('/').pop();
  const appUrl = `/app/models/${numericId}`;

  return (
    <IndexTable.Row id={model.id}>
      <IndexTable.Cell>
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
        <Text as="span" variant="bodyMd" alignment="end" numeric>
          {sizeMB} MB
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <ProductReferences products={model.products || []} shop={shop} />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button onClick={() => navigate(appUrl)} size="slim">
          Edit
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  );
};

const ProductReferences = ({ products, shop }) => {
  const [expanded, setExpanded] = useState(false);
  const [popoverActive, setPopoverActive] = useState(false);

  const togglePopoverActive = useCallback(() => {
    setPopoverActive((active) => !active);
    setExpanded((expanded) => !expanded);
  }, []);

  const handleClose = useCallback(() => {
    setPopoverActive(false);
    setExpanded(false);
  }, []);

  const activator = (
    <Button
      variant="monochromePlain"
      monochrome
      disclosure={expanded ? 'up' : 'down'}
      onClick={togglePopoverActive}
    >
      {`${products.length} Product${products.length !== 1 ? 's' : ''}`}
    </Button>
  );

  const getNumericId = (gid) => gid.split('/').pop();

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      onClose={handleClose}
      ariaHaspopup={false}
    >
      <Box paddingBlock="200" paddingInline="300">
        <BlockStack gap="200">
          <Text as="h6" variant="headingSm">
            Product{products.length !== 1 ? 's' : ''}
          </Text>
          <BlockStack gap="100">
            {products.map((product) => (
              <Link
                key={product.id}
                url={`https://admin.shopify.com/store/${shop.name}/products/${getNumericId(product.id)}`}
                removeUnderline
                target="_blank"
                rel="noopener noreferrer"
              >
                {product.title}
              </Link>
            ))}
          </BlockStack>
        </BlockStack>
      </Box>
    </Popover>
  );
};

export default function Index() {
  const { models, shop } = useLoaderData();
  const navigate = useNavigate();
  const [sortSelected, setSortSelected] = useState(['filename asc']);
  const [queryValue, setQueryValue] = useState('');
  const { mode, setMode } = useSetIndexFiltersMode(IndexFiltersMode.Default);
  const [selected, setSelected] = useState(0);

  const tabs: TabProps[] = [
    {
      content: 'All',
      index: 0,
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
          comparison = a.originalSource.filesize - b.originalSource.filesize;
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
                <ModelTable models={sortedModels} shop={shop} />
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
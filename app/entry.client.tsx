import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// StrictMode removed
startTransition(() => {
  hydrateRoot(
    document,
      <RemixBrowser />
  );
});

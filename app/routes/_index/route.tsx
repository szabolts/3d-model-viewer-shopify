import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
      <h1 className={styles.heading}>Next-Generation 3D Model Viewing with WebGPU</h1>
        <p className={styles.text}>
          Boost your product conversion rates with stunning, fast, and interactive 3D model visualization that leverages the latest browser technologies.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Cutting-edge WebGPU Technology</strong>. Harness the hardware-accelerated power of modern browsers for smooth, fast, and detailed 3D rendering - with automatic fallback to WebGL for older browsers.
          </li>
          <li>
            <strong>Easy Model Upload & Management</strong>. Upload your own 3D models (.glb format), configure rendering properties through a user-friendly interface, and embed on any product page.
          </li>
          <li>
            <strong>Full Customization Options</strong>. Adjust camera position, field of view, material quality, and lighting to achieve the perfect presentation, which are automatically saved for each model.
          </li>
          <li>
            <strong>Enhanced Shopping Experience</strong>. Allow visitors to rotate, zoom, and examine 3D models from different angles, helping them make confident purchasing decisions and reducing return rates.
          </li>
        </ul>
      </div>
    </div>
  );
}

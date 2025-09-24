"use client";

import styles from "./CssModuleComponent.module.css";

export function CssModuleComponent() {
  return (
    <div className={styles["module-content"]} data-testid="css-module-content">
      <h1>CSS Modules Import</h1>
      <p>This component tests CSS modules in a client component.</p>
    </div>
  );
}

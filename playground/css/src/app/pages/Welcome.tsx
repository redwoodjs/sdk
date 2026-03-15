"use client";

import styles from "./Welcome.module.css";

export const Welcome = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>FOUC Repro</h1>
      <p className={styles.subtitle}>
        If you see unstyled content flash before styles load, FOUC is present.
      </p>
    </div>
  );
};

import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './RouteProgressBar.module.css';

export const RouteProgressBar: React.FC = () => {
  const location = useLocation();
  const [progress, setProgress] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(false);
  const [opacity, setOpacity] = useState<number>(1);
  const isFirstRender = useRef(true);
  const timersRef = useRef<number[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    // Avoid running on very first mount if already at initial route, or trigger quick smooth entry
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    clearAllTimers();

    // Start progress
    setVisible(true);
    setOpacity(1);
    setProgress(25);

    // Trickle progress to ~70%
    const t1 = window.setTimeout(() => {
      setProgress(70);
    }, 100);

    // Complete to 100%
    const t2 = window.setTimeout(() => {
      setProgress(100);
    }, 280);

    // Fade out
    const t3 = window.setTimeout(() => {
      setOpacity(0);
    }, 450);

    // Reset and hide
    const t4 = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
      setOpacity(1);
    }, 700);

    timersRef.current = [t1, t2, t3, t4];

    return () => {
      clearAllTimers();
    };
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div className={styles.progressBarContainer} aria-hidden="true">
      <div
        className={styles.progressBar}
        style={{
          width: `${progress}%`,
          opacity: opacity,
        }}
      >
        <div className={styles.progressPeg} />
      </div>
    </div>
  );
};

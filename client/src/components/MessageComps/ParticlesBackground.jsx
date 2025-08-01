import React, { useState, useEffect, memo } from 'react';
import Particles from '@tsparticles/react';
import { loadFull } from 'tsparticles';
import { initParticlesEngine } from '@tsparticles/react';

export const ParticlesBackground = memo(({ isDark = true }) => {
  const [init, setInit] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
    }).then(() => {
      setInit(true);
    });
  }, []);

  const particleColor = isDark ? '#128C7E' : '#3b82f6';
  const linkColor = isDark ? '#128C7E' : '#3b82f6';

  const particlesOptions = {
    fullScreen: { enable: false },
    background: { color: { value: 'transparent' } },
    fpsLimit: 120,
    interactivity: {
      events: {
        onClick: { enable: true, mode: 'push' },
        onHover: { enable: true, mode: 'repulse' },
      },
      modes: {
        push: { quantity: 2 },
        repulse: { distance: 200, duration: 0.4 },
      },
    },
    particles: {
      color: { value: particleColor },
      links: {
        color: linkColor,
        distance: 150,
        enable: true,
        opacity: 0.5,
        width: 1,
      },
      move: {
        direction: 'none',
        enable: true,
        outModes: { default: 'bounce' },
        random: false,
        speed: 1,
        straight: false,
      },
      number: {
        density: { enable: true, area: 800 },
        value: 80,
      },
      opacity: { value: 0.5 },
      shape: { type: 'circle' },
      size: { value: { min: 1, max: 5 } },
    },
    detectRetina: true,
  };

  if (!init) return null;

  return (
    <Particles
      id="tsparticles"
      options={particlesOptions}
      className="particles-background"
    />
  );
});
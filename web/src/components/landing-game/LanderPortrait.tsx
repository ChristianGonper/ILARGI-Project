import { useEffect, useRef } from "react";
import * as THREE from "three";
import { makeLander } from "../../three/spacecraft";

/** A still view of the same illustrative lander used in the orbital scene. */
export function LanderPortrait() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(96, 96, false);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.8, 1.8, 1.8, -1.8, 0.1, 20);
    camera.position.set(3, 2, 5);
    camera.lookAt(0, 0.1, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(2, 5, 4);
    scene.add(light);
    const lander = makeLander();
    scene.add(lander);
    renderer.render(scene, camera);

    return () => {
      const materials = new Set<THREE.Material>();
      lander.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            materials.add(material);
          }
        }
      });
      materials.forEach((material) => material.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={96}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

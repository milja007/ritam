import { Canvas, Fill, Shader, useClock, type SkRuntimeEffect } from '@shopify/react-native-skia';
import { useMemo, type ComponentProps } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { colorUniform, ORB_FIRE_STILL_TIME, type OrbFireMotion, type OrbFlameColors } from '@/core/gamification';

type OrbFireProps = {
  effect: SkRuntimeEffect;
  /** Promjer jezgre u px. */
  size: number;
  motion: OrbFireMotion;
  colors: OrbFlameColors;
  /** Uz „smanji kretanje“ plamen stoji u jednom lijepom trenutku. */
  still: boolean;
};

/** Sat se vrti u krug da brojevi u shaderu ostanu mali (preciznost šuma na GPU-u); skok je rijedak i neprimjetan. */
const CLOCK_WRAP_S = 300;

function useFireUniforms({ size, motion, colors }: Pick<OrbFireProps, 'size' | 'motion' | 'colors'>) {
  return useMemo(
    () => ({
      res: [size, size],
      height: motion.height,
      speed: motion.speed,
      embers: motion.embers,
      cCore: colorUniform(colors.core),
      cMid: colorUniform(colors.mid),
      cGlow: colorUniform(colors.glow),
      cEdge: colorUniform(colors.edge),
    }),
    [colors.core, colors.edge, colors.glow, colors.mid, motion.embers, motion.height, motion.speed, size],
  );
}

/**
 * Pravi plamen u jezgri orb-plamena (korak 33): Skia shader na GPU-u. Ukrasno — značenje nosi
 * tekst uz avatar. Uz „smanji kretanje“ plamen stoji u jednom lijepom trenutku i ne troši sličice.
 */
export function OrbFire(props: OrbFireProps) {
  return props.still ? <StillFire {...props} /> : <LiveFire {...props} />;
}

function StillFire({ effect, size, motion, colors }: OrbFireProps) {
  const fixed = useFireUniforms({ size, motion, colors });
  const uniforms = useMemo(() => ({ ...fixed, time: ORB_FIRE_STILL_TIME }), [fixed]);
  return <FireCanvas effect={effect} size={size} uniforms={uniforms} />;
}

/** Sat iz Reanimateda (`useClock`): uniformi se računaju na UI niti, JS nit ne radi ništa po sličici. */
function LiveFire({ effect, size, motion, colors }: OrbFireProps) {
  const clock = useClock();
  const fixed = useFireUniforms({ size, motion, colors });
  const uniforms = useDerivedValue(() => ({ ...fixed, time: (clock.value / 1000) % CLOCK_WRAP_S }), [fixed]);
  return <FireCanvas effect={effect} size={size} uniforms={uniforms} />;
}

function FireCanvas({
  effect,
  size,
  uniforms,
}: {
  effect: SkRuntimeEffect;
  size: number;
  uniforms: ComponentProps<typeof Shader>['uniforms'];
}) {
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Fill>
        <Shader source={effect} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

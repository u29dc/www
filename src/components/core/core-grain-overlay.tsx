'use client';

/**
 * SUMMARY
 * High-quality film grain overlay using blue-noise texture and multi-octave fBm.
 * Renders a full-screen WebGL canvas with GPU-efficient grain effect that adapts
 * to theme and respects motion preferences.
 *
 * RESPONSIBILITIES
 * - Generate authentic film grain using blue-noise + fBm pipeline
 * - Manage WebGL renderer lifecycle (init, frame, resize, dispose)
 * - Integrate with theme system (+10% light, -20% dark intensity)
 * - Handle prefers-reduced-motion (freeze animation, keep static grain)
 * - Track performance via FrameMonitor and log warnings
 * - Clean up all GPU resources on unmount
 *
 * USAGE
 * ```tsx
 * <CoreGrainOverlay
 *   intensity={0.25}
 *   grainScale={1.6}
 *   animationSpeed={0.45}
 *   chromaticVariance={0.12}
 *   exposure={0.9}
 * />
 * ```
 *
 * KEY FLOWS
 * 1. Mount: Generate blue-noise texture, create renderer, start animation loop
 * 2. Theme change: Adjust intensity (+10% light, -20% dark)
 * 3. Motion pref change: Freeze/unfreeze animation
 * 4. Unmount: Dispose all GPU resources, stop animation
 *
 * TECHNICAL NOTES
 * - Uses WebGL blend state (not in-shader blending) due to canvas overlay limitation
 * - Blue-noise texture + 3-octave fBm for authentic film emulsion feel
 * - Golden-angle temporal scrambling (16 offsets) prevents banding
 * - Chromatic variance per RGB channel for color film grain
 * - Alpha channel shaped to produce soft-light perception when composited
 * - Target <40 shader instructions for performance
 */

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '@/lib/logger';
import {
	type CanvasDimensions,
	createFullscreenQuad,
	createProgram,
	createRenderer,
	disposeBuffer,
	type RendererHandle,
	type RendererModule,
	resolveUniforms,
} from '@/lib/webgl';

// ============================================================================
// BLUE NOISE DATA
// ============================================================================

/**
 * Blue noise dataset used by CoreGrainOverlay.
 *
 * Generated via iterative high-pass filtering with toroidal convolution to
 * approximate a tileable blue-noise distribution.
 */
const BLUE_NOISE_SIZE = 64;

/** Base64 encoded RGBA8 tile (size^2 * 4 bytes). */
const BLUE_NOISE_BASE64 =
	'jY2N/z4+Pv+cnJz/ZmZm/5ycnP+Xl5f/iIiI/1xcXP9OTk7/XFxc/5WVlf9VVVX/v7+//35+fv+goKD/ZmZm/3d3d/96enr/fHx8/4mJif+CgoL/cnJy/4GBgf+2trb/XV1d/76+vv+Dg4P/kZGR/4KCgv+Ojo7/YGBg/76+vv9eXl7/rKys/2NjY/92dnb/pKSk/ycnJ/+6urr/ODg4/5KSkv+urq7/paWl/2xsbP++vr7/Z2dn/3l5ef/T09P/Xl5e/39/f/9RUVH/7e3t/zo6Ov+urq7/Q0ND/8bGxv9jY2P/vLy8/4WFhf9JSUn/t7e3/3Jycv+ampr/YmJi/4ODg/9+fn7/mZmZ/1RUVP9ubm7/j4+P/0VFRf+6urr/f39//7S0tP+EhIT/X19f/5mZmf9RUVH/c3Nz/5+fn/9nZ2f/jIyM/4KCgv9XV1f/u7u7/1paWv+mpqb/d3d3/4WFhf9mZmb/ampq/4KCgv+dnZ3/SEhI/7CwsP88PDz/kJCQ/4eHh/95eXn/hoaG/4iIiP+Dg4P/ioqK/4CAgP+zs7P/FxcX/6urq/9cXFz/k5OT/3R0dP+JiYn/VFRU/3Jycv+qqqr/TExM/4WFhf9ZWVn/y8vL/1hYWP+FhYX/eXl5/4qKiv9OTk7/tLS0/01NTf+EhIT/b29v/4SEhP90dHT/dnZ2/6qqqv98fHz/lZWV/19fX//MzMz/YGBg/4KCgv9lZWX/bW1t/7y8vP9HR0f/19fX/09PT/+SkpL/np6e/09PT/+9vb3/a2tr/3p6ev9+fn7/eXl5/0pKSv+cnJz/kJCQ/5ubm/90dHT/TU1N/9HR0f9ISEj/vLy8/3V1df9VVVX/nZ2d/4WFhf9OTk7/r6+v/2tra/9gYGD/n5+f/4CAgP+NjY3/eXl5/1lZWf+Pj4//hISE/4aGhv9/f3//jo6O/6Kiov93d3f/q6ur/xwcHP/R0dH/JCQk/7q6uv9JSUn/kZGR/3h4eP9+fn7/m5ub/2BgYP+UlJT/a2tr/4uLi/9ISEj/iYmJ/5CQkP96enr/VlZW/3t7e/9oaGj/lpaW/3Fxcf9aWlr/qqqq/1BQUP98fHz/goKC/1BQUP+jo6P/ZWVl/4WFhf9+fn7/jo6O/4qKiv+8vLz/UVFR/3Jycv9RUVH/q6ur/3Z2dv+Kior/e3t7/1hYWP+Dg4P/urq6/0dHR/+Ghob/r6+v/2RkZP+Ghob/qamp/1tbW/93d3f/goKC/4KCgv+vr6//f39//25ubv+AgID/g4OD/1RUVP9ycnL/YGBg/5qamv97e3v/kZGR/3Nzc/++vr7/SkpK/+/v7/8xMTH/u7u7/1RUVP+QkJD/jY2N/4yMjP+EhIT/tra2/1hYWP+UlJT/bW1t/5qamv+ioqL/fX19/5ubm/+CgoL/tLS0/0hISP++vr7/TExM/8/Pz/9dXV3/k5OT/2hoaP+ZmZn/VlZW/7W1tf8WFhb/hYWF/6SkpP+YmJj/k5OT/3t7e/+Wlpb/NTU1/6ysrP+pqan/dXV1/1tbW/+pqan/qamp/yMjI/+5ubn/RkZG/35+fv+oqKj/cXFx/5iYmP9nZ2f/bGxs/2FhYf+Ghob/s7Oz/0lJSf/p6en/aWlp/8HBwf8yMjL/x8fH/15eXv+Kior/gYGB/1lZWf9YWFj/cXFx/4iIiP+AgID/fHx8/3V1df9qamr/a2tr/5CQkP9mZmb/j4+P/3Nzc/+IiIj/c3Nz/2lpaf92dnb/WVlZ/2lpaf+MjIz/enp6/3l5ef9NTU3/p6en/3Nzc/+Hh4f/kpKS/1FRUf+pqan/l5eX/729vf8FBQX/oqKi/21tbf9wcHD/iYmJ/8HBwf9oaGj/UVFR/4qKiv+RkZH/RUVF/3Fxcf+7u7v/WFhY/8LCwv9nZ2f/e3t7/3x8fP99fX3/hYWF/4KCgv+9vb3/VFRU/3R0dP9ubm7/VlZW/2RkZP96enr/lpaW/0VFRf+goKD/SEhI/5GRkf+Xl5f/ubm5/4aGhv95eXn/iYmJ/2xsbP+dnZ3/hYWF/7u7u/9GRkb/v7+//1tbW/+ioqL/WVlZ/25ubv/AwMD/Tk5O/93d3f9qamr/dnZ2/6SkpP9gYGD/vr6+/zMzM/+rq6v/X19f/5CQkP+oqKj/dHR0/1lZWf91dXX/vb29/5qamv9jY2P/e3t7/4eHh/8/Pz//fn5+/7+/v/9eXl7/gYGB/9vb2/9MTEz/lJSU/3p6ev9ra2v/dnZ2/5mZmf9VVVX/n5+f/5GRkf9VVVX/eXl5/1paWv+2trb/fX19/6ysrP+CgoL/jIyM/35+fv+kpKT/fn5+/7a2tv9ycnL/ZWVl/2pqav9lZWX/ioqK/3l5ef+CgoL/ZmZm/6ioqP8rKyv/rKys/3Nzc/9PT0//uLi4/3t7e/+Wlpb/goKC/3Z2dv9gYGD/iYmJ/6SkpP9JSUn/i4uL/319ff+0tLT/SUlJ/8TExP9FRUX/eHh4/3BwcP+SkpL/oqKi/zY2Nv9cXFz/urq6/4SEhP+cnJz/fn5+/8rKyv8FBQX/6+vr/0BAQP9BQUH/xsbG/0xMTP+UlJT/ampq/5eXl/9xcXH/ubm5/1ZWVv9/f3//cXFx/8LCwv9nZ2f/kpKS/05OTv+Li4v/c3Nz/3Nzc/99fX3/a2tr/4GBgf8+Pj7/pqam/2tra/+ioqL/i4uL/39/f/95eXn/n5+f/25ubv+Kior/lZWV/5+fn/9mZmb/yMjI/zIyMv+JiYn/ZGRk/1xcXP97e3v/vLy8/zQ0NP+Ghob/qamp/42Njf9UVFT/iIiI/2FhYf+jo6P/VVVV/7m5uf+Pj4//YWFh/3V1df+4uLj/mJiY/1dXV/9VVVX/rKys/x4eHv+enp7/rKys/ywsLP/T09P/goKC/3x8fP9ubm7/uLi4/2pqav+ioqL/Ly8v/46Ojv9xcXH/oaGh/19fX/+VlZX/NTU1/9fX1/8zMzP/p6en/4iIiP96enr/jIyM/5OTk/93d3f/m5ub/6+vr/9NTU3/sLCw/2RkZP+CgoL/kJCQ/1lZWf9/f3//g4OD/1ZWVv+UlJT/YmJi/2ZmZv+srKz/kZGR/4qKiv/W1tb/WFhY/52dnf+RkZH/mZmZ/zY2Nv+Wlpb/Z2dn/87Ozv9TU1P/gYGB/7a2tv9HR0f/aGho/7W1tf9oaGj/MzMz/6ampv91dXX/lZWV/6qqqv91dXX/ra2t/ywsLP/U1NT/VFRU/2FhYf+jo6P/gICA/2ZmZv9SUlL/oqKi/6Kiov+JiYn/ampq/4yMjP9zc3P/hYWF/4CAgP+Hh4f/fn5+/6Wlpf9YWFj/l5eX/1paWv+Xl5f/Z2dn/5ubm/8nJyf/urq6/z09Pf+ampr/cHBw/4mJif+goKD/b29v/39/f/+EhIT/j4+P/2JiYv/R0dH/Nzc3/56env8yMjL/YWFh/25ubv9+fn7/WVlZ/5iYmP+ZmZn/ioqK/319ff8/Pz//vr6+/2VlZf9NTU3/r6+v/5iYmP9CQkL/t7e3/6urq/9+fn7/l5eX/0FBQf+FhYX/SUlJ/6Kiov+AgID/WFhY/5+fn/+Hh4f/fHx8/3x8fP+ampr/paWl/3p6ev82Njb/p6en/5SUlP91dXX/bGxs/6+vr/9nZ2f/iIiI/5aWlv9LS0v/kJCQ/4eHh/+RkZH/aWlp/3R0dP+Wlpb/lJSU/6SkpP+CgoL/i4uL/3x8fP+RkZH/QEBA/7W1tf99fX3/VlZW/6urq/9/f3//QkJC/6CgoP+EhIT/ra2t/7m5uf9wcHD/oqKi/2RkZP+JiYn/aWlp/2NjY/+7u7v/YGBg/4iIiP9nZ2f/2dnZ/0JCQv91dXX/ysrK/ywsLP9vb2//V1dX/4uLi/+enp7/nZ2d/5aWlv+Li4v/XFxc/8LCwv9YWFj/jIyM/2VlZf+NjY3/Z2dn/11dXf+EhIT/w8PD/1RUVP9jY2P/bm5u/7e3t/9GRkb/o6Oj/1tbW/91dXX/oqKi/4eHh/9vb2//cXFx/6Wlpf+JiYn/gYGB/3V1df84ODj/j4+P/4KCgv9LS0v/xMTE/15eXv90dHT/l5eX/5eXl/9DQ0P/l5eX/4qKiv+5ubn/QkJC/2dnZ/93d3f/V1dX/7u7u/+AgID/j4+P/4WFhf+FhYX/jo6O/01NTf/e3t7/KCgo/4yMjP+FhYX/k5OT/05OTv+6urr/n5+f/7e3t/9fX1//Wlpa/3x8fP9KSkr/g4OD/5iYmP9dXV3/fX19/4iIiP+FhYX/i4uL/4qKiv+jo6P/cXFx/3Nzc/+CgoL/ubm5/4iIiP9gYGD/dnZ2/4SEhP+goKD/j4+P/1VVVf+EhIT/np6e/2RkZP93d3f/hoaG/0VFRf+5ubn/n5+f/5WVlf9vb2//mJiY/0dHR/+8vLz/dXV1/1ZWVv9zc3P/p6en/5OTk/8zMzP/bm5u/4mJif+MjIz/oqKi/3Nzc/9LS0v/dnZ2/0lJSf+mpqb/bm5u/3l5ef+FhYX/Z2dn/39/f//Hx8f/Pz8//5qamv+wsLD/Ojo6/2VlZf9cXFz/oqKi/8DAwP9dXV3/1NTU/0pKSv+Ghob/f39//4iIiP+srKz/TExM/4KCgv9gYGD/gYGB/2lpaf+ioqL/PT09/6CgoP8mJib/w8PD/4+Pj/9/f3//XFxc/3p6ev+goKD/eXl5/1ZWVv+bm5v/iIiI/42Njf+goKD/jY2N/zIyMv+Hh4f/Xl5e/7e3t/99fX3/QEBA/5+fn/+bm5v/eHh4/2RkZP9zc3P/tra2/5aWlv+tra3/S0tL/4eHh/+Hh4f/n5+f/7a2tv+Ojo7/d3d3/3p6ev+Hh4f/aGho/6urq/9tbW3/NjY2/8TExP9PT0//Z2dn/7S0tP+QkJD/ioqK/1NTU/9jY2P/jY2N/0tLS/+6urr/bW1t/5iYmP9UVFT/i4uL/11dXf/Z2dn/VFRU/6urq/9ZWVn/pKSk/3R0dP+Hh4f/p6en/2FhYf99fX3/VVVV/93d3f9GRkb/g4OD/39/f/+Tk5P/kJCQ/3R0dP86Ojr/fX19/1paWv+dnZ3/ycnJ/1JSUv+Dg4P/TExM/+Xl5f9kZGT/dXV1/4+Pj/97e3v/nZ2d/0xMTP9fX1//WFhY/5GRkf+enp7/Y2Nj/3p6ev87Ozv/cnJy/6urq/9NTU3/qamp/5SUlP8rKyv/3Nzc/2VlZf+kpKT/cnJy/6Ghof+IiIj/U1NT/42Njf+xsbH/goKC/5eXl/+BgYH/ampq/1hYWP+urq7/enp6/4aGhv+Kior/S0tL/56env+CgoL/gICA/4yMjP9eXl7/np6e/19fX/+RkZH/VlZW/8LCwv8oKCj/lJSU/5qamv+AgID/bGxs/1tbW/+enp7/srKy/7m5uf97e3v/lJSU/zc3N/+ioqL/mpqa/6Wlpf84ODj/c3Nz/4yMjP+JiYn/YWFh/52dnf9ra2v/z8/P/19fX/+5ubn/NDQ0/6Ghof91dXX/xsbG/2RkZP94eHj/jo6O/2NjY/9hYWH/wMDA/1hYWP93d3f/enp6/3V1df9iYmL/SUlJ/6ioqP9mZmb/hoaG/1hYWP+QkJD/Wlpa/5qamv+pqan/ampq/2NjY/+1tbX/aWlp/6ampv9dXV3/d3d3/2JiYv+QkJD/b29v/5OTk/9YWFj/x8fH/1tbW/+Wlpb/mZmZ/4KCgv94eHj/VFRU/8LCwv9vb2//hoaG/yoqKv9ubm7/SUlJ/6SkpP96enr/jY2N/zMzM/+kpKT/f39//6Wlpf8vLy//jY2N/4GBgf93d3f/q6ur/zk5Of+rq6v/Z2dn/5GRkf+6urr/NDQ0/6mpqf9ra2v/ra2t/0VFRf/Ozs7/fn5+/2lpaf+jo6P/eXl5/3l5ef+dnZ3/ra2t/5+fn/+VlZX/ampq/39/f/+VlZX/jo6O/4CAgP+RkZH/T09P/3t7e/+bm5v/RUVF/4mJif+IiIj/dHR0/8LCwv9cXFz/u7u7/0dHR//c3Nz/PT09/39/f/+Li4v/Y2Nj/35+fv9cXFz/sLCw/2BgYP+Wlpb/VlZW/6Wlpf+UlJT/vb29/5ubm/9oaGj/np6e/4qKiv+cnJz/g4OD/0pKSv+qqqr/ycnJ/3V1df+Kior/Xl5e/2xsbP+ampr/Xl5e/3t7e/9kZGT/Tk5O/6CgoP93d3f/ODg4/5+fn/9ycnL/cXFx/0RERP+zs7P/V1dX/3V1df/BwcH/Ghoa/5mZmf8kJCT/kJCQ/4+Pj/9ycnL/jo6O/0hISP93d3f/g4OD/3x8fP+zs7P/ZWVl/4qKiv+UlJT/VFRU/7u7u/9BQUH/o6Oj/2NjY/+AgID/T09P/6qqqv9bW1v/nZ2d/2JiYv+ysrL/j4+P/1ZWVv/Dw8P/UVFR/5SUlP92dnb/eHh4/0xMTP92dnb/enp6/4qKiv8aGhr/xMTE/0BAQP/T09P/V1dX/09PT/+BgYH/j4+P/5ubm/+Kior/kpKS/5OTk/+QkJD/sLCw/4ODg/+VlZX/cnJy/9bW1v9kZGT/ampq/8XFxf+JiYn/ZmZm/66urv9fX1//ampq/5SUlP+VlZX/np6e/35+fv96enr/ampq/5KSkv+ysrL/e3t7/6enp/9fX1//ampq/6enp/9kZGT/sLCw/1dXV/+FhYX/YWFh/5aWlv9jY2P/qqqq/5SUlP+FhYX/fn5+/6ysrP88PDz/srKy/ywsLP+9vb3/ODg4/4SEhP+CgoL/l5eX/2dnZ/+kpKT/jIyM/1xcXP/CwsL/lpaW/3l5ef9dXV3/jo6O/2BgYP+mpqb/eHh4/2lpaf9XV1f/goKC/0RERP9+fn7/fX19/zk5Of+Dg4P/fHx8/2hoaP8+Pj7/sLCw/1xcXP9OTk7/YWFh/6ioqP9jY2P/gYGB/7m5uf9ERET/z8/P/ykpKf+6urr/d3d3/3d3d/+Li4v/MzMz/319ff9gYGD/m5ub/3Z2dv9fX1//ioqK/z4+Pv+6urr/jo6O/4eHh/+5ubn/Y2Nj/35+fv9cXFz/fHx8/2FhYf+BgYH/cnJy/7e3t/9UVFT/ubm5/3x8fP/T09P/QkJC/4mJif96enr/fn5+/5eXl/9kZGT/hoaG/zY2Nv/AwMD/ioqK/2hoaP+rq6v/ioqK/4CAgP95eXn/1NTU/21tbf/Dw8P/eHh4/25ubv+goKD/p6en/1hYWP+/v7//mJiY/15eXv+fn5//2dnZ/2BgYP+Tk5P/YmJi/5qamv9UVFT/enp6/21tbf9tbW3/g4OD/3Z2dv9ycnL/iIiI/9PT0/9SUlL/ysrK/0VFRf/a2tr/aGho/6qqqv+Ojo7/dnZ2/1VVVf9+fn7/NTU1/4eHh/+JiYn/jY2N/5CQkP+dnZ3/kJCQ/2BgYP9kZGT/paWl/0hISP9cXFz/NjY2/8bGxv9cXFz/rKys/09PT/+YmJj/Tk5O/9zc3P89PT3/nZ2d/zg4OP+8vLz/JSUl/5aWlv9vb2//iYmJ/1VVVf9OTk7/f39//1paWv/p6en/Ozs7/4SEhP96enr/Pj4+/56env9lZWX/hoaG/xgYGP+bm5v/fX19/5GRkf9ycnL/l5eX/6mpqf+EhIT/lpaW/4uLi/+CgoL/j4+P/2lpaf8+Pj7/k5OT/2hoaP+Li4v/CAgI/6qqqv9aWlr/a2tr/4aGhv+kpKT/gICA/6+vr//Hx8f/NDQ0/7+/v/8+Pj7/bGxs/3Nzc//ExMT/a2tr/4CAgP+AgID//////05OTv+8vLz/T09P/4mJif+ioqL/UVFR/6+vr/9RUVH/tra2/5WVlf9/f3//kpKS/4+Pj/+mpqb/UFBQ/729vf9NTU3/29vb/56env9cXFz/VVVV/2VlZf+vr6//lpaW/6enp/94eHj/ioqK/4iIiP++vr7/cnJy/4yMjP+Dg4P/YGBg/5CQkP8mJib/hYWF/4yMjP9vb2//SkpK/7S0tP9eXl7/zs7O/3Z2dv9dXV3/wsLC/8PDw/96enr/m5ub/3l5ef+5ubn/Q0ND/6Wlpf8xMTH/cnJy/2pqav+Tk5P/e3t7/7y8vP9kZGT/Ojo6/76+vv9qamr/dXV1/yIiIv9/f3//iYmJ/11dXf+UlJT/X19f/7a2tv9jY2P/lJSU/0hISP9QUFD/hISE/4uLi/9DQ0P/r6+v/0ZGRv+np6f/YWFh/1tbW/8/Pz//wMDA/4+Pj//Kysr/NDQ0/1xcXP91dXX/VFRU/66urv85OTn/hoaG/5SUlP9SUlL/sbGx/1tbW//ExMT/np6e/3x8fP9MTEz/n5+f/4mJif98fHz/f39//1FRUf+MjIz/gYGB/2RkZP86Ojr/Z2dn/4KCgv9ycnL/S0tL/6Kiov9ra2v/lpaW/7i4uP93d3f/lJSU/2lpaf9cXFz/tra2/4aGhv9sbGz/iYmJ/3t7e//R0dH/goKC/29vb/+rq6v/cHBw/6mpqf8xMTH/ra2t/1paWv/c3Nz/jIyM/6Ojo/9wcHD/gICA/1FRUf+Tk5P/h4eH/4ODg/+vr6//vLy8/zIyMv+UlJT/R0dH/5ycnP/FxcX/nZ2d/3Nzc/+ZmZn/hoaG/6Kiov9AQED/ioqK/6CgoP9sbGz/SkpK/2FhYf+dnZ3/o6Oj/19fX/+dnZ3/UlJS/6ioqP90dHT/zs7O/y0tLf/o6Oj/aGho/9nZ2f9ubm7/iIiI/9fX1/8vLy//xsbG/1xcXP9TU1P/enp6/4aGhv9dXV3/t7e3/zo6Ov+YmJj/e3t7/3d3d/+mpqb/Dw8P/8TExP8uLi7/np6e/2RkZP9ra2v/tLS0/4yMjP91dXX/aWlp/z09Pf+NjY3/Q0ND/6+vr/9ra2v/tra2/0dHR/+ZmZn/MjIy/2tra/+ysrL/b29v/4KCgv+dnZ3/Dw8P/5WVlf9QUFD/nZ2d/1ZWVv+Li4v/srKy/35+fv9qamr/enp6/7a2tv+rq6v/KCgo/4aGhv+Kior/Y2Nj/5+fn/90dHT/dXV1/zo6Ov+dnZ3/VFRU/21tbf9UVFT/c3Nz/2ZmZv9lZWX/hoaG/3Nzc/+Ghob/kZGR/6urq/9UVFT/ra2t/3Nzc/92dnb/v7+//z4+Pv+wsLD/X19f/5KSkv+qqqr/iYmJ/4mJif+SkpL/X19f/5WVlf8jIyP/zc3N/z8/P//l5eX/eXl5/7e3t/99fX3/s7Oz/zk5Of+goKD/lZWV/5qamv+bm5v/Ozs7/7q6uv9qamr/jo6O/7S0tP+goKD/eXl5/5+fn/9iYmL/h4eH/1RUVP97e3v/mJiY/42Njf9SUlL/Y2Nj/8DAwP9ubm7/np6e/25ubv9+fn7/r6+v/2RkZP/Y2Nj/lJSU/2tra/+4uLj/kZGR/42Njf+rq6v/gYGB/3p6ev+jo6P/UFBQ/5KSkv9hYWH/f39//2VlZf+dnZ3/aGho/1xcXP+fn5//eXl5/4qKiv9sbGz/XFxc/1VVVf+NjY3/Z2dn/52dnf+UlJT/i4uL/4SEhP+vr6//MTEx/3t7e/9nZ2f/ZGRk/x4eHv/m5ub/Y2Nj/2dnZ/+Hh4f/VlZW/8TExP9aWlr/hYWF/0xMTP+Kior/UFBQ/4eHh/9wcHD/hoaG/8XFxf9XV1f/m5ub/3BwcP+Dg4P/cHBw/6Ojo/97e3v/YGBg/25ubv+2trb/JiYm/7CwsP9AQED/cHBw/zExMf+UlJT/W1tb/19fX/94eHj/dnZ2/11dXf+kpKT/VVVV/7Kysv9/f3//hISE/52dnf+Wlpb/T09P/8PDw/+JiYn/Wlpa/4SEhP92dnb/h4eH/8bGxv+VlZX/lJSU/3t7e/9PT0//fX19/2VlZf+ioqL/ISEh/8PDw/+qqqr/R0dH/9HR0f+MjIz/cXFx/1BQUP/BwcH/UVFR/7m5uf8YGBj/ubm5/1xcXP/j4+P/SkpK/5WVlf+qqqr/Z2dn/2NjY/9PT0//n5+f/6Ojo/84ODj/ubm5/4yMjP9oaGj/YmJi/7a2tv+Ghob/g4OD/5qamv+Pj4//hoaG/7Gxsf+3t7f/enp6/4iIiP+/v7//Xl5e/6Wlpf+MjIz/bGxs/5eXl/89PT3/oaGh/1RUVP+np6f/FxcX/9zc3P8XFxf/i4uL/6Ojo/92dnb/nJyc/2RkZP9DQ0P/WVlZ/3V1df+AgID/rKys/6SkpP9kZGT/f39//8fHx/9NTU3/hISE/5CQkP+FhYX/PT09/7a2tv92dnb/fHx8/25ubv+srKz/iYmJ/5eXl/92dnb/R0dH/6Ojo/9+fn7/PDw8/7y8vP+cnJz/kZGR/2lpaf9qamr/qqqq/46Ojv8dHR3/09PT/4+Pj/9JSUn/hISE/zc3N/+wsLD/VVVV/5KSkv9RUVH/RkZG/5WVlf9BQUH/goKC/1RUVP+dnZ3/VlZW/5mZmf9/f3//lJSU/7Kysv9VVVX/qqqq/42Njf+kpKT/bm5u/9TU1P8zMzP/nZ2d/0xMTP+0tLT/fn5+/+rq6v9HR0f/tra2/zAwMP96enr/kpKS/5aWlv9XV1f/g4OD/4GBgf89PT3/qqqq/5KSkv9xcXH/n5+f/2tra/+3t7f/IiIi/6mpqf9SUlL/jY2N/5qamv9ra2v/e3t7/6Ghof9NTU3/cHBw/3t7e/+Hh4f/iYmJ/19fX/9wcHD/x8fH/0pKSv9fX1//uLi4/5mZmf+goKD/aWlp/319ff90dHT/kZGR/6Kiov+UlJT/oKCg/4WFhf+goKD/gICA/21tbf+ioqL/goKC/0RERP90dHT/X19f/7y8vP8VFRX/o6Oj/zo6Ov94eHj/fHx8/6SkpP+enp7/ZmZm/4yMjP8YGBj/lJSU/5KSkv9ra2v/v7+//yoqKv+ZmZn/cHBw/5iYmP+fn5//mZmZ/4qKiv9sbGz/eXl5/2ZmZv+CgoL/eXl5/6ysrP+Hh4f/b29v/6qqqv9BQUH/oqKi/3h4eP+Pj4//jY2N/52dnf9hYWH/p6en/3Fxcf+ZmZn/a2tr/2xsbP+dnZ3/lZWV/1dXV/9cXFz/gYGB/3Nzc/+xsbH/cHBw/5mZmf9iYmL/YWFh/4GBgf9eXl7/aWlp/4qKiv+AgID/QUFB/5WVlf+Ojo7/2NjY/2NjY/9/f3//oKCg/76+vv94eHj/vr6+/1dXV/96enr/YWFh/2RkZP+Hh4f/pKSk/6SkpP82Njb/qamp/2tra/+3t7f/gICA/4yMjP9eXl7/UVFR/319ff9mZmb/goKC/35+fv+oqKj/cXFx/2hoaP9ubm7/bW1t/4eHh/9qamr/sbGx/15eXv+jo6P/Q0ND/4yMjP97e3v/d3d3/3x8fP9sbGz/aWlp/729vf9fX1//goKC/2tra/+Tk5P/oaGh/11dXf+ampr/RkZG/8bGxv8gICD/zc3N/3Nzc/+Hh4f/qamp/29vb/+Hh4f/lJSU/6ampv+JiYn/UlJS/0RERP+Wlpb/dnZ2/2lpaf81NTX/iYmJ/3l5ef9bW1v/0dHR/1ZWVv+9vb3/gICA/4WFhf82Njb/09PT/2JiYv9eXl7/hYWF/zk5Of/T09P/VlZW/+Xl5f9DQ0P/u7u7/yMjI//Jycn/ODg4/6SkpP+oqKj/mpqa/3p6ev+qqqr/T09P/4WFhf9paWn/hoaG/46Ojv+QkJD/dnZ2/5OTk/9mZmb/rq6u/35+fv9aWlr/rq6u/05OTv/MzMz/R0dH/7Kysv9cXFz/ra2t/3V1df9eXl7/ycnJ/11dXf9bW1v/q6ur/1lZWf9tbW3/ubm5/zMzM/+JiYn/VVVV/9zc3P9dXV3/vLy8/15eXv+jo6P/0NDQ/0xMTP+jo6P/g4OD/2RkZP9YWFj/oaGh/zIyMv9xcXH/1dXV/xcXF/+1tbX/eHh4/87Ozv9hYWH/bGxs/25ubv+Dg4P/ZWVl/6Ojo/+FhYX/cHBw/4aGhv9ycnL/QkJC/3R0dP9NTU3/mZmZ/2dnZ/++vr7/VlZW/7Gxsf84ODj/ra2t/01NTf+bm5v/enp6/4uLi/9aWlr/h4eH/4uLi/94eHj/YmJi/29vb/90dHT/dXV1/56env9LS0v/oKCg/1tbW/9ra2v/w8PD/0dHR/+Dg4P/rq6u/y0tLf/T09P/ZmZm/6ioqP9ISEj/hISE/3BwcP9kZGT/lJSU/zo6Ov+Tk5P/ioqK/zo6Ov/m5ub/Xl5e/4KCgv+6urr/n5+f/11dXf+enp7/oKCg/xQUFP+pqan/SkpK/+fn5/9GRkb/lJSU/15eXv+ysrL/dnZ2/4eHh/+Wlpb/iYmJ/52dnf+vr6//fn5+/52dnf96enr/ZmZm/6Ojo/9sbGz/hoaG/4eHh/94eHj/k5OT/1xcXP97e3v/xMTE/0hISP+rq6v/UFBQ/8XFxf9ycnL/yMjI/0VFRf9zc3P/oaGh/56env93d3f/oKCg/2VlZf+UlJT/a2tr/52dnf9vb2//l5eX/zk5Of+xsbH/aGho/4mJif+YmJj/fHx8/3Jycv+xsbH/b29v/6ioqP94eHj/U1NT/4GBgf+cnJz/Kysr/6Wlpf9LS0v/jIyM/21tbf++vr7/e3t7/3Jycv9fX1//oqKi/5+fn/98fHz/b29v/1FRUf+tra3/VFRU/4ODg/9ubm7/YmJi/52dnf86Ojr/urq6/zExMf+1tbX/LS0t/8DAwP96enr/WFhY/8LCwv9sbGz/lZWV/1dXV/98fHz/pKSk/2pqav9nZ2f/gICA/zo6Ov/CwsL/goKC/2pqav8lJSX/t7e3/0BAQP9ycnL/k5OT/4KCgv9ra2v/fHx8/5+fn/+mpqb/ampq/4qKiv+JiYn/SUlJ/6urq/+BgYH/YmJi/35+fv8oKCj/t7e3/5aWlv9zc3P/o6Oj/25ubv+cnJz/lpaW/3Z2dv+Li4v/NTU1/6ioqP+SkpL/j4+P/1xcXP9bW1v/i4uL/4uLi/+NjY3/gICA/2lpaf+Wlpb/eXl5/2hoaP+YmJj/eXl5/6enp/+Pj4//m5ub/52dnf9LS0v/jo6O/5+fn/89PT3/ioqK/46Ojv+FhYX/d3d3/4qKiv9lZWX/mpqa/5qamv9+fn7/ZmZm/3h4eP+Kior/5ubm/zc3N//Gxsb/wsLC/zk5Of+Xl5f/e3t7/6+vr/8jIyP/oKCg/0lJSf+QkJD/hISE/3V1df+bm5v/R0dH/7S0tP91dXX/4ODg/01NTf9nZ2f/b29v/3Nzc/+Li4v/UlJS/6urq/9LS0v/qKio/5ycnP9eXl7/YWFh/3d3d/+np6f/lJSU/2xsbP+fn5//cnJy/3t7e/+Ojo7/e3t7/6SkpP9ycnL/o6Oj/2FhYf9WVlb/k5OT/zExMf+UlJT/t7e3/0ZGRv+Ojo7/np6e/5ycnP9JSUn/sbGx/1lZWf+NjY3/i4uL/3t7e/9bW1v/pKSk/3V1df+UlJT/YGBg/zg4OP+xsbH/VVVV/zAwMP+qqqr/lJSU/1FRUf+VlZX/nJyc/3R0dP/MzMz/WFhY/6enp/98fHz/dHR0/35+fv+QkJD/YmJi/z09Pf+Pj4//qamp/5OTk/+Dg4P/hYWF/5eXl/9wcHD/hYWF/319ff9gYGD/t7e3/3l5ef+/v7//ICAg/8TExP83Nzf/ioqK/1JSUv9/f3//sLCw/zo6Ov+cnJz/W1tb/4mJif9kZGT/1dXV/1tbW//h4eH/MjIy/3Nzc/+vr6//Wlpa/4eHh/9LS0v/wcHB/zs7O/+oqKj/k5OT/2lpaf+Ojo7/a2tr/5WVlf9CQkL/xcXF/3x8fP/FxcX/Wlpa/4+Pj//Pz8//VVVV/4SEhP91dXX/gICA/5GRkf9VVVX/mZmZ/0JCQv+Pj4//T09P/66urv+BgYH/XV1d/6ysrP+Ojo7/lJSU/0ZGRv93d3f/kpKS/0BAQP+/v7//S0tL/5iYmP+SkpL/fHx8/1lZWf9/f3//gYGB/2VlZf9/f3//np6e/5+fn//g4OD/PT09/6Ghof9iYmL/r6+v/2lpaf+FhYX/np6e/zw8PP98fHz/XFxc/7a2tv+Kior/YWFh/5ubm/+ioqL/jIyM/2dnZ/+jo6P/bm5u/2lpaf9tbW3/pqam/2tra/+MjIz/tra2/ycnJ/+Ghob/Ojo6/8XFxf9eXl7/Wlpa/3h4eP+YmJj/kpKS/3Nzc/+Dg4P/eHh4/4iIiP+Xl5f/qamp/5qamv9aWlr/p6en/3l5ef9vb2//lJSU/1hYWP+tra3/pKSk/zc3N//Ozs7/WFhY/6CgoP+Hh4f/XV1d/2pqav/c3Nz/PT09/5GRkf+zs7P/ioqK/1lZWf9dXV3/dXV1/3d3d/+SkpL/dnZ2/5eXl/9ZWVn/y8vL/x0dHf/y8vL/U1NT/8HBwf8fHx//goKC/5WVlf9QUFD/Tk5O/4aGhv9lZWX/kpKS/2VlZf+rq6v/paWl/0VFRf/AwMD/JSUl/5qamv9+fn7/39/f/0RERP+EhIT/jY2N/3p6ev+wsLD/SkpK/4GBgf99fX3/a2tr/6ioqP9mZmb/iYmJ/y8vL/9wcHD/enp6/1JSUv+dnZ3/bm5u/3Jycv+QkJD/U1NT/2JiYv/Ozs7/TU1N/4KCgv9bW1v/gICA/7Kysv95eXn/S0tL/9HR0f9sbGz/VVVV/1lZWf/Ozs7/SUlJ/11dXf/R0dH/QUFB/5eXl/92dnb/fHx8/05OTv+YmJj/ZGRk/19fX/+Xl5f/qqqq/5CQkP9/f3//lZWV/8PDw/+SkpL/YmJi/5ubm/99fX3/VlZW/29vb/9xcXH/cnJy/7S0tP+QkJD/Xl5e/zw8PP/b29v/UFBQ/46Ojv9cXFz/l5eX/2lpaf+np6f/l5eX/4aGhv9/f3//Wlpa/4yMjP/Gxsb/ra2t/42Njf+tra3/fn5+/3R0dP+wsLD/bW1t/66urv+QkJD/QkJC/5iYmP+RkZH/t7e3/1dXV/9BQUH/z8/P/y8vL/+Pj4//LCws//////88PDz/kpKS/5mZmf+jo6P/MDAw/7i4uP9UVFT/j4+P/3Z2dv/y8vL/HR0d/+Tk5P9dXV3/cXFx/4CAgP8yMjL/p6en/21tbf9LS0v/cnJy/5aWlv9oaGj/eXl5/62trf9kZGT/ycnJ/2hoaP9gYGD/WFhY/6Ghof+kpKT/Ly8v/5+fn/9zc3P/xMTE/1FRUf+srKz/dnZ2/zc3N/+BgYH/jo6O/4qKiv+np6f/GRkZ/1lZWf95eXn/QUFB/4GBgf9mZmb/dXV1/1RUVP9ycnL/kJCQ/4iIiP+Xl5f/Xl5e/1ZWVv+zs7P/qKio/1ZWVv+/v7//mJiY/6enp/87Ozv/oKCg/3BwcP98fHz/Q0ND/8LCwv9ycnL/dXV1/7Ozs/8uLi7/cnJy/39/f/9sbGz/f39//5iYmP92dnb/oaGh/4mJif9NTU3/u7u7/4uLi/9ubm7/j4+P/4SEhP9mZmb/lJSU/zc3N/+zs7P/Z2dn/7+/v/9vb2//fn5+/6urq/91dXX/goKC/1lZWf9XV1f/rq6u/0pKSv/b29v/oaGh/2RkZP9TU1P/iIiI/76+vv+vr6//eHh4/7q6uv+lpaX/bm5u/8TExP9oaGj/wcHB/2RkZP9vb2//V1dX/7m5uf9YWFj/jIyM/0JCQv+YmJj/W1tb/zk5Of+Wlpb/W1tb/8TExP82Njb/r6+v/1xcXP9+fn7/d3d3/3Nzc/+Hh4f/pKSk/5qamv9ycnL/kZGR/4mJif+YmJj/UFBQ/66urv9sbGz/qqqq/42Njf85OTn/uLi4/4SEhP9VVVX/paWl/52dnf9hYWH/oqKi/21tbf96enr/VlZW/4GBgf9zc3P/hISE/2tra/+oqKj/q6ur/2ZmZv+Li4v/VlZW/0hISP+JiYn/wcHB/2NjY/9QUFD/SUlJ/729vf8fHx//o6Oj/1FRUf9xcXH/k5OT/1dXV/9ubm7/tra2/39/f/+ioqL/UFBQ/7e3t/+QkJD/fn5+/6urq/+mpqb/vr6+/1xcXP+RkZH/aWlp/8DAwP9mZmb/nZ2d/3Nzc/9mZmb/sbGx/ykpKf+tra3/YWFh/6qqqv82Njb/d3d3/4uLi/9xcXH/Q0ND/4+Pj/9OTk7/19fX/1VVVf9YWFj/u7u7/0JCQv90dHT/goKC/56env8tLS3/tLS0/5WVlf9/f3//jY2N/4CAgP+Kior/d3d3/1RUVP+pqan/ZWVl/8jIyP9lZWX/0dHR/x8fH/+fn5//t7e3/3Z2dv99fX3/ioqK/39/f/+Kior/tLS0/zExMf+zs7P/r6+v/29vb/8yMjL/dnZ2/56env9UVFT/fn5+/1RUVP+ampr/HR0d/11dXf+JiYn/jIyM/2NjY/95eXn/wMDA/2BgYP+hoaH/oaGh/0tLS/+enp7/hoaG/319ff9hYWH/vLy8/8DAwP9ZWVn/vb29/5GRkf+QkJD/fn5+/0dHR/+enp7/fn5+/5iYmP9+fn7/pKSk/11dXf+Kior/pKSk/4yMjP9WVlb/k5OT/319ff9zc3P/f39//2VlZf+rq6v/RUVF/7CwsP83Nzf/ra2t/ysrK/+7u7v/ampq/2NjY/+SkpL/hoaG/4mJif+Pj4//enp6/0pKSv/r6+v/SEhI/z8/P/+QkJD/v7+//7m5uf8/Pz//wcHB/1VVVf/W1tb/a2tr/7+/v//Jycn/XV1d/3t7e/+zs7P/b29v/09PT/+FhYX/T09P/1paWv/Gxsb/dXV1/2dnZ/90dHT/sbGx/0hISP8mJib/mpqa/1JSUv9JSUn/tbW1/2BgYP/Nzc3/ZGRk/4iIiP9XV1f/ZmZm/7Gxsf9ZWVn/t7e3/ysrK/+ioqL/cHBw/2xsbP+Xl5f/b29v/6Wlpf99fX3/e3t7/6ysrP9HR0f/w8PD/1ZWVv/a2tr/UFBQ/66urv9gYGD/enp6/3d3d/9YWFj/d3d3/6ampv9nZ2f/OTk5/6enp/+tra3/iYmJ/ycnJ/90dHT/cXFx/4+Pj/9xcXH/ZWVl/2VlZf9FRUX/Y2Nj/2dnZ/+cnJz/PDw8/4GBgf/Dw8P/aGho/9DQ0P+IiIj/SEhI/2RkZP+lpaX/qqqq/zU1Nf+1tbX/0NDQ/1RUVP/W1tb/fX19/3d3d/9zc3P/XV1d/29vb/+qqqr/c3Nz/6qqqv9QUFD/aWlp/3Jycv+xsbH/SkpK/6+vr/9ubm7/oqKi/zY2Nv+ysrL/XFxc/29vb/99fX3/dnZ2/6Kiov87Ozv/mJiY/z8/P/+YmJj/cHBw/52dnf+Hh4f/qqqq/4aGhv9VVVX/tbW1/7u7u/83Nzf/urq6/z4+Pv/s7Oz/gYGB/5CQkP9kZGT/r6+v/1dXV//j4+P/i4uL/7a2tv9wcHD/o6Oj/5aWlv+fn5//ODg4/5KSkv8pKSn/fX19/8jIyP+Ghob/cHBw/2lpaf9ycnL/nZ2d/ykpKf+VlZX/QEBA/2tra/+enp7/dHR0/62trf9/f3//UFBQ/5qamv9PT0//1dXV/21tbf+2trb/QkJC/7y8vP93d3f/dHR0/5CQkP+NjY3/dnZ2/2FhYf/CwsL/XFxc/5iYmP9YWFj/k5OT/7q6uv9paWn/qqqq/3l5ef9/f3//dHR0/1paWv+ampr/jIyM/2NjY/8/Pz//t7e3/zo6Ov+UlJT/Pj4+/4CAgP9XV1f/tLS0/z4+Pv+urq7/Gxsb/3t7e/9UVFT/qKio/xUVFf+SkpL/VlZW/7u7u/+IiIj/xMTE/1VVVf9hYWH/fX19/4aGhv+Dg4P/pqam/2lpaf+IiIj/ra2t/5eXl/+Tk5P/gYGB/4GBgf9wcHD/gYGB/7CwsP90dHT/hYWF/25ubv9AQED/oKCg/2hoaP+CgoL/V1dX/3x8fP9qamr/e3t7/4qKiv+wsLD/UFBQ/15eXv+8vLz/VlZW/5eXl/9WVlb/XFxc/6SkpP84ODj/k5OT/2pqav+goKD/Z2dn/2NjY//Gxsb/gICA/4yMjP+9vb3/nJyc/3Nzc/+rq6v/sLCw/z09Pf/BwcH/WVlZ/9XV1f+fn5//bm5u/5ubm//ExMT/kpKS/3h4eP9KSkr/W1tb/3t7e/+SkpL/qamp/3p6ev9/f3//goKC/1dXV/+IiIj/fn5+/3V1df9RUVH/ioqK/3Nzc/9JSUn/nZ2d/2VlZf9aWlr/i4uL/0tLS/+5ubn/gYGB/5aWlv9iYmL/oqKi/42Njf+6urr/a2tr/66urv9FRUX/cnJy/4GBgf/ExMT/QUFB/4GBgf+tra3/f39//5eXl/97e3v/paWl/4GBgf+Xl5f/ampq/8bGxv9cXFz/dHR0/2RkZP9qamr/PDw8/0RERP+pqan/VlZW/0xMTP+cnJz/g4OD/1FRUf97e3v/Nzc3/8TExP9NTU3/VVVV/1NTU/+5ubn/e3t7/5OTk/+YmJj/Kioq/6urq/89PT3/tra2/0tLS/+1tbX/h4eH/2dnZ/+Ghob/kpKS/3Nzc/+kpKT/pKSk/6Ojo/9qamr/qKio/5WVlf+Xl5f/hISE/0RERP+srKz/bm5u/4+Pj/9dXV3/UFBQ/2ZmZv92dnb/goKC/7S0tP9YWFj/W1tb/5CQkP+bm5v/GBgY/62trf9fX1//iIiI/1JSUv+dnZ3/WFhY/3h4eP9KSkr/nZ2d/2BgYP/Ozs7/lpaW/8bGxv+8vLz/c3Nz/2xsbP/MzMz/d3d3/2BgYP/ExMT/fX19/7e3t/80NDT/nJyc/7CwsP95eXn/bGxs/2JiYv+xsbH/R0dH/8jIyP+MjIz/jIyM/2tra/+vr6//WVlZ/1VVVf+9vb3/bW1t/6Kiov+Hh4f/QUFB/1RUVP9+fn7/Y2Nj/3V1df98fHz/Hh4e/8XFxf95eXn/enp6/5CQkP9XV1f/oaGh/6ysrP+ysrL/dnZ2/6qqqv8uLi7/xMTE/4SEhP9sbGz/sLCw/6qqqv+FhYX/dnZ2/6Wlpf9UVFT/sbGx/01NTf/k5OT/Xl5e/8zMzP9dXV3/VFRU/1FRUf9JSUn/UVFR/2pqav+qqqr/Kysr/3x8fP+QkJD/Z2dn/11dXf+Xl5f/lpaW/4iIiP9hYWH/fX19/6qqqv9SUlL/qqqq/0tLS/+RkZH/PT09/5GRkf+Dg4P/ampq/4CAgP/Gxsb/T09P/3d3d/88PDz/jIyM/8XFxf+pqan/ZGRk/8DAwP9TU1P/wsLC/5ycnP9jY2P/goKC/0pKSv+4uLj/eHh4/3x8fP9AQED/bW1t/2xsbP+Li4v/d3d3/42Njf9ycnL/cXFx/0hISP9tbW3/ZWVl/5iYmP9cXFz/ra2t/2tra/+BgYH/bW1t/1RUVP9sbGz/c3Nz/8fHx/+zs7P/jY2N/8rKyv9cXFz/p6en/8TExP9paWn/tLS0/05OTv+0tLT/Y2Nj/2ZmZv+MjIz/WFhY/42Njf9qamr/dnZ2/4+Pj/90dHT/qqqq/35+fv+ioqL/W1tb/5eXl/+Tk5P/Q0ND/4qKiv+srKz/paWl/42Njf83Nzf/RERE/5ycnP97e3v/hoaG/1FRUf96enr/i4uL/39/f//BwcH/S0tL/2VlZf+fn5//o6Oj/5+fn/9kZGT/nJyc/2xsbP96enr/l5eX/4qKiv++vr7/iYmJ/5SUlP9jY2P/srKy/0FBQf+kpKT/hISE/3h4eP/Ozs7/Y2Nj/6urq/8lJSX/d3d3/19fX/9iYmL/jY2N/0VFRf9WVlb/Z2dn/2hoaP+xsbH/V1dX/7a2tv9PT0//urq6/5GRkf91dXX/tra2/3h4eP+dnZ3/Pz8//6+vr/8zMzP/k5OT/2NjY/+9vb3/Hh4e/+Li4v9WVlb/cXFx/3l5ef9LS0v/3d3d/5qamv+QkJD/Pj4+/7a2tv9lZWX/p6en/0xMTP/Jycn/CQkJ/+3t7f9ubm7/lZWV/zExMf+Xl5f/hISE/42Njf9wcHD/qqqq/0dHR/+zs7P/Ghoa/4iIiP95eXn/lpaW/0VFRf+xsbH/U1NT/5KSkv9jY2P/TExM/4+Pj/+Hh4f/kpKS/8DAwP9tbW3/oKCg/4mJif+zs7P/oqKi/7Gxsf+Kior/YWFh/4yMjP+AgID/fX19/2hoaP9WVlb/qamp/0NDQ/+mpqb/Y2Nj/6SkpP+cnJz/aWlp/8nJyf9TU1P/dHR0/76+vv83Nzf/pqam/3Fxcf+FhYX/paWl/ykpKf+Ghob/aGho/56env+Ghob/VlZW/6qqqv9QUFD/e3t7/5SUlP+Dg4P/Ly8v/5eXl/+wsLD/T09P/6CgoP84ODj/srKy/1dXV/+ampr/WVlZ/8bGxv+dnZ3/eXl5/3p6ev+SkpL/oqKi/15eXv+VlZX/qqqq/4iIiP+CgoL/UVFR/6Kiov81NTX/goKC/7CwsP8VFRX/kZGR/0RERP9ycnL/NjY2/9XV1f8kJCT/s7Oz/2ZmZv+2trb/dHR0/3t7e/+Pj4//WVlZ/3h4eP9ubm7/W1tb/4KCgv9bW1v/m5ub/3V1df9gYGD/ra2t/09PT/+wsLD/YmJi/5mZmf+enp7/d3d3/6Ghof9ra2v/V1dX/66urv9gYGD/rq6u/66urv9jY2P/q6ur/5eXl/+5ubn/RkZG/5KSkv9+fn7/pKSk/2BgYP+Li4v/iIiI/6mpqf9NTU3/RkZG/2tra/+goKD/VlZW/2JiYv+2trb/YGBg/1xcXP97e3v/tLS0/3x8fP+CgoL/x8fH/1ZWVv+Kior/iYmJ/9ra2v9UVFT/w8PD/56env+MjIz/XV1d/9PT0/8bGxv/nZ2d/21tbf+Ojo7/eXl5/6ioqP+vr6//V1dX/8nJyf95eXn/qKio/0lJSf+1tbX/j4+P/4WFhf94eHj/jo6O/2JiYv9GRkb/qqqq/0hISP+MjIz/iIiI/6ysrP9UVFT/k5OT/09PT/9aWlr/ZmZm/3R0dP9ZWVn/ODg4/5KSkv+FhYX/gICA/2pqav+BgYH/qKio/z8/P/9lZWX/qamp/7q6uv+kpKT/dXV1/6enp/+FhYX/Wlpa/29vb/+urq7/XFxc/1NTU/+IiIj/ZmZm/1NTU/+RkZH/oaGh/0lJSf9FRUX/s7Oz/0hISP9aWlr/b29v/5KSkv8yMjL/z8/P/4WFhf9dXV3/pqam/2lpaf9DQ0P/bm5u/4eHh/9ZWVn/XFxc/5eXl/+6urr/HBwc/5GRkf9LS0v/hISE/3l5ef+srKz/pKSk/4CAgP99fX3/p6en/0pKSv9nZ2f/ycnJ/0xMTP+7u7v/jo6O/7a2tv+Ojo7/o6Oj/7a2tv+Li4v/enp6/2hoaP+vr6//XFxc/4GBgf/Kysr/ZWVl/4+Pj/82Njb/d3d3/0lJSf+YmJj/W1tb/87Ozv+Dg4P/dnZ2/6enp/+bm5v/e3t7/7Ozs/+Ghob/cnJy/0JCQv/m5ub/bm5u/319ff+Ghob/tbW1/3l5ef+4uLj/YmJi/52dnf82Njb/wcHB/1tbW/+UlJT/cnJy/8zMzP9cXFz/kpKS/56env9HR0f/b29v/8TExP+NjY3/sLCw/3h4eP+Xl5f/Q0ND/1paWv+FhYX/f39//3l5ef+qqqr/d3d3/2VlZf+Pj4//aWlp/42Njf8XFxf/rKys/zw8PP9paWn/aGho/5ubm/9OTk7/tbW1/0JCQv+ioqL/OTk5/5mZmf+VlZX/eHh4/8LCwv+NjY3/gYGB/5iYmP89PT3/ZGRk/5GRkf8nJyf/sbGx/0pKSv9ycnL/VVVV/9jY2P9fX1//aGho/2tra/+RkZH/gYGB/2VlZf9ycnL/UFBQ/42Njf+Pj4//hoaG/25ubv9kZGT/qKio/w==';

let cachedPixels: Uint8Array | null = null;

function decodeBase64ToUint8Array(base64: string): Uint8Array {
	if (typeof atob === 'function') {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	}

	const maybeBuffer = (
		globalThis as { Buffer?: { from(input: string, encoding: string): Uint8Array } }
	).Buffer;
	if (maybeBuffer) {
		const buffer = maybeBuffer.from(base64, 'base64');
		return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
	}

	throw new Error('No base64 decoder available for blue-noise texture.');
}

function getBlueNoisePixels(): Uint8Array {
	if (!cachedPixels) {
		cachedPixels = decodeBase64ToUint8Array(BLUE_NOISE_BASE64);
	}
	return cachedPixels;
}

// ============================================================================
// TYPES
// ============================================================================

interface CoreGrainOverlayProps {
	/** Grain intensity (0-1 range, default 0.25) */
	intensity?: number;
	/** Grain particle size in CSS pixels (default 1.6 = fine film grain) */
	grainScale?: number;
	/** Animation speed multiplier (default 0.45) */
	animationSpeed?: number;
	/** Per-channel chromatic jitter (0-1 range, default 0.12) */
	chromaticVariance?: number;
	/** Global intensity modifier (0-1 range, default 0.9) */
	exposure?: number;
	/** Additional Tailwind classes */
	className?: string;
}

interface GrainState {
	intensity: number;
	grainScale: number;
	animationSpeed: number;
	chromaticVariance: number;
	exposure: number;
	themeVariant: 'light' | 'dark';
	isMotionDisabled: boolean;
	timeOffset: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const UNIFORM_NAMES = [
	'u_resolution',
	'u_time',
	'u_intensity',
	'u_exposure',
	'u_grainRepeat',
	'u_chromaticVariance',
	'u_scrambleOffset',
	'u_blueNoise',
	'u_lowFreqSeed',
] as const;

// ============================================================================
// SHADERS
// ============================================================================

const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;

void main() {
	gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_exposure;
uniform vec2 u_grainRepeat;
uniform float u_chromaticVariance;
uniform vec2 u_scrambleOffset;
uniform sampler2D u_blueNoise;
uniform float u_lowFreqSeed;

out vec4 fragColor;

float hash(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float sampleBlueNoise(vec2 uv) {
	return texture(u_blueNoise, uv).r * 2.0 - 1.0;
}

void main() {
	vec2 pixelUV = gl_FragCoord.xy / u_resolution;
	vec2 repeat = u_grainRepeat;
	vec2 grainUV = pixelUV * repeat + u_scrambleOffset;

	// Temporal jitter based on hashed time + seed. Keeps motion subtle but decorrelated.
	float timeHashA = hash(vec2(u_time * 0.0003, u_lowFreqSeed * 1.37));
	float timeHashB = hash(vec2(u_time * 0.0005, u_lowFreqSeed * 3.11));
	vec2 temporalJitter = vec2(timeHashA, timeHashB) * 2.0 - 1.0;

	float grainA = sampleBlueNoise(grainUV);
	float grainB = sampleBlueNoise(grainUV * 1.231 + temporalJitter);
	float grainC = sampleBlueNoise(grainUV * 1.613 - temporalJitter.yx);
	float grainD = sampleBlueNoise(grainUV * 2.233 + temporalJitter.xx * 3.7);
	float grain = (grainA + grainB + grainC + grainD) * 0.25;

	// Fine detail boost to avoid flat regions.
	float microDetail = sampleBlueNoise(grainUV * 3.97 + vec2(temporalJitter.y, temporalJitter.x) * 4.3);
	grain = mix(grain, grain + microDetail * 0.18, 0.5);
	grain = clamp(grain, -1.0, 1.0);

	vec3 chromaticGrain = vec3(grain);
	vec3 chromaJitter = vec3(
		sampleBlueNoise(grainUV + vec2(13.37, 7.11)),
		sampleBlueNoise(grainUV * 1.389 - vec2(11.71, 3.57)),
		sampleBlueNoise(grainUV * 0.923 + vec2(-5.97, 9.61))
	);
	chromaticGrain += (chromaJitter * 0.5) * u_chromaticVariance;
	chromaticGrain = clamp(chromaticGrain, -1.0, 1.0);

	float intensity = clamp(u_intensity, 0.0, 1.0);
	chromaticGrain *= intensity;

	vec3 finalColor = chromaticGrain * 0.5 + 0.5;

	float amplitude = dot(abs(chromaticGrain), vec3(1.0 / 3.0));
	float alpha = clamp(amplitude * mix(0.85, 1.35, clamp(u_exposure, 0.0, 1.0)), 0.0, 0.9);

	fragColor = vec4(finalColor, alpha);
}
`;

// ============================================================================
// RENDERER MODULE
// ============================================================================

/**
 * Creates the grain overlay renderer module.
 * Follows webgl.ts lifecycle pattern: onInit, onFrame, onResize, onStateChange, onDispose.
 */
function createCoreGrainOverlayModule(): RendererModule<GrainState> {
	// Golden angle for temporal scrambling (137.508 degrees)
	const GOLDEN_ANGLE = 2.39996322972865;
	const SCRAMBLE_OFFSETS = Array.from({ length: 16 }, (_, i) => {
		const angle = i * GOLDEN_ANGLE;
		return [Math.cos(angle), Math.sin(angle)] as [number, number];
	});

	return {
		id: 'core-grain-overlay',

		onInit({ context, dimensions, registerDisposer, logger: _logger }) {
			const { gl, canvas } = context;
			let currentDimensions = dimensions;
			logEvent('grain-overlay', 'init', 'START', { canvas: canvas.id });

			// Create program
			const program = createProgram(context, {
				vertex: VERTEX_SHADER,
				fragment: FRAGMENT_SHADER,
			});
			gl.useProgram(program);

			// Create fullscreen quad
			const fullscreenQuad = createFullscreenQuad(gl);
			const positionLocation = gl.getAttribLocation(program, 'a_position');
			if (positionLocation === -1) {
				logEvent('grain-overlay', 'attrib-missing', 'ERROR', {
					attribute: 'a_position',
				});
			}

			// Create and bind VAO
			const vao = gl.createVertexArray();
			if (!vao) {
				throw new Error('Failed to create vertex array');
			}
			gl.bindVertexArray(vao);
			gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenQuad.buffer);
			gl.vertexAttribPointer(
				positionLocation,
				fullscreenQuad.itemSize,
				gl.FLOAT,
				false,
				0,
				0,
			);
			gl.enableVertexAttribArray(positionLocation);
			gl.bindVertexArray(null);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);

			// Resolve uniforms
			const uniforms = resolveUniforms(gl, program, UNIFORM_NAMES);
			gl.viewport(0, 0, dimensions.pixelWidth, dimensions.pixelHeight);

			// Load and upload blue-noise texture
			const blueNoiseTexture = gl.createTexture();
			if (!blueNoiseTexture) {
				throw new Error('Failed to create blue-noise texture.');
			}
			const blueNoisePixels = getBlueNoisePixels();
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				BLUE_NOISE_SIZE,
				BLUE_NOISE_SIZE,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				blueNoisePixels,
			);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.uniform1i(uniforms.u_blueNoise, 0);
			gl.bindTexture(gl.TEXTURE_2D, null);

			// Configure blend state
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(
				gl.SRC_ALPHA,
				gl.ONE_MINUS_SRC_ALPHA, // RGB blending
				gl.ONE,
				gl.ONE_MINUS_SRC_ALPHA, // Alpha blending
			);

			// Frame counter for temporal scrambling
			let frameCounter = 0;
			const resolveAnimationTime = (now: number, state: GrainState) =>
				state.isMotionDisabled
					? state.timeOffset
					: now * state.animationSpeed + state.timeOffset;

			const resolveDevicePixelRatio = () =>
				currentDimensions.dpr ||
				(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

			const resolveCssDimensions = (dpr: number) => {
				const pixelWidth = currentDimensions.pixelWidth || canvas.width;
				const pixelHeight = currentDimensions.pixelHeight || canvas.height;
				const width =
					currentDimensions.width > 0 ? currentDimensions.width : pixelWidth / dpr;
				const height =
					currentDimensions.height > 0 ? currentDimensions.height : pixelHeight / dpr;
				return { width, height, pixelWidth, pixelHeight };
			};

			const computeRepeats = (width: number, height: number, grainPixels: number) => {
				const size = Math.max(grainPixels, 0.1);
				return {
					x: Math.max(width / size, 1.0),
					y: Math.max(height / size, 1.0),
				};
			};

			const computeScrambleOffset = (
				index: number,
				isFrozen: boolean,
				repeats: { x: number; y: number },
			) => {
				if (isFrozen) {
					return [0, 0] as const;
				}
				const base = SCRAMBLE_OFFSETS[index] ?? [0, 0];
				const minRepeat = Math.max(Math.min(repeats.x, repeats.y), 1.0);
				const magnitude = 0.5 / minRepeat;
				return [base[0] * magnitude, base[1] * magnitude] as const;
			};

			// Register disposers
			registerDisposer(() => {
				gl.bindTexture(gl.TEXTURE_2D, null);
				gl.deleteTexture(blueNoiseTexture);
				gl.bindVertexArray(null);
				gl.deleteVertexArray(vao);
				disposeBuffer(gl, fullscreenQuad);
				gl.deleteProgram(program);
			});

			logEvent('grain-overlay', 'init', 'SUCCESS', {});

			return {
				onFrame({ now }, state: GrainState) {
					gl.useProgram(program);
					gl.bindVertexArray(vao);

					const time = resolveAnimationTime(now, state);
					const dpr = resolveDevicePixelRatio();
					const {
						width: cssWidth,
						height: cssHeight,
						pixelWidth,
						pixelHeight,
					} = resolveCssDimensions(dpr);
					const repeats = computeRepeats(cssWidth, cssHeight, state.grainScale);

					const scrambleIndex = frameCounter % SCRAMBLE_OFFSETS.length;
					const [scrambleX, scrambleY] = computeScrambleOffset(
						scrambleIndex,
						state.isMotionDisabled,
						repeats,
					);
					frameCounter += 1;

					gl.uniform2f(uniforms.u_resolution, pixelWidth, pixelHeight);
					gl.uniform1f(uniforms.u_time, time);
					gl.uniform1f(uniforms.u_intensity, state.intensity);
					gl.uniform1f(uniforms.u_exposure, state.exposure);
					gl.uniform2f(uniforms.u_grainRepeat, repeats.x, repeats.y);
					gl.uniform1f(uniforms.u_chromaticVariance, state.chromaticVariance);
					gl.uniform2f(uniforms.u_scrambleOffset, scrambleX, scrambleY);
					gl.uniform1f(uniforms.u_lowFreqSeed, state.timeOffset);

					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, blueNoiseTexture);

					gl.clearColor(0, 0, 0, 0);
					gl.clear(gl.COLOR_BUFFER_BIT);
					gl.drawArrays(gl.TRIANGLES, 0, fullscreenQuad.itemCount);
					gl.bindVertexArray(null);
				},

				onResize(nextDimensions: CanvasDimensions) {
					currentDimensions = nextDimensions;
					gl.viewport(0, 0, nextDimensions.pixelWidth, nextDimensions.pixelHeight);
				},

				onStateChange(nextState: GrainState, previousState: GrainState) {
					if (nextState.isMotionDisabled && !previousState.isMotionDisabled) {
						frameCounter = 0;
					}
				},

				onDispose() {
					logEvent('grain-overlay', 'dispose', 'SUCCESS', {});
				},
			};
		},
	};
}

// ============================================================================
// REACT COMPONENT
// ============================================================================

/**
 * CoreGrainOverlay component.
 * Full-screen film grain effect using WebGL.
 */
export function CoreGrainOverlay({
	intensity = 0.25,
	grainScale = 1.6,
	animationSpeed = 0.45,
	chromaticVariance = 0.12,
	exposure = 0.9,
	className = '',
}: CoreGrainOverlayProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rendererRef = useRef<RendererHandle<GrainState> | null>(null);
	const { theme } = useTheme();
	const [isMotionDisabled, setIsMotionDisabled] = useState(false);

	// Detect prefers-reduced-motion
	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		setIsMotionDisabled(mediaQuery.matches);

		const handleChange = (e: MediaQueryListEvent) => {
			setIsMotionDisabled(e.matches);
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	}, []);

	// Build initial state
	const themeVariant = (theme === 'dark' ? 'dark' : 'light') as 'light' | 'dark';
	const adjustedIntensity = themeVariant === 'light' ? intensity * 1.1 : intensity * 0.8;

	const baseState = useMemo(
		() => ({
			intensity: adjustedIntensity,
			grainScale,
			animationSpeed,
			chromaticVariance,
			exposure,
			themeVariant,
			isMotionDisabled,
			timeOffset: Math.random() * 1000,
		}),
		[
			adjustedIntensity,
			grainScale,
			animationSpeed,
			chromaticVariance,
			exposure,
			themeVariant,
			isMotionDisabled,
		],
	);

	// Initialize renderer
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		if (rendererRef.current) return;

		const renderer = createRenderer<GrainState>({
			canvas,
			modules: [createCoreGrainOverlayModule()],
			initialState: baseState,
			contextAttributes: {
				premultipliedAlpha: false,
				alpha: true,
				antialias: false,
				depth: false,
				stencil: false,
				powerPreference: 'high-performance',
				desynchronized: true,
			},
			telemetry: true,
			label: 'core-grain-overlay',
		});

		rendererRef.current = renderer;

		logEvent('grain-overlay', 'mount', 'SUCCESS', {
			theme: themeVariant,
			intensity: adjustedIntensity,
		});

		return () => {
			if (rendererRef.current) {
				rendererRef.current.dispose();
				rendererRef.current = null;
			}
		};
	}, [baseState, themeVariant, adjustedIntensity]);

	// Update state when baseState changes
	useEffect(() => {
		if (!rendererRef.current) return;
		rendererRef.current.setState(baseState);
	}, [baseState]);

	return (
		<canvas
			ref={canvasRef}
			className={`fixed inset-0 pointer-events-none z-1100 ${className}`}
			style={{ width: '100%', height: '100%' }}
		/>
	);
}

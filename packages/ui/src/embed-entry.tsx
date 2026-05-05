import { createRoot } from 'react-dom/client';
import EmbedWidget from './components/EmbedWidget';
import type { PitchClass } from '@musical-symmetry/core';
import './index.css';

const params = new URLSearchParams(window.location.search);
const pcsRaw = params.get('pcs') || '0,4,7';
const pcs = pcsRaw.split(',').map(Number).filter(n => n >= 0 && n <= 11) as PitchClass[];
const style = (params.get('style') || 'orbit') as 'orbit' | 'keyboard';
const interactive = params.get('interactive') !== 'false';
const watermark = params.get('watermark') !== 'false';

const root = createRoot(document.getElementById('widget-root')!);
root.render(
  <EmbedWidget
    initialPcs={pcs}
    style={style}
    interactive={interactive}
    showWatermark={watermark}
  />
);

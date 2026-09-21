/**
 * 汪汪音效 —— Web Audio API 现场合成，零音频文件依赖。
 *
 * 「汪汪」= 两声短促、基频下坠的锯齿波 + 低通滤波，
 * 类似卡通片里的小狗叫。AudioContext 懒创建（首次点击时），
 * iOS 需在用户手势内 resume。
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 播放一声「汪！」（可连呼两声组成「汪汪」） */
function oneWoof(ac: AudioContext, start: number, baseFreq: number, volume: number) {
  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(baseFreq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(90, baseFreq * 0.3), start + 0.12);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, start);
  filter.frequency.exponentialRampToValueAtTime(500, start + 0.13);
  filter.Q.value = 2;

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);

  osc.start(start);
  osc.stop(start + 0.17);
}

/** 「汪汪！」两连叫 */
export function playBark(volume = 0.25): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  oneWoof(ac, now + 0.0, 520, volume);
  oneWoof(ac, now + 0.18, 440, volume * 0.85);
}

/** 开心的小短哼（升级 / 完成动作） */
export function playHappyWhine(volume = 0.2): void {
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(390, now);
  osc.frequency.linearRampToValueAtTime(620, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

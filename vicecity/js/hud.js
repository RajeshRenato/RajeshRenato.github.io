'use strict';
// HUD, menu, overlays

function toast(text, color) {
  Game.toasts.push({ text, color: color || '#fff', t: 3 });
}

function drawObjectiveArrow(ctx) {
  const o = Mission.objectivePoint();
  if (!o) return;
  const dx = o.x - Player.fx(), dy = o.y - Player.fy();
  const d = Math.hypot(dx, dy);
  if (d < 250) return;
  const a = Math.atan2(dy, dx);
  const cx = W / 2, cy = H / 2;
  const rad = Math.min(W, H) / 2 - 70;
  const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = Mission.state === 'deliver' ? '#ffd166' : '#28e0ff';
  ctx.beginPath();
  ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(d / 10) * 10 + 'm', x, y + 26);
}

function drawMinimap(ctx) {
  const S = 148, mx = W - S - 16;
  const my = TouchPad.on ? 52 : H - S - 16;   // on touch the action buttons take the bottom-right corner
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,14,0.85)';
  ctx.fillRect(mx - 3, my - 3, S + 6, S + 6);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(minimapCanvas, mx, my, S, S);
  const k = S / WORLD_W;
  const o = Mission.objectivePoint();
  if (o) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(mx + o.x * k, my + o.y * k, 3 + Math.sin(Game.time * 5), 0, 7);
    ctx.fill();
  }
  for (const c of Game.police) {
    ctx.fillStyle = Math.floor(Game.time * 6) % 2 ? '#ff4356' : '#3b6cff';
    ctx.fillRect(mx + c.x * k - 2, my + c.y * k - 2, 4, 4);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + Player.fx() * k, my + Player.fy() * k, 2.6, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#ff4fa3';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx - 3, my - 3, S + 6, S + 6);
  ctx.restore();
}

function drawMenu(ctx) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,6,30,0.84)');
  g.addColorStop(1, 'rgba(34,6,44,0.84)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'italic bold 84px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = '#ff4fa3';
  ctx.shadowColor = '#ff4fa3';
  ctx.shadowBlur = 26;
  ctx.fillText('VICE CITY', W / 2, H * 0.34);
  ctx.font = '20px monospace';
  ctx.shadowColor = '#28e0ff';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#28e0ff';
  ctx.fillText('an open-world microgame', W / 2, H * 0.34 + 42);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px monospace';
  const lines = [
    'WASD / arrows — move & drive',
    'E — enter / exit car',
    'SPACE — handbrake (drift!)',
    'SHIFT — sprint',
    'V — camera: street view / top-down',
    'M — mute',
    '',
    "Deliver packages. Dodge the cops. Mind the pedestrians... or don't."
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.5 + i * 24));
  if (Math.sin(Game.time * 5) > 0) {
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('— press ENTER or click to start —', W / 2, H * 0.5 + lines.length * 24 + 36);
  }
  ctx.restore();
}

function drawBusted(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic bold 72px "Arial Black", Arial, sans-serif';
  ctx.fillStyle = '#4f8aff';
  ctx.shadowColor = '#4f8aff';
  ctx.shadowBlur = 24;
  ctx.fillText('BUSTED', W / 2, H / 2 - 10);
  ctx.shadowBlur = 0;
  ctx.font = '16px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('They let you off with a fine.', W / 2, H / 2 + 44);
  ctx.restore();
}

function drawHUD(ctx) {
  if (Game.state === 'menu') { drawMenu(ctx); return; }
  ctx.save();
  ctx.textBaseline = 'top';

  // money
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.shadowColor = '#0faf7d';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#7dffc9';
  ctx.fillText('$' + Game.money, 16, 14);
  ctx.shadowBlur = 0;

  // wanted stars (left-to-right fill, anchored to the right edge)
  ctx.font = '26px serif';
  ctx.textAlign = 'left';
  const x0 = W - 16 - 5 * 28;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < Game.wanted ? '#ff4fa3' : 'rgba(255,255,255,0.14)';
    ctx.fillText('★', x0 + i * 28, 12);
  }

  // car condition
  if (Player.inCar) {
    const hp = Player.car.hp / 100;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(16, 48, 120, 7);
    ctx.fillStyle = hp > 0.5 ? '#7dffc9' : hp > 0.25 ? '#ffd166' : '#ff4356';
    ctx.fillRect(16, 48, 120 * hp, 7);
    if (Player.car.wrecked) {
      ctx.font = '13px monospace';
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('This ride is cooked — find another (E)', 16, 62);
    }
  }

  // arrest meter
  if (Game.bustProgress > 0.05) {
    const w2 = 180;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(W / 2 - w2 / 2, 52, w2, 10);
    ctx.fillStyle = '#4f8aff';
    ctx.fillRect(W / 2 - w2 / 2, 52, w2 * clamp(Game.bustProgress / 1.5, 0, 1), 10);
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fc2ff';
    ctx.fillText('DRIVE!', W / 2, 66);
  }

  // mission pill
  const mt = Mission.text();
  if (mt) {
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    const w2 = ctx.measureText(mt).width + 28;
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    rr(ctx, W / 2 - w2 / 2, H - 56, w2, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(mt, W / 2, H - 48);
  }

  drawObjectiveArrow(ctx);
  drawMinimap(ctx);

  // toasts
  ctx.textAlign = 'center';
  for (let i = 0; i < Game.toasts.length; i++) {
    const t = Game.toasts[i];
    ctx.globalAlpha = clamp(t.t, 0, 1);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 10;
    ctx.fillText(t.text, W / 2, H * 0.2 + i * 30);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // control hints / touch pad
  if (TouchPad.on) {
    drawTouchPad(ctx);
  } else {
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(
      Player.inCar
        ? 'WASD drive · SPACE handbrake · E exit · V cam · M mute'
        : (typeof viewMode !== 'undefined' && viewMode === 'street'
          ? 'W/S walk · A/D turn · SHIFT run · E enter car · V cam · M mute'
          : 'WASD walk · SHIFT run · E enter car · V cam · M mute'),
      16, H - 24
    );
  }

  if (Game.state === 'busted') drawBusted(ctx);
  ctx.restore();
}

function drawTouchPad(ctx) {
  const j = TouchPad.joy;
  const jcx = j.active ? j.ax : 96, jcy = j.active ? j.ay : H - 96;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.arc(jcx, jcy, JOY_R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(jcx, jcy, JOY_R, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath(); ctx.arc(jcx + j.dx, jcy + j.dy, 24, 0, 7); ctx.fill();

  const btns = tpButtons();
  for (const k in btns) {
    const b = btns[k];
    const active = k === 'hb' && TouchPad.hb;
    ctx.fillStyle = active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.09)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
    ctx.strokeStyle = k === 'e' ? '#28e0ff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold ' + (b.label.length > 1 ? 12 : 20) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.label, b.x, b.y + 1);
  }
  ctx.textBaseline = 'top';
}

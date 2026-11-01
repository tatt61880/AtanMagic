(function () {
  'use strict';

  const { dataStr, parseData, createLines, sumAngles } = window.AtanMagicMath;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const colors = [
    '#eddbff',
    '#dbdbff',
    '#dbedff',
    '#dbffff',
    '#dbffed',
    '#dbffdb',
    '#edffdb',
    '#ffffdb',
  ];
  const cells = [];
  const elems = {};
  const state = { line: 0, step: 0, elapsed: 0, speed: 2, playing: false };
  let lines;
  let frameId = null;
  let lastTime = null;
  let activeTriangle = null;
  let previousPhase = '';

  function init() {
    for (const id of [
      'line-select',
      'first-line',
      'previous-line',
      'next-line',
      'line-count',
      'drawing-title',
      'board-cells',
      'result',
      'angle-total',
      'pi-total',
      'step-count',
      'phase-info',
      'progress',
      'buttonReset',
      'buttonPlay',
      'step-back',
      'step-forward',
      'buttonSpeedDown',
      'buttonSpeedUp',
      'speed-info',
      'options-omit',
      'options-colorful',
      'options-auto',
      'fraction-list',
      'validation-info',
    ])
      elems[id] = document.getElementById(id);

    const rows = parseData(dataStr);
    lines = createLines(rows);
    if (
      lines.some(
        ({ fractions }) => Math.abs(sumAngles(fractions) - 2 * Math.PI) > 1e-12
      )
    ) {
      throw new Error('角度の和が2πと一致しない列があります。');
    }
    elems['validation-info'].textContent =
      '数値確認：横16行・縦16列・対角線2本のすべてで約360°。表示と確認には浮動小数点計算を使っています。';
    for (const [i, line] of lines.entries()) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = line.label;
      elems['line-select'].appendChild(option);
    }
    buildBoard(rows);
    elems['line-select'].addEventListener('change', () =>
      selectLine(Number(elems['line-select'].value))
    );
    elems['first-line'].addEventListener('click', () => selectLine(0));
    elems['previous-line'].addEventListener('click', () =>
      selectLine(state.line - 1)
    );
    elems['next-line'].addEventListener('click', () =>
      selectLine(state.line + 1)
    );
    elems.buttonPlay.addEventListener('click', togglePlaying);
    elems.buttonReset.addEventListener('click', () => seek(0));
    elems['step-back'].addEventListener('click', () => seek(state.step - 1));
    elems['step-forward'].addEventListener('click', () => seek(state.step + 1));
    elems.progress.addEventListener('input', () =>
      seek(Number(elems.progress.value))
    );
    elems.buttonSpeedDown.addEventListener('click', () => changeSpeed(-1));
    elems.buttonSpeedUp.addEventListener('click', () => changeSpeed(1));
    elems['options-colorful'].addEventListener('change', render);
    elems['options-omit'].addEventListener('change', () => {
      state.elapsed = 0;
      render();
    });
    elems['options-auto'].addEventListener('change', () => {
      if (!elems['options-auto'].checked && state.step === 16) pause();
    });
    document.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
    updateLine();
    updateSpeed();
    render();
  }

  function svg(tag, attributes = {}, text) {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function buildBoard(rows) {
    for (let i = 0; i < 16; i++) {
      elems['board-cells'].appendChild(
        svg(
          'text',
          {
            x: 43 + i * 30,
            y: 16,
            'text-anchor': 'middle',
            'font-size': 10,
            fill: '#576684',
          },
          i + 1
        )
      );
      elems['board-cells'].appendChild(
        svg(
          'text',
          {
            x: 13,
            y: 47 + i * 30,
            'text-anchor': 'middle',
            'font-size': 10,
            fill: '#576684',
          },
          i + 1
        )
      );
    }
    for (const fraction of rows.flat()) {
      const { x, y, numer, denom } = fraction;
      const group = svg('g');
      group.appendChild(
        svg('title', {}, `${y + 1}行${x + 1}列：${numer}/${denom}`)
      );
      const box = svg('rect', {
        x: 28 + x * 30,
        y: 28 + y * 30,
        width: 30,
        height: 30,
        fill: '#ffffff',
        stroke: '#78a092',
        'stroke-width': 0.6,
      });
      group.appendChild(box);
      group.appendChild(
        svg('line', {
          x1: 32 + x * 30,
          y1: 43 + y * 30,
          x2: 54 + x * 30,
          y2: 43 + y * 30,
          stroke: '#182b49',
          'stroke-width': 0.6,
        })
      );
      const numerator = svg(
        'text',
        {
          x: 43 + x * 30,
          y: 39 + y * 30,
          'text-anchor': 'middle',
          'font-size': 10,
        },
        numer
      );
      const denominator = svg(
        'text',
        {
          x: 43 + x * 30,
          y: 54 + y * 30,
          'text-anchor': 'middle',
          'font-size': 10,
        },
        denom
      );
      group.append(numerator, denominator);
      const outline = svg('rect', {
        x: 29 + x * 30,
        y: 29 + y * 30,
        width: 28,
        height: 28,
        fill: 'none',
        stroke: '#285bc7',
        'stroke-width': 1.7,
        visibility: 'hidden',
      });
      group.appendChild(outline);
      elems['board-cells'].appendChild(group);
      cells[y * 16 + x] = { box, numerator, denominator, outline };
    }
  }

  function updateLine() {
    const line = lines[state.line];
    elems['line-select'].value = state.line;
    elems['line-count'].textContent = `${state.line + 1} / ${lines.length}`;
    elems['drawing-title'].textContent = `${line.label}の三角形`;
    elems['previous-line'].disabled = state.line === 0;
    elems['next-line'].disabled = state.line === lines.length - 1;
    elems['fraction-list'].replaceChildren();
    let angle = 0;
    for (const [i, fraction] of line.fractions.entries()) {
      angle += fraction.angle;
      const row = document.createElement('tr');
      for (const value of [
        i + 1,
        `${fraction.y + 1}行 ${fraction.x + 1}列`,
        `${fraction.numer} / ${fraction.denom}`,
        degrees(fraction.angle),
        degrees(angle),
      ]) {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.appendChild(cell);
      }
      elems['fraction-list'].appendChild(row);
    }
  }

  function fixedColor(i) {
    return colors[elems['options-colorful'].checked ? i % colors.length : 0];
  }

  function degrees(radian) {
    return `${((radian * 180) / Math.PI).toFixed(6)}°`;
  }

  function render() {
    activeTriangle = null;
    previousPhase = '';
    elems.result.replaceChildren();
    for (const cell of cells) {
      cell.box.setAttribute('fill', '#ffffff');
      cell.outline.setAttribute('visibility', 'hidden');
      for (const text of [cell.numerator, cell.denominator]) {
        text.setAttribute('fill', '#182b49');
        text.setAttribute('font-weight', 'normal');
      }
    }
    let angle = 0;
    for (const [i, fraction] of lines[state.line].fractions.entries()) {
      const cell = cells[fraction.y * 16 + fraction.x];
      cell.outline.setAttribute('visibility', 'visible');
      if (i < state.step) {
        const triangle = createTriangle(fraction, fixedColor(i));
        triangle.group.setAttribute(
          'transform',
          `rotate(${(-angle * 180) / Math.PI} 260 260)`
        );
        triangle.labels.setAttribute('display', 'none');
        cell.box.setAttribute('fill', fixedColor(i));
        angle += fraction.angle;
      } else if (i === state.step) {
        cell.box.setAttribute('fill', '#fff0a2');
        activeTriangle = createTriangle(fraction, '#fff0a2');
        activeTriangle.angle = angle;
        activeTriangle.cell = cell;
        activeTriangle.fraction = fraction;
      }
    }
    elems['angle-total'].textContent = degrees(angle);
    elems['pi-total'].textContent = `${(angle / Math.PI).toFixed(6)} π rad`;
    elems['step-count'].textContent = `${state.step} / 16`;
    elems.progress.value = state.step;
    elems.progress.setAttribute(
      'aria-valuetext',
      `${state.step}個、角度の合計 ${degrees(angle)}`
    );
    elems['step-back'].disabled = state.step === 0;
    elems['step-forward'].disabled = state.step === 16;
    for (const [i, row] of [...elems['fraction-list'].children].entries()) {
      if (i === state.step) row.setAttribute('aria-current', 'step');
      else row.removeAttribute('aria-current');
    }
    updatePlayButton();
    renderPhase();
    keepActiveCellVisible();
  }

  function keepActiveCellVisible() {
    const fraction = lines[state.line].fractions[Math.min(state.step, 15)];
    const cell =
      cells[fraction.y * 16 + fraction.x].box.getBoundingClientRect();
    const container = document.querySelector('.board-scroll');
    const viewport = container.getBoundingClientRect();
    if (cell.left < viewport.left + 8) {
      container.scrollLeft += cell.left - viewport.left - 8;
    } else if (cell.right > viewport.right - 8) {
      container.scrollLeft += cell.right - viewport.right + 8;
    }
  }

  function createTriangle(fraction, color) {
    const x = 260 + fraction.denom * 0.34;
    const y = 260 - fraction.numer * 0.34;
    const group = svg('g');
    group.appendChild(
      svg('polygon', {
        points: `260,260 ${x},260 ${x},${y}`,
        fill: color,
        stroke: '#33475b',
        'stroke-width': 1,
      })
    );
    const labels = svg('g', {
      'font-size': 15,
      'font-weight': 'bold',
      'text-anchor': 'middle',
    });
    const denom = svg('text', { x: (260 + x) / 2, y: 280 }, fraction.denom);
    const numer = svg(
      'text',
      {
        x: x + 6,
        y: (260 + y) / 2,
        'text-anchor': 'start',
        'dominant-baseline': 'middle',
      },
      fraction.numer
    );
    const edge = svg('line', { stroke: '#bc2539', 'stroke-width': 3 });
    labels.append(denom, numer, edge);
    group.appendChild(labels);
    elems.result.appendChild(group);
    return { group, labels, denom, numer, edge, x, y };
  }

  function phaseName() {
    if (state.step === 16) return 'complete';
    if (elems['options-omit'].checked) return 'omit';
    if (state.elapsed < 1) return 'denom';
    if (state.elapsed < 2) return 'numer';
    return 'rotate';
  }

  function renderPhase() {
    const phase = phaseName();
    const active = activeTriangle;
    if (phase !== previousPhase) {
      previousPhase = phase;
      if (!active) {
        elems['phase-info'].textContent = state.playing
          ? '1周完成！ 次の並びへ進みます'
          : '16個で1周完成（360°）';
        return;
      }
      const { fraction, cell } = active;
      const red = '#bc2539';
      const normal = '#182b49';
      active.denom.setAttribute(
        'fill',
        phase === 'denom' || phase === 'omit' ? red : normal
      );
      active.numer.setAttribute(
        'fill',
        phase === 'numer' || phase === 'omit' ? red : normal
      );
      cell.denominator.setAttribute(
        'fill',
        phase === 'denom' || phase === 'omit' ? red : normal
      );
      cell.numerator.setAttribute(
        'fill',
        phase === 'numer' || phase === 'omit' ? red : normal
      );
      cell.denominator.setAttribute(
        'font-weight',
        phase === 'denom' || phase === 'omit' ? 'bold' : 'normal'
      );
      cell.numerator.setAttribute(
        'font-weight',
        phase === 'numer' || phase === 'omit' ? 'bold' : 'normal'
      );
      active.edge.setAttribute(
        'display',
        phase === 'denom' || phase === 'numer' ? 'inline' : 'none'
      );
      active.edge.setAttribute('x1', phase === 'denom' ? 260 : active.x);
      active.edge.setAttribute('y1', phase === 'denom' ? 260 : active.y);
      active.edge.setAttribute('x2', active.x);
      active.edge.setAttribute('y2', 260);
      const description = {
        denom: `横の辺（分母）${fraction.denom}`,
        numer: `縦の辺（分子）${fraction.numer}`,
        rotate: '三角形を回転して並べる',
        omit: `${fraction.numer}/${fraction.denom} → ${degrees(
          fraction.angle
        )}`,
      }[phase];
      elems['phase-info'].textContent = `${state.step + 1}個目：${description}`;
    }
    if (!active) return;
    const rotation =
      phase === 'omit'
        ? 1
        : phase === 'rotate'
          ? Math.min(1, state.elapsed - 2)
          : 0;
    active.group.setAttribute(
      'transform',
      `rotate(${((-active.angle * 180) / Math.PI) * rotation} 260 260)`
    );
  }

  function updatePlayButton() {
    elems.buttonPlay.textContent = state.playing
      ? 'Ⅱ 一時停止'
      : state.step === 16
        ? '▶ もう一度'
        : '▶ 再生';
    elems.buttonPlay.setAttribute(
      'aria-label',
      state.playing
        ? '一時停止'
        : state.step === 16
          ? '選択中の並びをもう一度再生'
          : '再生'
    );
  }

  function pause() {
    state.playing = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    lastTime = null;
    updatePlayButton();
    previousPhase = '';
    renderPhase();
  }

  function togglePlaying() {
    if (state.playing) {
      pause();
      return;
    }
    if (state.step === 16) {
      state.step = 0;
      state.elapsed = 0;
      render();
    }
    state.playing = true;
    lastTime = null;
    updatePlayButton();
    frameId = requestAnimationFrame(tick);
  }

  function tick(timestamp) {
    frameId = null;
    if (!state.playing) return;
    if (lastTime !== null)
      state.elapsed +=
        Math.min(timestamp - lastTime, 100) / 2 ** (11 - state.speed);
    lastTime = timestamp;
    const duration =
      state.step === 16 ? 2 : elems['options-omit'].checked ? 1 : 3;
    if (state.elapsed >= duration) {
      state.elapsed = 0;
      if (state.step === 16) {
        state.line++;
        state.step = 0;
        updateLine();
      } else {
        state.step++;
      }
      if (
        state.step === 16 &&
        (!elems['options-auto'].checked || state.line === lines.length - 1)
      ) {
        state.playing = false;
        lastTime = null;
      }
      render();
    } else {
      renderPhase();
    }
    if (state.playing) frameId = requestAnimationFrame(tick);
  }

  function seek(step) {
    pause();
    state.step = Math.max(0, Math.min(16, step));
    state.elapsed = 0;
    render();
  }

  function selectLine(index) {
    pause();
    state.line = Math.max(0, Math.min(lines.length - 1, index));
    state.step = 0;
    state.elapsed = 0;
    updateLine();
    render();
  }

  function changeSpeed(delta) {
    state.speed = Math.max(1, Math.min(9, state.speed + delta));
    updateSpeed();
  }

  function updateSpeed() {
    elems['speed-info'].textContent = `速度 ${state.speed} / 9`;
    elems.buttonSpeedDown.disabled = state.speed === 1;
    elems.buttonSpeedUp.disabled = state.speed === 9;
  }

  function keydown(event) {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing ||
      event.target.isContentEditable
    )
      return;
    if (
      event.target.closest(
        'input, select, textarea, button, a, summary, .board-scroll, [role="textbox"]'
      )
    )
      return;
    let action;
    if (event.shiftKey) {
      if (event.key === 'ArrowDown') action = () => changeSpeed(-1);
      if (event.key === 'ArrowUp') action = () => changeSpeed(1);
    } else {
      if (event.key === ' ') action = togglePlaying;
      if (event.key.toLowerCase() === 'r') action = () => seek(0);
      if (event.key === 'ArrowLeft') action = () => seek(state.step - 1);
      if (event.key === 'ArrowRight') action = () => seek(state.step + 1);
    }
    if (action) {
      event.preventDefault();
      action();
    }
  }

  try {
    init();
  } catch (error) {
    const message = document.getElementById('error-message');
    message.textContent = `読み込みに失敗しました。${error.message}`;
    message.hidden = false;
    for (const element of document.querySelectorAll('button, select, input'))
      element.disabled = true;
    console.error(error);
  }
})();

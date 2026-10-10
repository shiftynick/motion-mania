const tokens = text => String(text ?? '').toLowerCase().replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
const round = value => Number(value.toFixed(3));

// Align the whole script in order, so a word that crosses a cut stays with its planned shot.
export function measuredNarration(shots, captions, pad = 0.15) {
  const expected = shots.flatMap((s, shot) => tokens(s.narration).map((text, word) => ({ text, shot, word })));
  const heard = captions.groups.flatMap(g => g.words).flatMap(w => tokens(w.text).map(text => ({ text, start: w.start, end: Number.isFinite(w.end) ? w.end : w.start, hasEnd: Number.isFinite(w.end) })));
  const warnings = [], matched = shots.map(() => []), results = [];
  if (!expected.length) return { shots: results, warnings };
  if ((expected.length + 1) * (heard.length + 1) > 8_000_000) return { shots: results, warnings: ['Narration timing alignment skipped: transcript/script exceed the bounded comparison size; shorten or split the film.'] };
  const width = heard.length + 1, directions = new Uint8Array((expected.length + 1) * width);
  let row = new Uint32Array(width);
  for (let i = 1; i <= expected.length; i++) {
    const next = new Uint32Array(width);
    for (let j = 1; j <= heard.length; j++) {
      if (expected[i - 1].text === heard[j - 1].text) { next[j] = row[j - 1] + 1; directions[i * width + j] = 1; }
      else if (row[j] >= next[j - 1]) { next[j] = row[j]; directions[i * width + j] = 2; }
      else { next[j] = next[j - 1]; directions[i * width + j] = 3; }
    }
    row = next;
  }
  let i = expected.length, j = heard.length;
  while (i && j) {
    const direction = directions[i * width + j];
    if (direction === 1) { matched[expected[i - 1].shot].unshift({ ...heard[j - 1], word: expected[i - 1].word }); i--; j--; }
    else if (direction === 2) i--;
    else j--;
  }
  shots.forEach((shot, index) => {
    const planned = tokens(shot.narration).length, words = matched[index], label = `Shot ${shot.index ?? index + 1} (${shot.name})`;
    if (!planned) return;
    const coverage = words.length / planned;
    if (coverage < 0.8) { warnings.push(`${label}: too few script words align to the transcript (${Math.round(coverage * 100)}%); measured narration bounds are uncertain.`); results.push({ index: shot.index ?? index + 1, coverage: round(coverage) }); return; }
    const boundsComplete = words[0].word === 0 && words.at(-1).word === planned - 1;
    if (!boundsComplete) warnings.push(`${label}: unmatched leading or trailing script words leave the complete speech bounds uncertain; reported times cover aligned words only.`);
    const start = words[0].start, last = words.at(-1), end = last.end, leadingPad = start - shot.from, trailingPad = shot.to - end;
    if (leadingPad < -0.001) warnings.push(`${label}: speech starts ${(-leadingPad).toFixed(2)}s before the shot (${start.toFixed(2)}s).`);
    else if (leadingPad < pad) warnings.push(`${label}: only ${leadingPad.toFixed(2)}s before speech; consider a ${pad.toFixed(2)}s leading pad.`);
    if (!last.hasEnd) warnings.push(`${label}: the last aligned word has no end time; speech overrun and trailing pad cannot be established.`);
    else if (trailingPad < -0.001) warnings.push(`${label}: speech runs ${(-trailingPad).toFixed(2)}s past the shot (${end.toFixed(2)}s).`);
    else if (trailingPad < pad) warnings.push(`${label}: only ${trailingPad.toFixed(2)}s after speech; consider a ${pad.toFixed(2)}s trailing pad.`);
    const measured = { index: shot.index ?? index + 1, coverage: round(coverage), boundsComplete, start: round(start), ...(last.hasEnd ? { end: round(end), trailingPad: round(trailingPad) } : {}), leadingPad: round(leadingPad) };
    if (shot.anchor) {
      const phrase = tokens(shot.anchor.text), positions = [];
      for (let n = 0; n <= words.length - phrase.length; n++) if (phrase.every((text, k) => words[n + k].text === text)) positions.push(words[n].start);
      if (positions.length !== 1) warnings.push(`${label}: anchor "${shot.anchor.text}" ${positions.length ? 'is ambiguous' : 'was not aligned'} in the spoken line; check the transcript.`);
      else {
        const wordAt = positions[0], offset = shot.anchor.at - wordAt, before = shot.anchor.before ?? 1.8, after = shot.anchor.after ?? 0.2;
        measured.anchor = { text: shot.anchor.text, at: shot.anchor.at, wordAt: round(wordAt), offset: round(offset), preferredAt: round(wordAt - 0.6) };
        if (offset < -before - 1e-6 || offset > after + 1e-6) warnings.push(`${label}: visual anchor "${shot.anchor.text}" at ${shot.anchor.at}s is ${offset.toFixed(2)}s from its spoken word at ${wordAt.toFixed(2)}s; heuristic window is ${before}s before to ${after}s after (prefer about 0.6s before).`);
      }
    }
    results.push(measured);
  });
  return { shots: results, warnings };
}

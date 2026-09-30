#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { hf } from './process.js';
import { parseArgs } from 'node:util';
import { plan } from './storyboard.js';
import { initProject, installSkill, loadProject, selectFormats } from './project.js';
import { captureFrame, doctor, parseTimes, prepare, render, review, verify } from './operations.js';
import { audioReport } from './audio.js';
import { pictureReport } from './picture.js';
import { importCaptions } from './captions.js';
import { readStoryboard } from './storyboard.js';

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const help = `Motion Mania ${version} — HyperFrames production helpers

  motion-mania init <directory>                   Create the editable 15s starter
  motion-mania skill <directory>                 Install the agent skill without overwriting
  motion-mania browser                           Download/locate the pinned browser
  motion-mania doctor                            Check required local dependencies
  motion-mania plan                              Check storyboard timing and creative intent
  motion-mania frame --at 4.2                     Capture an exact timestamp
  motion-mania review [--around 3,6.5] [--draft]   Contact sheets, strips, optional MP4
  motion-mania verify                            Backend checks + sampled seek stability
  motion-mania render [--quality looks]           Encode and validate an MP4
  motion-mania audio [--input file]               Loudness, silences, cut accents, waveform
  motion-mania picture [--input file]             Frozen holds, near-black frames, activity chart
  motion-mania captions --input words.json        Import a transcript as burned-in captions
  motion-mania prepare                           Build a directory for HyperFrames Studio

Shared options: --project <directory> (default .), --format <name|all>, --json
Quality: draft | looks | delivery. init refuses nonempty directories.
audio and picture measure out/<format>.mp4 unless --input is given (default target -14 LUFS, -1 dBTP).
captions accepts .json/.srt/.vtt transcripts; --max-words <n> (default 5), --replace.
Edit src/, assets/, and motion.json; generated work lives in .motion/, reviews/, out/.
No model API is invoked. review produces evidence, not a creative verdict.
`;

const raw = process.argv.slice(2);
const wantsJson = raw.includes('--json');
try {
  const { values, positionals } = parseArgs({ args: raw, allowPositionals: true, strict: true, options: {
    project: { type: 'string' }, format: { type: 'string' }, at: { type: 'string' }, around: { type: 'string' },
    quality: { type: 'string' }, draft: { type: 'boolean' }, input: { type: 'string' }, 'max-words': { type: 'string' }, replace: { type: 'boolean' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
  } });
  const command = positionals[0];
  if (values.version) { process.stdout.write(wantsJson ? JSON.stringify({ version }) + '\n' : version + '\n'); }
  else if (values.help || !command) { process.stdout.write(help); }
  else {
    const allowed = { init: [], skill: [], browser: [], doctor: [], plan: ['project'], frame: ['project','format','at'], review: ['project','format','around','draft'], verify: ['project','format'], render: ['project','format','quality'], prepare: ['project','format'], audio: ['project','format','input'], picture: ['project','format','input'], captions: ['project','input','max-words','replace'] };
    if (!allowed[command]) throw new Error(`Unknown command: ${command}`);
    for (const key of Object.keys(values)) if (!['json','help', ...allowed[command]].includes(key)) throw new Error(`--${key} is not supported by ${command}`);
    if (positionals.length !== (['init', 'skill'].includes(command) ? 2 : 1)) throw new Error(['init', 'skill'].includes(command) ? `Usage: motion-mania ${command} <directory>` : 'Unexpected positional argument');
    let result;
    if (command === 'init') result = await initProject(positionals[1]);
    else if (command === 'skill') result = await installSkill(positionals[1]);
    else if (command === 'browser') {
      await hf(['browser', 'ensure']);
      const browser = await hf(['browser', 'path'], { quiet: true });
      result = { ok: true, path: browser.stdout.trim() };
    }
    else if (command === 'doctor') result = await doctor();
    else {
      const project = await loadProject(values.project ?? '.');
      if (command === 'plan') {
        result = await plan(project);
      } else if (command === 'captions') {
        if (values.input === undefined) throw new Error('captions requires --input <transcript.json|.srt|.vtt>');
        const maxWords = values['max-words'] === undefined ? 5 : Number(values['max-words']);
        const storyboard = await readStoryboard(project, { optional: true });
        result = { command, project: project.root, ...await importCaptions(project, values.input, { maxWords, replace: values.replace, shots: storyboard?.shots }) };
      } else {
        const formats = selectFormats(project, values.format);
        if (['audio', 'picture'].includes(command) && values.input !== undefined && formats.length > 1) throw new Error('--input analyzes one file; choose a single --format for its label');
        if (command === 'frame' && values.at === undefined) throw new Error('frame requires --at <seconds>');
        const at = command === 'frame' ? parseTimes(values.at, project.manifest.duration) : [];
        if (at.length > 1) throw new Error('frame accepts one timestamp; use review for multiple frames');
        const around = values.around === undefined ? undefined : parseTimes(values.around, project.manifest.duration);
        const results = [];
        for (const format of formats) {
          const handlers = {
            frame: () => captureFrame(project, format, at[0]),
            review: () => review(project, format, { around, draft: values.draft }),
            verify: () => verify(project, format),
            render: () => render(project, format, values.quality),
            prepare: () => prepare(project, format),
            audio: () => audioReport(project, format, values.input),
            picture: () => pictureReport(project, format, values.input),
          };
          results.push(await handlers[command]());
        }
        result = { ok: results.every(r => r.ok), command, project: project.root, results };
      }
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (!result.ok) process.exitCode = 1;
  }
} catch (error) {
  const result = { ok: false, error: error.message };
  (wantsJson ? process.stdout : process.stderr).write(wantsJson ? JSON.stringify(result) + '\n' : `Motion Mania: ${error.message}\n`);
  process.exitCode = 1;
}

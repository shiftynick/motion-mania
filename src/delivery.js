import { open, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { probe, run } from './process.js';

export function atomHeader(buffer, offset = 0, fileSize = buffer.length) {
  if (buffer.length - offset < 8) throw new Error('Truncated MP4 atom header');
  const short = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8);
  if (short === 1 && buffer.length - offset < 16) throw new Error('Truncated extended MP4 atom header');
  const size = short === 1 ? Number(buffer.readBigUInt64BE(offset + 8)) : short || fileSize - offset;
  if (!Number.isSafeInteger(size) || size < (short === 1 ? 16 : 8)) throw new Error('Invalid MP4 atom size');
  return { type, size };
}

export async function mp4Atoms(file) {
  const handle = await open(file), atoms = [];
  try {
    const { size } = await handle.stat();
    for (let offset = 0; offset < size;) {
      const header = Buffer.alloc(16), { bytesRead } = await handle.read(header, 0, 16, offset);
      const atom = atomHeader(header.subarray(0, bytesRead), 0, size - offset);
      if (offset + atom.size > size) throw new Error('Truncated MP4 atom');
      atoms.push({ ...atom, offset });
      offset += atom.size;
    }
  } finally { await handle.close(); }
  return atoms;
}

export function deliveryFindings(metadata, manifest, dimensions, atoms) {
  const videos = metadata.streams?.filter(s => s.codec_type === 'video') ?? [], audio = metadata.streams?.filter(s => s.codec_type === 'audio') ?? [];
  const video = videos[0], errors = [], warnings = [];
  const [n, d] = String(video?.avg_frame_rate).split('/').map(Number), fps = d ? n / d : NaN;
  const duration = Number(video?.duration ?? metadata.format?.duration), containerDuration = Number(metadata.format?.duration);
  const tolerance = Math.max(0.1, 2 / manifest.fps);
  if (videos.length !== 1) errors.push('Delivery must contain exactly one video stream.');
  if (!video || video.width !== dimensions.width || video.height !== dimensions.height) errors.push('Export dimensions do not match motion.json.');
  if (!Number.isFinite(fps) || Math.abs(fps - manifest.fps) > 0.01) errors.push('Export frame rate does not match motion.json.');
  if (!Number.isFinite(duration) || Math.abs(duration - manifest.duration) > tolerance || !Number.isFinite(containerDuration) || Math.abs(containerDuration - manifest.duration) > tolerance) errors.push('Export video/container duration does not match motion.json.');
  if (manifest.audioRequired && !audio.length) errors.push('Expected audio, but the export has no audio stream.');
  if (video && (video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p')) warnings.push(`Delivery prefers H.264/yuv420p; found ${video.codec_name}/${video.pix_fmt}. Re-encoding is required to change this.`);
  const color = Object.fromEntries(['color_primaries', 'color_transfer', 'color_space', 'color_range'].map(k => [k, video?.[k] ?? null]));
  const targets = { color_primaries: 'bt709', color_transfer: 'bt709', color_space: 'bt709', color_range: 'tv' };
  const missing = k => !color[k] || ['unknown', 'unspecified'].includes(color[k]);
  const colorMissing = Object.keys(targets).some(missing), colorConflict = Object.keys(targets).some(k => !missing(k) && color[k] !== targets[k]);
  if (colorMissing || colorConflict) warnings.push(`Delivery prefers BT.709 primaries/transfer/matrix and TV range; found ${JSON.stringify(color)}.${colorConflict ? ' Explicit colour tags are preserved; retagging is not a colour conversion.' : ' Missing tags can be repaired for a known SDR render.'}`);
  const moov = atoms.find(a => a.type === 'moov'), mdat = atoms.find(a => a.type === 'mdat');
  if (!moov || !mdat) errors.push('MP4 is missing a moov or mdat atom.');
  const faststart = !!moov && !!mdat && moov.offset < mdat.offset;
  if (!faststart && moov && mdat) warnings.push('MP4 is not faststart: moov follows mdat.');
  if (audio.length && (audio.length !== 1 || audio[0].codec_name !== 'aac')) warnings.push(`Delivery prefers one AAC stream; found ${audio.length} audio stream(s): ${audio.map(s => s.codec_name).join(', ')}.`);
  for (const stream of audio) if (Number.isFinite(Number(stream.duration)) && Math.abs(Number(stream.duration) - manifest.duration) > tolerance) warnings.push('Audio stream duration does not match the film; inspect the ending.');
  return { ok: !errors.length, video: { codec: video?.codec_name, pixelFormat: video?.pix_fmt, width: video?.width, height: video?.height, fps: Number.isFinite(fps) ? fps : null, duration: Number.isFinite(duration) ? duration : null, ...color }, audio: audio.map(s => ({ codec: s.codec_name, channels: s.channels, duration: s.duration == null ? null : Number(s.duration) })), faststart, errors, warnings, repairableColor: !!video && video.codec_name === 'h264' && video.pix_fmt === 'yuv420p' && colorMissing && !colorConflict };
}

// Only known renderer output is eligible for missing SDR tag repair. Explicit alternate
// colour spaces/ranges are never relabelled: changing their pixels needs re-encoding.
export async function preflightDelivery(file, manifest, dimensions) {
  const inspect = async target => deliveryFindings(await probe(target), manifest, dimensions, await mp4Atoms(target));
  let result = await inspect(file);
  if (!result.ok) throw new Error(result.errors.join(' '));
  const repairs = [];
  if (!result.faststart || result.repairableColor) {
    const temp = path.join(path.dirname(file), `.delivery-${randomUUID()}.mp4`);
    try {
      const args = ['-hide_banner', '-v', 'error', '-y', '-i', file, '-map', '0', '-c', 'copy', '-movflags', '+faststart'];
      if (result.repairableColor) args.push('-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv');
      args.push(temp);
      await run('ffmpeg', args, { quiet: true });
      const repaired = await inspect(temp);
      if (!repaired.ok || !repaired.faststart || result.repairableColor && repaired.repairableColor) throw new Error(`Delivery remux validation failed: ${repaired.errors.join(' ') || repaired.warnings.join(' ')}`);
      if (!result.faststart) repairs.push('faststart');
      if (result.repairableColor) repairs.push('bt709-tv-tags');
      await rename(temp, file);
      result = repaired;
    } finally { await rm(temp, { force: true }); }
  }
  return { ...result, repairs, scope: 'Metadata and container checks only. Stream-copy repairs do not re-encode pixels or audio; tags do not establish colour accuracy, and stream presence does not establish sound quality.' };
}

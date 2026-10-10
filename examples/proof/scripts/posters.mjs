// Extract the final lockup from the actual mastered, encoded exports.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),out=fileURLToPath(new URL('../out/',import.meta.url));
for(const format of ['landscape','vertical']){
  await exec('ffmpeg',['-v','error','-y','-ss','38.7','-i',`${out}${format}.mp4`,'-frames:v','1',`${out}poster-${format}.png`]);
}

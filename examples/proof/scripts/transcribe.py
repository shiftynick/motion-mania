"""Transcribe the assembled read with genuine ASR word timestamps."""
import json,pathlib
from faster_whisper import WhisperModel
root=pathlib.Path(__file__).resolve().parents[1]
model=WhisperModel('small.en',device='cpu',compute_type='int8')
segments,info=model.transcribe(str(root/'assets/narration.wav'),word_timestamps=True,vad_filter=True,beam_size=5)
words=[]
for s in segments:
 for w in s.words: words.append({'text':w.word.strip(),'start':round(w.start,3),'end':round(w.end,3),'probability':round(w.probability,4)})
(root/'transcript.json').write_text(json.dumps({'engine':'faster-whisper 1.2.1','model':'small.en','language':info.language,'words':words},indent=2)+'\n')
print(json.dumps(words,indent=2))

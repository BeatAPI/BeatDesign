import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildTimelineAudioMixFilter } from './timeline-audio-filter';

const ffmpeg = process.env.BEATDESIGN_FFMPEG?.trim() || 'ffmpeg';
const available = spawnSync(ffmpeg,['-version'],{stdio:'ignore'}).status === 0;
function render(count:number, overlap=false) {
  const args=['-hide_banner','-loglevel','error'];
  for(let i=0;i<count;i++)args.push('-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1');
  const filters=Array.from({length:count},(_,i)=>`[${i}:a]volume=${overlap?10:1},adelay=${overlap?0:i*1000}:all=1[a${i}]`);
  filters.push(Array.from({length:count},(_,i)=>`[a${i}]`).join('')+buildTimelineAudioMixFilter(count,overlap?1:count)+'[out]');
  args.push('-filter_complex',filters.join(';'),'-map','[out]','-ac','1','-c:a','pcm_f32le','-f','f32le','pipe:1');
  const result=spawnSync(ffmpeg,args,{maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stderr?.toString());
  const samples=new Float32Array(result.stdout.buffer.slice(result.stdout.byteOffset,result.stdout.byteOffset+result.stdout.byteLength));
  return samples;
}
function rms(samples:Float32Array,start:number,end:number) {
  let sum=0;for(let i=start;i<end;i++)sum+=samples[i]**2;
  return Math.sqrt(sum/(end-start));
}

test('sequential delayed clips retain unity gain as later inputs are added',{skip:!available},()=>{
  const one=render(1),three=render(3),expected=rms(one,4800,43200);
  assert.ok(expected>0.08);
  for(let i=0;i<3;i++)assert.ok(Math.abs(rms(three,48000*i+4800,48000*i+43200)-expected)<0.0001);
  assert.equal(three.length,3*48000);
});

test('overlapping loud clips are limited without automatic makeup or timeline delay',{skip:!available},()=>{
  const samples=render(2,true);
  let peak=0;for(const sample of samples)peak=Math.max(peak,Math.abs(sample));
  assert.ok(peak<=0.951 && peak>0.90,`Peak was ${peak}`);
  assert.equal(samples.length,48000);
});

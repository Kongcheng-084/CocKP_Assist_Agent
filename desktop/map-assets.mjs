import crypto from 'node:crypto';
export function checkedPng(value){
  const bytes=Buffer.from(value||[]);
  if(bytes.length<33||bytes.length>6*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw Error('底图必须是 6 MB 以内的 PNG 图片。');
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  if(!width||!height||width>4096||height>4096||width*height>8000000)throw Error('底图像素过大，请裁切后重试。');
  return {bytes,id:crypto.createHash('sha256').update(bytes).digest('hex'),width,height};
}

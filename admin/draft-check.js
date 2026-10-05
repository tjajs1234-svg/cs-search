/* Detect explicit template blanks, not ordinary brackets, URLs or model names. */
(function(root){
 'use strict';
 function find(text){
  const s=String(text||''),out=[];
  const re=/(?<![A-Za-z0-9])(?:[OoＯ○〇]{1,4}\s*(?:월|일|시|분|원|개|명)(?:까지)?|[OoＯ○〇]{2,4}(?:님)?)(?![A-Za-z0-9])|\[(?:확인된 사실|고객명|고객 이름|주문번호|상품명|제품명|날짜|금액|내용 입력)\]/g;
  const urls=[...s.matchAll(/https?:\/\/[^\s<>]+/gi)].map(m=>[m.index,m.index+m[0].length]);
  for(const m of s.matchAll(re)){if(urls.some(([a,b])=>m.index>=a&&m.index<b))continue;out.push({text:m[0],start:m.index,end:m.index+m[0].length});}
  return out;
 }
 const api={find};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.DraftCheck=api;
})(typeof globalThis!=='undefined'?globalThis:this);

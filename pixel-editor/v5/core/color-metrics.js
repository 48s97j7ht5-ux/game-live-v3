const clamp01=v=>Math.max(0,Math.min(1,v));

export function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let h=0,s=0;
  const l=(max+min)/2;
  if(d){
    s=d/(1-Math.abs(2*l-1));
    if(max===r)h=((g-b)/d)%6;
    else if(max===g)h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h=(h*60+360)%360;
  }
  return{h,s:clamp01(s||0),l:clamp01(l)};
}

export function luma(r,g,b){
  return(0.2126*r+0.7152*g+0.0722*b)/255;
}

export function hueDistance(a,b){
  const d=Math.abs(a-b)%360;
  return Math.min(d,360-d)/180;
}

export function signedHueDelta(a,b){
  let d=(a-b+540)%360-180;
  return d/180;
}

export function rgbDistance(a,b){
  const dr=(a.r-b.r)/255,dg=(a.g-b.g)/255,db=(a.b-b.b)/255;
  return Math.sqrt(dr*dr+dg*dg+db*db)/Math.sqrt(3);
}

export function describeColor(r,g,b){
  const hsl=rgbToHsl(r,g,b);
  return{r,g,b,h:hsl.h,s:hsl.s,l:hsl.l,y:luma(r,g,b)};
}

export function paletteMatchScore(source,candidate){
  const dy=Math.abs(source.y-candidate.y);
  const ds=Math.abs(source.s-candidate.s);
  const dh=(source.s<0.08||candidate.s<0.08)?0:hueDistance(source.h,candidate.h);
  const drgb=rgbDistance(source,candidate);

  let score=dy*0.45+dh*0.35+ds*0.15+drgb*0.05;
  if(dy>0.18)score+=(dy-0.18)*0.75;
  if(source.s<0.16&&candidate.s>0.28)score+=(candidate.s-0.28)*0.55;
  return score;
}

export function localContrastMatchScore(source,sourceBase,candidate,paletteBase){
  const sourceDy=source.y-sourceBase.y;
  const candidateDy=candidate.y-paletteBase.y;
  const sourceDs=source.s-sourceBase.s;
  const candidateDs=candidate.s-paletteBase.s;

  const dContrast=Math.abs(sourceDy-candidateDy);
  const dSatRelation=Math.abs(sourceDs-candidateDs);

  let dHueRelation=0;
  if(source.s>=0.08&&sourceBase.s>=0.08&&candidate.s>=0.08&&paletteBase.s>=0.08){
    dHueRelation=Math.abs(signedHueDelta(source.h,sourceBase.h)-signedHueDelta(candidate.h,paletteBase.h));
    dHueRelation=Math.min(1,dHueRelation);
  }

  // Absolute similarity still matters, but local light/shadow relationship matters more.
  let score=paletteMatchScore(source,candidate)*0.28+dContrast*0.52+dHueRelation*0.12+dSatRelation*0.08;

  // Never casually invert a visible highlight into a shadow or vice versa.
  if(Math.abs(sourceDy)>0.025&&sourceDy*candidateDy<0)score+=0.34+Math.abs(sourceDy-candidateDy)*0.8;

  // Preserve stronger highlights/shadows with extra emphasis on their contrast magnitude.
  if(Math.abs(sourceDy)>0.08)score+=Math.abs(Math.abs(sourceDy)-Math.abs(candidateDy))*0.55;

  return score;
}

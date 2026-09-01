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

  // Main perceptual balance: preserve brightness first, then hue, then saturation.
  let score=dy*0.45+dh*0.35+ds*0.15+drgb*0.05;

  // Strong brightness guard: dark pixels should not jump into noticeably lighter colors.
  if(dy>0.18)score+=(dy-0.18)*0.75;

  // Preserve near-neutral pixels; do not let gray/brown shadows become vivid colors.
  if(source.s<0.16&&candidate.s>0.28)score+=(candidate.s-0.28)*0.55;

  // For muted warm dark colors (the brown/orange zone), strongly discourage a jump
  // into highly saturated yellow while still allowing normal warm progression.
  const warm=source.h>=15&&source.h<=65;
  if(warm&&source.y<0.55&&source.s<0.62&&candidate.h>=48&&candidate.h<=72&&candidate.s>source.s+0.16){
    score+=0.16+(candidate.s-source.s)*0.35;
  }

  return score;
}

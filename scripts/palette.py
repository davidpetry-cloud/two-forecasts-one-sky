import math
def oklch_to_srgb(L,C,h):
    a=C*math.cos(math.radians(h)); b=C*math.sin(math.radians(h))
    l_=L+0.3963377774*a+0.2158037573*b; m_=L-0.1055613458*a-0.0638541728*b; s_=L-0.0894841775*a-1.2914855480*b
    l,m,s=l_**3,m_**3,s_**3
    r=4.0767416621*l-3.3077115913*m+0.2309699292*s; g=-1.2684380046*l+2.6097574011*m-0.3413193965*s; bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s
    f=lambda x: 12.92*x if x<=0.0031308 else 1.055*x**(1/2.4)-0.055
    rgb=[min(1,max(0,f(v))) for v in (r,g,bb)]
    return rgb
def hexof(rgb): return '#'+''.join(f'{round(v*255):02X}' for v in rgb)
def lum(rgb):
    lin=lambda c: c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
    r,g,b=[lin(v) for v in rgb]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    la,lb=lum(a),lum(b); return (max(la,lb)+0.05)/(min(la,lb)+0.05)
T={
 # Media Lab style (David, 5 Nov 2026): near-black and off-white, flat, color only in the data.
 'light':dict(paper=(0.925,0.015,85),card=(0.955,0.012,85),line=(0.80,0.012,85),text=(0.21,0.005,260),ink=(0.17,0.005,260),muted=(0.42,0.006,260),edge=(0.50,0.006,260),
   header=(0.17,0.005,260),btn=(0.17,0.005,260),btnh=(0.30,0.005,260),btntext=(0.96,0.008,90),ai=(0.40,0.10,252),phys=(0.45,0.11,52),link=(0.17,0.005,260),amber=(0.80,0.13,70),mark=(0.17,0.005,260),focus=(0.56,0.14,58),ondark=(0.96,0.008,90),hsub=(0.80,0.006,260)),
 'dark':dict(paper=(0.17,0.005,260),card=(0.215,0.005,260),line=(0.33,0.005,260),text=(0.94,0.008,90),ink=(0.97,0.008,90),muted=(0.74,0.006,260),edge=(0.56,0.006,260),
   header=(0.17,0.005,260),btn=(0.94,0.008,90),btnh=(0.86,0.008,90),btntext=(0.17,0.005,260),ai=(0.80,0.08,252),phys=(0.80,0.10,62),link=(0.97,0.008,90),amber=(0.80,0.13,70),mark=(0.97,0.008,90),focus=(0.80,0.13,70),ondark=(0.96,0.008,90),hsub=(0.80,0.006,260)),
}
PAIRS=[('text','paper',4.5),('text','card',4.5),('ink','paper',4.5),('ink','card',4.5),('muted','paper',4.5),('muted','card',4.5),('ai','card',4.5),('phys','card',4.5),('link','paper',4.5),('link','card',4.5),
 ('ondark','header',4.5),('hsub','header',4.5),('btntext','btn',4.5),('btntext','btnh',4.5),('edge','header',3),('muted','line',3),('focus','paper',3),('focus','card',3),('focus','header',3),('edge','card',3),('edge','paper',3),('ai','paper',3),('phys','paper',3),('mark','paper',3),('amber','header',3),('text','line',4.5)]
for th,t in T.items():
    rgb={k:oklch_to_srgb(*v) for k,v in t.items()}
    print(f'== {th}  ' + '  '.join(f'{k}={hexof(v)}' for k,v in rgb.items()))
    bad=0
    for a,b,need in PAIRS:
        r=cr(rgb[a],rgb[b]); ok=r>=need; bad+= not ok
        if not ok or th: print(f'   {a:7}/{b:7} {r:5.2f} {"ok" if ok else "FAIL"} (need {need})')
    print('   failures:',bad)

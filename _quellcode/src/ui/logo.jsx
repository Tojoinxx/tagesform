export const LOGO_SVG = (size = 64) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1fd185"/><stop offset="1" stop-color="#0b9b63"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#g)"/><path d="M10 35h10l5-11 8 22 6-15 4 6h11" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function Logo({ size = 40 }) {
  return <span class="logo" style={{ width: size + 'px', height: size + 'px' }} dangerouslySetInnerHTML={{ __html: LOGO_SVG(size) }} />;
}

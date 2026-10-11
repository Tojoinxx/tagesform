import { useEffect, useState } from 'preact/hooks';

const parse = () => {
  const h = (location.hash || '#/').slice(1) || '/';
  const [path, qs] = h.split('?');
  return { path: path || '/', query: Object.fromEntries(new URLSearchParams(qs || '')) };
};

export function useRoute() {
  const [r, setR] = useState(parse());
  useEffect(() => {
    const on = () => {
      setR(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export const nav = (path) => {
  location.hash = '#' + path;
};

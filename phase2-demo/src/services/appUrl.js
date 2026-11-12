// Hash routing keeps the document directory stable. Relative URLs therefore
// work both at / and at /ship/ without rebuilding or a global fetch override.
export function appUrl(path, base=import.meta.env?.BASE_URL||'./') {
 const value=String(path||'')
 if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value))return value
 return (base.endsWith('/')?base:base+'/')+value.replace(/^(?:\.\/|\/)+/,'')
}

// CSS variables resolve relative url() values against the stylesheet URL.
// Anchor dynamic style assets to the document, not dist/assets/*.css.
export function appStyleUrl(path, documentUrl=globalThis.document?.baseURI) {
 return new URL(appUrl(path),documentUrl).href
}

// Knowledge HTML is generated from repository documents, outside Vite's asset
// transform. Rebase its local links/images at display time, leaving external
// links, data URLs and in-document anchors intact.
export function appHtml(html, base=import.meta.env?.BASE_URL||'./') {
 return String(html||'').replace(/\b(src|href)\s*=\s*(["'])\/(?!\/)([^"']*)\2/gi,
  (_match,attribute,quote,path)=>`${attribute}=${quote}${appUrl('/'+path,base)}${quote}`)
}

export function reviewFilename(sku:string){const safe=sku.normalize("NFKC").replace(/[^\p{L}\p{N}_.-]/gu,"_").replace(/^\.+/,"").slice(0,100);return (safe||"product")+".html";}

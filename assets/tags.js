function t(r){return Array.from(new Set(r.split(/[,\s]+/).map(e=>e.trim().toLowerCase().replace(/^#/,"")).filter(e=>/^[a-z0-9][a-z0-9_-]{0,30}$/.test(e))))}export{t as p};

"use strict";(()=>{var a={};a.id=120,a.ids=[120],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},22367:(a,e,o)=>{o.r(e),o.d(e,{originalPathname:()=>f,patchFetch:()=>R,requestAsyncStorage:()=>d,routeModule:()=>E,serverHooks:()=>N,staticGenerationAsyncStorage:()=>m});var t={};o.r(t),o.d(t,{GET:()=>T,POST:()=>p,dynamic:()=>l,runtime:()=>n});var r=o(87916),s=o(49930),c=o(2169),i=o(4389),u=o(27191);let n="nodejs",l="force-dynamic";async function p(a){try{let{cpf:e,situacao:o,observacao:t}=await a.json();if(!e||!o)return i.NextResponse.json({ok:!1,error:"CPF e situa\xe7\xe3o s\xe3o obrigat\xf3rios"},{status:400});let r=String(e).replace(/\D/g,"").slice(-11);if(11!==r.length)return i.NextResponse.json({ok:!1,error:"CPF inv\xe1lido"},{status:400});return await u.Z.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS colaborador_situacao_meta (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        cpf TEXT NOT NULL,
        situacao TEXT NOT NULL,
        observacao TEXT,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(cpf)
      );
      CREATE INDEX IF NOT EXISTS idx_csm_cpf ON colaborador_situacao_meta(cpf);
    `),await u.Z.$executeRawUnsafe(`
      INSERT INTO colaborador_situacao_meta (cpf, situacao, observacao)
      VALUES ($1, $2, $3)
      ON CONFLICT (cpf) 
      DO UPDATE SET 
        situacao = EXCLUDED.situacao,
        observacao = EXCLUDED.observacao,
        atualizado_em = NOW()
    `,r,o,t||null),i.NextResponse.json({ok:!0})}catch(a){return console.error("[colaboradores/situacao-meta] Erro:",a),i.NextResponse.json({ok:!1,error:String(a?.message||a)},{status:500})}}async function T(a){try{let e=new URL(a.url),o=e.searchParams.get("cpf"),t=e.searchParams.get("cpfs");if(await u.Z.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS colaborador_situacao_meta (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        cpf TEXT NOT NULL,
        situacao TEXT NOT NULL,
        observacao TEXT,
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(cpf)
      );
      CREATE INDEX IF NOT EXISTS idx_csm_cpf ON colaborador_situacao_meta(cpf);
    `),o){let a=String(o).replace(/\D/g,"").slice(-11),e=await u.Z.$queryRawUnsafe(`
        SELECT cpf, situacao, observacao, atualizado_em
        FROM colaborador_situacao_meta
        WHERE cpf = $1
      `,a);return i.NextResponse.json({ok:!0,situacao:e[0]||null})}if(t){let a=String(t).split(",").map(a=>String(a).replace(/\D/g,"").slice(-11)).filter(a=>11===a.length);if(0===a.length)return i.NextResponse.json({ok:!0,situacoes:{}});let e=await u.Z.$queryRawUnsafe(`
        SELECT cpf, situacao, observacao, atualizado_em
        FROM colaborador_situacao_meta
        WHERE cpf = ANY($1::text[])
      `,a),o={};for(let a of e)o[a.cpf]={situacao:a.situacao,observacao:a.observacao,atualizado_em:a.atualizado_em};return i.NextResponse.json({ok:!0,situacoes:o})}return i.NextResponse.json({ok:!0,situacoes:{}})}catch(a){return console.error("[colaboradores/situacao-meta] Erro GET:",a),i.NextResponse.json({ok:!1,error:String(a?.message||a)},{status:500})}}let E=new r.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/colaboradores/situacao-meta/route",pathname:"/api/colaboradores/situacao-meta",filename:"route",bundlePath:"app/api/colaboradores/situacao-meta/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/colaboradores/situacao-meta/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:d,staticGenerationAsyncStorage:m,serverHooks:N}=E,f="/api/colaboradores/situacao-meta/route";function R(){return(0,c.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:m})}},27191:(a,e,o)=>{o.d(e,{Z:()=>r});var t=o(53524);let r=globalThis.prisma??new t.PrismaClient({log:["error"]})},87916:(a,e,o)=>{a.exports=o(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var o=a=>e(e.s=a),t=e.X(0,[2035,4389],()=>o(22367));module.exports=t})();
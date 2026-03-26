"use strict";(()=>{var e={};e.id=1246,e.ids=[1246],e.modules={53524:e=>{e.exports=require("@prisma/client")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},84770:e=>{e.exports=require("crypto")},92761:e=>{e.exports=require("node:async_hooks")},6005:e=>{e.exports=require("node:crypto")},87561:e=>{e.exports=require("node:fs")},49411:e=>{e.exports=require("node:path")},42410:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>L,patchFetch:()=>f,requestAsyncStorage:()=>m,routeModule:()=>N,serverHooks:()=>_,staticGenerationAsyncStorage:()=>I});var r={};a.r(r),a.d(r,{POST:()=>x,runtime:()=>E});var o=a(87916),i=a(49930),s=a(2169),n=a(4389),d=a(27191),p=a(46236),c=a(29900),u=a(84770);let E="nodejs";async function T(){let{userId:e}=await (0,p.I)();if(!e)throw Error("UNAUTHENTICATED");let t=await (0,c.a)(),a=t?.primaryEmailAddress?.emailAddress?.toLowerCase()||"";if("jonathan.alves@emserh.ma.gov.br"!==a)throw Error("FORBIDDEN");return{userId:e,email:a}}async function l(){await d.Z.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_spci_raw (
      id BIGSERIAL PRIMARY KEY,
      batch_id UUID NOT NULL,
      row_no INTEGER NOT NULL,
      data JSONB NOT NULL,
      source_file TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `),await d.Z.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_spci_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `),await d.Z.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_spci (
      id BIGSERIAL PRIMARY KEY,
      unidade TEXT,
      regional TEXT,
      tipo_extintor TEXT,
      capacidade TEXT,
      localizacao TEXT,
      data_vencimento DATE,
      ultima_inspecao DATE,
      proxima_inspecao DATE,
      status TEXT,
      numero_serie TEXT,
      fabricante TEXT,
      observacoes TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `),await d.Z.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION apply_spci_batch(p_batch UUID)
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO stg_spci (
        unidade, regional, tipo_extintor, capacidade, localizacao,
        data_vencimento, ultima_inspecao, proxima_inspecao, status,
        numero_serie, fabricante, observacoes, last_batch_id, updated_at
      )
      SELECT
        NULLIF(TRIM(data->>'Unidade' || data->>'unidade' || data->>'UNIDADE'), '')::text,
        NULLIF(TRIM(data->>'Regional' || data->>'regional' || data->>'REGIONAL'), '')::text,
        NULLIF(TRIM(data->>'Tipo de Extintor' || data->>'Tipo Extintor' || data->>'tipo_extintor'), '')::text,
        NULLIF(TRIM(data->>'Capacidade' || data->>'capacidade'), '')::text,
        NULLIF(TRIM(data->>'Localiza\xe7\xe3o' || data->>'Localizacao' || data->>'localizacao'), '')::text,
        CASE
          WHEN data->>'Data Vencimento' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data Vencimento')::date
          WHEN data->>'Data Vencimento' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Data Vencimento', 'DD/MM/YYYY')
          ELSE NULL
        END,
        CASE
          WHEN data->>'\xdaltima Inspe\xe7\xe3o' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'\xdaltima Inspe\xe7\xe3o')::date
          WHEN data->>'\xdaltima Inspe\xe7\xe3o' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'\xdaltima Inspe\xe7\xe3o', 'DD/MM/YYYY')
          ELSE NULL
        END,
        CASE
          WHEN data->>'Pr\xf3xima Inspe\xe7\xe3o' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Pr\xf3xima Inspe\xe7\xe3o')::date
          WHEN data->>'Pr\xf3xima Inspe\xe7\xe3o' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Pr\xf3xima Inspe\xe7\xe3o', 'DD/MM/YYYY')
          ELSE NULL
        END,
        NULLIF(TRIM(data->>'Status' || data->>'status'), '')::text,
        NULLIF(TRIM(data->>'N\xfamero de S\xe9rie' || data->>'Numero Serie' || data->>'numero_serie'), '')::text,
        NULLIF(TRIM(data->>'Fabricante' || data->>'fabricante'), '')::text,
        NULLIF(TRIM(data->>'Observa\xe7\xf5es' || data->>'Observacoes' || data->>'observacoes'), '')::text,
        batch_id,
        now()
      FROM stg_spci_raw
      WHERE batch_id = p_batch
      ON CONFLICT DO NOTHING;
    END;
    $$ LANGUAGE plpgsql
  `)}async function x(e){try{let{email:t}=await T(),r=(await e.formData()).get("file");if(!r)return n.NextResponse.json({ok:!1,error:"Envie um arquivo .xlsx ou .csv"},{status:400});let o=(r.name||"spci").toLowerCase(),i=Buffer.from(await r.arrayBuffer());await l();let s=[];if(o.endsWith(".xlsx"))try{let e=await a.e(1063).then(a.bind(a,81063)),t=e.read(i,{type:"buffer"}),r=t.Sheets[t.SheetNames[0]];s=e.utils.sheet_to_json(r,{defval:""})}catch(e){return n.NextResponse.json({ok:!1,error:"Erro ao ler arquivo Excel. Tente salvar como CSV UTF-8."},{status:400})}else{let e=i.toString("utf8");s=function(e){let t=e.split(/\r?\n/).filter(e=>e.length>0);if(0===t.length)return{headers:[],rows:[]};let a=e=>{let t=[],a="",r=!1;for(let o=0;o<e.length;o++){let i=e[o];'"'===i?r&&'"'===e[o+1]?(a+='"',o++):r=!r:","!==i||r?a+=i:(t.push(a),a="")}return t.push(a),t},r=a(t[0]).map(e=>e.trim()),o=t.slice(1).map(e=>{let t=a(e),o={};return r.forEach((e,a)=>{o[e]=(t[a]??"").trim()}),o});return{headers:r,rows:o}}(e).rows}if(!s.length)return n.NextResponse.json({ok:!1,error:"Arquivo vazio"},{status:400});let p=(0,u.randomUUID)(),c=r.name||"upload",E=t||"admin",x=0;for(let e=0;e<s.length;e+=500){let t=s.slice(e,e+500),a=t.map((t,a)=>{let r=e+a+1,o=JSON.stringify(t).replace(/'/g,"''");return`('${p}'::uuid, ${r}, '${o}'::jsonb, '${c}', '${E}')`}).join(",\n"),r=`INSERT INTO stg_spci_raw (batch_id, row_no, data, source_file, imported_by) VALUES ${a}`;await d.Z.$executeRawUnsafe(r),x+=t.length}return await d.Z.$executeRawUnsafe(`
      INSERT INTO stg_spci_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${p}'::uuid, '${c}', ${x}, '${E}')
      ON CONFLICT (batch_id) DO NOTHING
    `),await d.Z.$executeRawUnsafe(`SELECT apply_spci_batch('${p}'::uuid)`),n.NextResponse.json({ok:!0,batchId:p,total_rows:x})}catch(e){return console.error("[import/spci] error",e),n.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let N=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/import/spci/route",pathname:"/api/import/spci",filename:"route",bundlePath:"app/api/import/spci/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/import/spci/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:m,staticGenerationAsyncStorage:I,serverHooks:_}=N,L="/api/import/spci/route";function f(){return(0,s.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:I})}},27191:(e,t,a)=>{a.d(t,{Z:()=>o});var r=a(53524);let o=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(e,t,a)=>{e.exports=a(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[2035,4389,6236,9900],()=>a(42410));module.exports=r})();
"use strict";(()=>{var e={};e.id=882,e.ids=[882],e.modules={53524:e=>{e.exports=require("@prisma/client")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},84770:e=>{e.exports=require("crypto")},92761:e=>{e.exports=require("node:async_hooks")},6005:e=>{e.exports=require("node:crypto")},87561:e=>{e.exports=require("node:fs")},49411:e=>{e.exports=require("node:path")},8148:(e,a,t)=>{t.r(a),t.d(a,{originalPathname:()=>I,patchFetch:()=>R,requestAsyncStorage:()=>m,routeModule:()=>_,serverHooks:()=>x,staticGenerationAsyncStorage:()=>L});var r={};t.r(r),t.d(r,{POST:()=>N,runtime:()=>u});var o=t(87916),s=t(49930),i=t(2169),d=t(4389),n=t(27191),c=t(46236),E=t(29900),l=t(84770);let u="nodejs";async function T(){let{userId:e}=await (0,c.I)();if(!e)throw Error("UNAUTHENTICATED");let a=await (0,E.a)(),t=a?.primaryEmailAddress?.emailAddress?.toLowerCase()||"";if("jonathan.alves@emserh.ma.gov.br"!==t)throw Error("FORBIDDEN");return{userId:e,email:t}}async function p(){await n.Z.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_ordens_servico_raw (
      id BIGSERIAL PRIMARY KEY,
      batch_id UUID NOT NULL,
      row_no INTEGER NOT NULL,
      data JSONB NOT NULL,
      source_file TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `),await n.Z.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_ordens_servico_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `),await n.Z.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_ordens_servico (
      id BIGSERIAL PRIMARY KEY,
      numero TEXT,
      data_abertura DATE,
      data_fechamento DATE,
      unidade TEXT,
      regional TEXT,
      tipo_servico TEXT,
      descricao TEXT,
      solicitante TEXT,
      status TEXT,
      prioridade TEXT,
      responsavel TEXT,
      valor_estimado NUMERIC(10,2),
      valor_realizado NUMERIC(10,2),
      observacoes TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `),await n.Z.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION apply_ordens_servico_batch(p_batch UUID)
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO stg_ordens_servico (
        numero, data_abertura, data_fechamento, unidade, regional, tipo_servico,
        descricao, solicitante, status, prioridade, responsavel, valor_estimado,
        valor_realizado, observacoes, last_batch_id, updated_at
      )
      SELECT
        NULLIF(TRIM(data->>'N\xfamero OS' || data->>'Numero OS' || data->>'numero' || data->>'N\xfamero'), '')::text,
        CASE
          WHEN data->>'Data Abertura' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data Abertura')::date
          WHEN data->>'Data Abertura' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Data Abertura', 'DD/MM/YYYY')
          ELSE NULL
        END,
        CASE
          WHEN data->>'Data Fechamento' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data Fechamento')::date
          WHEN data->>'Data Fechamento' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Data Fechamento', 'DD/MM/YYYY')
          ELSE NULL
        END,
        NULLIF(TRIM(data->>'Unidade' || data->>'unidade'), '')::text,
        NULLIF(TRIM(data->>'Regional' || data->>'regional'), '')::text,
        NULLIF(TRIM(data->>'Tipo de Servi\xe7o' || data->>'Tipo Servico' || data->>'tipo_servico'), '')::text,
        NULLIF(TRIM(data->>'Descri\xe7\xe3o' || data->>'Descricao' || data->>'descricao'), '')::text,
        NULLIF(TRIM(data->>'Solicitante' || data->>'solicitante'), '')::text,
        NULLIF(TRIM(data->>'Status' || data->>'status'), '')::text,
        NULLIF(TRIM(data->>'Prioridade' || data->>'prioridade'), '')::text,
        NULLIF(TRIM(data->>'Respons\xe1vel' || data->>'Responsavel' || data->>'responsavel'), '')::text,
        CASE WHEN (data->>'Valor Estimado' || data->>'valor_estimado')::text ~ '^[0-9.,]+$'
          THEN REPLACE(REPLACE((data->>'Valor Estimado' || data->>'valor_estimado')::text, '.', ''), ',', '.')::numeric
          ELSE NULL END,
        CASE WHEN (data->>'Valor Realizado' || data->>'valor_realizado')::text ~ '^[0-9.,]+$'
          THEN REPLACE(REPLACE((data->>'Valor Realizado' || data->>'valor_realizado')::text, '.', ''), ',', '.')::numeric
          ELSE NULL END,
        NULLIF(TRIM(data->>'Observa\xe7\xf5es' || data->>'Observacoes' || data->>'observacoes'), '')::text,
        batch_id,
        now()
      FROM stg_ordens_servico_raw
      WHERE batch_id = p_batch
      ON CONFLICT DO NOTHING;
    END;
    $$ LANGUAGE plpgsql
  `)}async function N(e){try{let{email:a}=await T(),r=(await e.formData()).get("file");if(!r)return d.NextResponse.json({ok:!1,error:"Envie um arquivo .xlsx ou .csv"},{status:400});let o=(r.name||"ordens_servico").toLowerCase(),s=Buffer.from(await r.arrayBuffer());await p();let i=[];if(o.endsWith(".xlsx"))try{let e=await t.e(1063).then(t.bind(t,81063)),a=e.read(s,{type:"buffer"}),r=a.Sheets[a.SheetNames[0]];i=e.utils.sheet_to_json(r,{defval:""})}catch(e){return d.NextResponse.json({ok:!1,error:"Erro ao ler arquivo Excel. Tente salvar como CSV UTF-8."},{status:400})}else{let e=s.toString("utf8");i=function(e){let a=e.split(/\r?\n/).filter(e=>e.length>0);if(0===a.length)return{headers:[],rows:[]};let t=e=>{let a=[],t="",r=!1;for(let o=0;o<e.length;o++){let s=e[o];'"'===s?r&&'"'===e[o+1]?(t+='"',o++):r=!r:","!==s||r?t+=s:(a.push(t),t="")}return a.push(t),a},r=t(a[0]).map(e=>e.trim()),o=a.slice(1).map(e=>{let a=t(e),o={};return r.forEach((e,t)=>{o[e]=(a[t]??"").trim()}),o});return{headers:r,rows:o}}(e).rows}if(!i.length)return d.NextResponse.json({ok:!1,error:"Arquivo vazio"},{status:400});let c=(0,l.randomUUID)(),E=r.name||"upload",u=a||"admin",N=0;for(let e=0;e<i.length;e+=500){let a=i.slice(e,e+500),t=a.map((a,t)=>{let r=e+t+1,o=JSON.stringify(a).replace(/'/g,"''");return`('${c}'::uuid, ${r}, '${o}'::jsonb, '${E}', '${u}')`}).join(",\n"),r=`INSERT INTO stg_ordens_servico_raw (batch_id, row_no, data, source_file, imported_by) VALUES ${t}`;await n.Z.$executeRawUnsafe(r),N+=a.length}return await n.Z.$executeRawUnsafe(`
      INSERT INTO stg_ordens_servico_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${c}'::uuid, '${E}', ${N}, '${u}')
      ON CONFLICT (batch_id) DO NOTHING
    `),await n.Z.$executeRawUnsafe(`SELECT apply_ordens_servico_batch('${c}'::uuid)`),d.NextResponse.json({ok:!0,batchId:c,total_rows:N})}catch(e){return console.error("[import/ordens-servico] error",e),d.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let _=new o.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/import/ordens-servico/route",pathname:"/api/import/ordens-servico",filename:"route",bundlePath:"app/api/import/ordens-servico/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/import/ordens-servico/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:m,staticGenerationAsyncStorage:L,serverHooks:x}=_,I="/api/import/ordens-servico/route";function R(){return(0,i.patchFetch)({serverHooks:x,staticGenerationAsyncStorage:L})}},27191:(e,a,t)=>{t.d(a,{Z:()=>o});var r=t(53524);let o=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(e,a,t)=>{e.exports=t(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[2035,4389,6236,9900],()=>t(8148));module.exports=r})();
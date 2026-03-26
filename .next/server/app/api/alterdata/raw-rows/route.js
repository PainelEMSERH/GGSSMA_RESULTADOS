"use strict";(()=>{var a={};a.id=2002,a.ids=[2002],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},40203:(a,e,t)=>{t.r(e),t.d(e,{originalPathname:()=>T,patchFetch:()=>w,requestAsyncStorage:()=>c,routeModule:()=>R,serverHooks:()=>S,staticGenerationAsyncStorage:()=>v});var r={};t.r(r),t.d(r,{GET:()=>_});var s=t(87916),o=t(49930),n=t(2169),i=t(4389),l=t(27191);function E(a){return(a||"").replace(/'/g,"''")}function u(a){return`regexp_replace(upper(${a}), '[^A-Z0-9]', '', 'g')`}async function d(a){let e=`
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','m','v')     -- table, mat.view, view
        AND n.nspname = 'public'
        AND c.relname = '${E(a)}'
    ) AS ok
  `,t=await l.Z.$queryRawUnsafe(e);return!!t?.[0]?.ok}async function p(){if(await d("stg_alterdata_v2_imports")){let a=await l.Z.$queryRawUnsafe(`
      SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
    `);return a?.[0]?.batch_id??null}if(await d("stg_alterdata_v2_raw")){let a=await l.Z.$queryRawUnsafe(`
      SELECT batch_id FROM stg_alterdata_v2_raw WHERE batch_id IS NOT NULL ORDER BY batch_id DESC LIMIT 1
    `);return a?.[0]?.batch_id??null}return null}async function _(a){try{let{searchParams:e}=new URL(a.url),t=Math.max(1,parseInt(e.get("page")||"1",10)),r=Math.min(200,Math.max(10,parseInt(e.get("limit")||"50",10))),s=(e.get("q")||"").trim(),o=(e.get("unidade")||"").trim(),n=(e.get("status")||"").trim(),_=(t-1)*r,R=await d("stg_alterdata_v2_raw"),c=await d("stg_alterdata");if(!R&&!c){let a=i.NextResponse.json({ok:!1,error:"Nenhuma tabela Alterdata encontrada (stg_alterdata_v2_raw ou stg_alterdata)."},{status:500});return a.headers.set("x-alterdata-route","legacy-v4"),a}let v=[];if(s){let a=E(s);v.push(`EXISTS (
        SELECT 1 FROM jsonb_each_text(data) kv
        WHERE ${u("kv.value")} LIKE ${u(`'%${a}%'`)}
      )`)}o&&v.push(`EXISTS (
        SELECT 1 FROM jsonb_each_text(data) kv_un
        WHERE ${u("kv_un.value")} = ${u(`'${E(o)}'`)}
      )`),"Demitido"===n?v.push(`(
        (data ? 'Demiss\xe3o' AND (substring(data->>'Demiss\xe3o' from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE (upper(kv.key) LIKE '%STATUS%' OR upper(kv.key) LIKE '%SITUA%')
            AND upper(kv.value) LIKE '%DEMIT%'
        )
      )`):"Admitido"===n?v.push(`NOT (
        (data ? 'Demiss\xe3o' AND (substring(data->>'Demiss\xe3o' from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'))
        OR EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE (upper(kv.key) LIKE '%STATUS%' OR upper(kv.key) LIKE '%SITUA%')
            AND upper(kv.value) LIKE '%DEMIT%'
        )
      )`):"Afastado"===n&&v.push(`(
        EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE upper(kv.key) LIKE '%INICIO%' AND upper(kv.key) LIKE '%AFAST%'
        )
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_each_text(data) kv
          WHERE upper(kv.key) LIKE '%FIM%' AND upper(kv.key) LIKE '%AFAST%'
            AND (substring(kv.value from 1 for 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
            AND to_date(substring(kv.value from 1 for 10), 'YYYY-MM-DD') < current_date
        )
      )`);let S=v.length?"WHERE "+v.join(" AND "):"",T="",w="";if(R){if(await d("mv_alterdata_v2_raw_flat")){let a=await p(),e=a?`batch_id = '${E(a)}'`:"1=1",t=S?S.replace(/^WHERE\\s+/,""):"",s=t?"1=1"!==e?`WHERE ${e} AND ${t}`:`WHERE ${t}`:"1=1"!==e?`WHERE ${e}`:"";T=`
          SELECT row_no, data_jsonb as data
          FROM mv_alterdata_v2_raw_flat
          ${s}
          ORDER BY row_no
          LIMIT ${r} OFFSET ${_}
        `,w=`
          SELECT COUNT(*)::int AS total
          FROM mv_alterdata_v2_raw_flat
          ${s}
        `}else{let a=await p(),e=a?`r.batch_id = '${E(a)}'`:"1=1",t=S?S.replace(/^WHERE\\s+/,""):"",s=t?"1=1"!==e?`WHERE ${e} AND ${t}`:`WHERE ${t}`:"1=1"!==e?`WHERE ${e}`:"";T=`
          SELECT r.row_no, r.data
          FROM stg_alterdata_v2_raw r
          ${s}
          ORDER BY r.row_no
          LIMIT ${r} OFFSET ${_}
        `,w=`
          SELECT COUNT(*)::int AS total
          FROM stg_alterdata_v2_raw r
          ${s}
        `}}else{let a="SELECT row_number() over() as row_no, to_jsonb(t) as data FROM stg_alterdata t",e="base";T=`
        WITH ${e} AS (${a})
        SELECT row_no, data
        FROM ${e}
        ${S}
        ORDER BY row_no
        LIMIT ${r} OFFSET ${_}
      `,w=`
        WITH ${e} AS (${a})
        SELECT COUNT(*)::int AS total
        FROM ${e}
        ${S}
      `}let[m,g]=await Promise.all([l.Z.$queryRawUnsafe(T),l.Z.$queryRawUnsafe(w)]),h=g?.[0]?.total??0,I=await p(),$=i.NextResponse.json({ok:!0,rows:m,page:t,limit:r,total:h});return $.headers.set("Cache-Control","public, s-maxage=31536000, stale-while-revalidate=86400"),$.headers.set("x-alterdata-route","legacy-v4"),$.headers.set("x-batch-id",I||""),$}catch(e){let a=i.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500});return a.headers.set("x-alterdata-route","legacy-v4"),a}}let R=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/alterdata/raw-rows/route",pathname:"/api/alterdata/raw-rows",filename:"route",bundlePath:"app/api/alterdata/raw-rows/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/alterdata/raw-rows/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:c,staticGenerationAsyncStorage:v,serverHooks:S}=R,T="/api/alterdata/raw-rows/route";function w(){return(0,n.patchFetch)({serverHooks:S,staticGenerationAsyncStorage:v})}},27191:(a,e,t)=>{t.d(e,{Z:()=>s});var r=t(53524);let s=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(a,e,t)=>{a.exports=t(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var t=a=>e(e.s=a),r=e.X(0,[2035,4389],()=>t(40203));module.exports=r})();
"use strict";(()=>{var t={};t.id=2499,t.ids=[2499],t.modules={53524:t=>{t.exports=require("@prisma/client")},20399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},16577:(t,a,e)=>{e.r(a),e.d(a,{originalPathname:()=>N,patchFetch:()=>R,requestAsyncStorage:()=>c,routeModule:()=>_,serverHooks:()=>E,staticGenerationAsyncStorage:()=>m});var r={};e.r(r),e.d(r,{GET:()=>u,dynamic:()=>p,runtime:()=>n});var o=e(87916),s=e(49930),i=e(2169),l=e(4389),d=e(27191);let n="nodejs",p="force-dynamic";async function u(){try{let t=await d.Z.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2_raw
    `),a=await d.Z.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2
      WHERE cpf IS NOT NULL AND cpf != ''
    `),e=await d.Z.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2_raw
      WHERE data->>'CPF' IS NULL 
         OR data->>'CPF' = ''
         OR regexp_replace(data->>'CPF', '[^0-9]', '', 'g') = ''
    `),r=await d.Z.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM epi_manual_colab
      WHERE cpf IS NOT NULL AND cpf != ''
    `),o=await d.Z.$queryRawUnsafe(`
      SELECT 
        batch_id,
        source_file,
        total_rows,
        imported_by,
        imported_at
      FROM stg_alterdata_v2_imports
      ORDER BY imported_at DESC
      LIMIT 1
    `),s=await d.Z.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT cpf)::int AS total
      FROM (
        SELECT cpf FROM stg_alterdata_v2 WHERE cpf IS NOT NULL AND cpf != ''
        UNION
        SELECT cpf FROM epi_manual_colab WHERE cpf IS NOT NULL AND cpf != ''
      ) AS combined
    `),i=await d.Z.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM stg_alterdata_v2
      WHERE cpf IS NOT NULL AND cpf != ''
        AND (
          demissao IS NULL 
          OR demissao = '' 
          OR CASE
            WHEN demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(demissao, 'YYYY-MM-DD') >= '2025-01-01'::date
            WHEN demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(demissao, 'DD/MM/YYYY') >= '2025-01-01'::date
            ELSE true
          END
        )
    `);return l.NextResponse.json({ok:!0,stats:{raw_total:Number(t?.[0]?.total||0),total_alterdata:Number(a?.[0]?.total||0),raw_no_cpf:Number(e?.[0]?.total||0),total_manual:Number(r?.[0]?.total||0),total_unique:Number(s?.[0]?.total||0),total_active:Number(i?.[0]?.total||0),difference:Number(t?.[0]?.total||0)-Number(a?.[0]?.total||0),last_import:o?.[0]?{batch_id:o[0].batch_id,source_file:o[0].source_file,total_rows:Number(o[0].total_rows||0),imported_by:o[0].imported_by,imported_at:o[0].imported_at}:null}})}catch(t){return console.error("[alterdata/stats] error",t),l.NextResponse.json({ok:!1,error:String(t?.message||t)},{status:500})}}let _=new o.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/alterdata/stats/route",pathname:"/api/alterdata/stats",filename:"route",bundlePath:"app/api/alterdata/stats/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/alterdata/stats/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:c,staticGenerationAsyncStorage:m,serverHooks:E}=_,N="/api/alterdata/stats/route";function R(){return(0,i.patchFetch)({serverHooks:E,staticGenerationAsyncStorage:m})}},27191:(t,a,e)=>{e.d(a,{Z:()=>o});var r=e(53524);let o=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(t,a,e)=>{t.exports=e(30517)}};var a=require("../../../../webpack-runtime.js");a.C(t);var e=t=>a(a.s=t),r=a.X(0,[2035,4389],()=>e(16577));module.exports=r})();
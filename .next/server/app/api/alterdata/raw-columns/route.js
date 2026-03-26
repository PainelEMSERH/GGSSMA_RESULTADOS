"use strict";(()=>{var e={};e.id=6929,e.ids=[6929],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},56310:(e,a,t)=>{t.r(a),t.d(a,{originalPathname:()=>g,patchFetch:()=>h,requestAsyncStorage:()=>p,routeModule:()=>c,serverHooks:()=>_,staticGenerationAsyncStorage:()=>m});var r={};t.r(r),t.d(r,{GET:()=>u});var s=t(87916),o=t(49930),l=t(2169),n=t(4389),i=t(27191);async function d(e){let a=`
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','m','v')
        AND n.nspname = 'public'
        AND c.relname = '${(e||"").replace(/'/g,"''")}'
    ) AS ok
  `,t=await i.Z.$queryRawUnsafe(a);return!!t?.[0]?.ok}async function u(){try{let e=await d("stg_alterdata_v2_raw"),a=await d("stg_alterdata");if(!e&&!a){let e=n.NextResponse.json({ok:!1,error:"Nenhuma tabela Alterdata encontrada (stg_alterdata_v2_raw ou stg_alterdata)."},{status:500});return e.headers.set("x-alterdata-route","legacy-v4"),e}if(e){let e=(await i.Z.$queryRawUnsafe(`
        WITH latest AS (
          SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
        )
        SELECT DISTINCT jsonb_object_keys(r.data) AS key
        FROM stg_alterdata_v2_raw r, latest
        WHERE r.batch_id = latest.batch_id
        ORDER BY 1
      `)).map(e=>e.key),a=await i.Z.$queryRawUnsafe(`
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      `),t=a?.[0]?.batch_id||null,r=n.NextResponse.json({ok:!0,columns:e,batch_id:t});return r.headers.set("Cache-Control","public, s-maxage=31536000, stale-while-revalidate=86400"),r.headers.set("x-alterdata-route","legacy-v4"),r.headers.set("x-batch-id",t||""),r}let t=(await i.Z.$queryRawUnsafe(`
      SELECT column_name as key
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stg_alterdata'
      ORDER BY ordinal_position
    `)).map(e=>e.key),r=await i.Z.$queryRawUnsafe("SELECT COUNT(*)::int AS total FROM stg_alterdata"),s=`legacy-stg_alterdata-${r?.[0]?.total??0}`,o=n.NextResponse.json({ok:!0,columns:t,batch_id:s});return o.headers.set("Cache-Control","public, s-maxage=3600, stale-while-revalidate=86400"),o.headers.set("x-alterdata-route","legacy-v4"),o}catch(a){let e=n.NextResponse.json({ok:!1,error:String(a?.message||a)},{status:500});return e.headers.set("x-alterdata-route","legacy-v4"),e}}let c=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/alterdata/raw-columns/route",pathname:"/api/alterdata/raw-columns",filename:"route",bundlePath:"app/api/alterdata/raw-columns/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/alterdata/raw-columns/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:p,staticGenerationAsyncStorage:m,serverHooks:_}=c,g="/api/alterdata/raw-columns/route";function h(){return(0,l.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:m})}},27191:(e,a,t)=>{t.d(a,{Z:()=>s});var r=t(53524);let s=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(e,a,t)=>{e.exports=t(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[2035,4389],()=>t(56310));module.exports=r})();
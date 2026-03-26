"use strict";(()=>{var t={};t.id=1068,t.ids=[1068],t.modules={53524:t=>{t.exports=require("@prisma/client")},20399:t=>{t.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:t=>{t.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},51538:(t,e,a)=>{a.r(e),a.d(e,{originalPathname:()=>E,patchFetch:()=>m,requestAsyncStorage:()=>_,routeModule:()=>u,serverHooks:()=>R,staticGenerationAsyncStorage:()=>c});var r={};a.r(r),a.d(r,{GET:()=>p,revalidate:()=>n});var s=a(87916),i=a(49930),o=a(2169),l=a(4389),d=a(27191);let n=0;async function p(){try{let t=await d.Z.$queryRawUnsafe(`
      SELECT batch_id, imported_at
      FROM stg_alterdata_v2_imports
      ORDER BY imported_at DESC
      LIMIT 1
    `),e=t?.[0]?.batch_id||null,a=await d.Z.$queryRawUnsafe(`
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT row_no, data
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ORDER BY row_no
    `),r=await d.Z.$queryRawUnsafe(`
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT DISTINCT jsonb_object_keys(data) AS key
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ORDER BY 1
    `),s=Array.isArray(r)?r.map(t=>t.key):[],i=l.NextResponse.json({ok:!0,batch_id:e,columns:s,rows:a},{status:200});return i.headers.set("Cache-Control","public, s-maxage=86400, stale-while-revalidate=604800"),i}catch(t){return l.NextResponse.json({ok:!1,error:String(t?.message||t)},{status:500})}}let u=new s.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/alterdata/all/route",pathname:"/api/alterdata/all",filename:"route",bundlePath:"app/api/alterdata/all/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/alterdata/all/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:_,staticGenerationAsyncStorage:c,serverHooks:R}=u,E="/api/alterdata/all/route";function m(){return(0,o.patchFetch)({serverHooks:R,staticGenerationAsyncStorage:c})}},27191:(t,e,a)=>{a.d(e,{Z:()=>s});var r=a(53524);let s=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(t,e,a)=>{t.exports=a(30517)}};var e=require("../../../../webpack-runtime.js");e.C(t);var a=t=>e(e.s=t),r=e.X(0,[2035,4389],()=>a(51538));module.exports=r})();
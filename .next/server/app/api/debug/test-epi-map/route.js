"use strict";(()=>{var e={};e.id=5469,e.ids=[5469],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},39321:(e,a,t)=>{t.r(a),t.d(a,{originalPathname:()=>_,patchFetch:()=>E,requestAsyncStorage:()=>c,routeModule:()=>m,serverHooks:()=>g,staticGenerationAsyncStorage:()=>d});var r={};t.r(r),t.d(r,{GET:()=>l,dynamic:()=>u});var s=t(87916),i=t(49930),n=t(2169),o=t(4389),p=t(27191);let u="force-dynamic";async function l(){try{let e=await p.Z.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_epi_map'
      ) AS exists
    `);if(!e?.[0]?.exists)return o.NextResponse.json({ok:!1,error:"Tabela stg_epi_map n\xe3o existe",total:0});let a=await p.Z.$queryRawUnsafe(`
      SELECT COUNT(*) as total FROM stg_epi_map
    `),t=await p.Z.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'stg_epi_map' AND column_name = 'funcao_normalizada'
      ) AS exists
    `),r=await p.Z.$queryRawUnsafe(`
      SELECT 
        alterdata_funcao,
        funcao_normalizada,
        epi_item,
        quantidade,
        pcg,
        unidade_hospitalar
      FROM stg_epi_map
      LIMIT 10
    `),s=await p.Z.$queryRawUnsafe(`
      SELECT 
        pcg,
        COUNT(*) as total
      FROM stg_epi_map
      GROUP BY pcg
      ORDER BY total DESC
      LIMIT 10
    `),i=await p.Z.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT COALESCE(funcao_normalizada, alterdata_funcao)) as total
      FROM stg_epi_map
    `);return o.NextResponse.json({ok:!0,total:Number(a[0]?.total||0),hasNormalizedColumn:t[0]?.exists||!1,uniqueFunctions:Number(i[0]?.total||0),samples:r,byPcg:s})}catch(e){return o.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let m=new s.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/debug/test-epi-map/route",pathname:"/api/debug/test-epi-map",filename:"route",bundlePath:"app/api/debug/test-epi-map/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/debug/test-epi-map/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:c,staticGenerationAsyncStorage:d,serverHooks:g}=m,_="/api/debug/test-epi-map/route";function E(){return(0,n.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:d})}},27191:(e,a,t)=>{t.d(a,{Z:()=>s});var r=t(53524);let s=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(e,a,t)=>{e.exports=t(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[2035,4389],()=>t(39321));module.exports=r})();
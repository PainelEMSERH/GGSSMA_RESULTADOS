"use strict";(()=>{var e={};e.id=790,e.ids=[790],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},64409:(e,a,t)=>{t.r(a),t.d(a,{originalPathname:()=>E,patchFetch:()=>m,requestAsyncStorage:()=>g,routeModule:()=>l,serverHooks:()=>R,staticGenerationAsyncStorage:()=>c});var r={};t.r(r),t.d(r,{GET:()=>o,dynamic:()=>u});var d=t(87916),i=t(49930),n=t(2169),s=t(4389),p=t(27191);let u="force-dynamic";async function o(){try{let e=await p.Z.$queryRawUnsafe(`
      SELECT DISTINCT 
        TRIM(unidade_hospitalar) as unidade
      FROM stg_alterdata_v2
      WHERE unidade_hospitalar IS NOT NULL 
        AND TRIM(unidade_hospitalar) != ''
      ORDER BY unidade_hospitalar
    `),a=await p.Z.$queryRawUnsafe(`
      SELECT DISTINCT 
        TRIM(unidade_hospitalar) as unidade
      FROM stg_epi_map
      WHERE unidade_hospitalar IS NOT NULL 
        AND TRIM(unidade_hospitalar) != ''
        AND unidade_hospitalar != 'PCG UNIVERSAL'
        AND unidade_hospitalar != 'SEM MAPEAMENTO NO PCG'
      ORDER BY unidade_hospitalar
    `),t=await p.Z.$queryRawUnsafe(`
      SELECT DISTINCT 
        TRIM(pcg) as pcg
      FROM stg_epi_map
      WHERE pcg IS NOT NULL 
        AND TRIM(pcg) != ''
        AND pcg != 'PCG UNIVERSAL'
        AND pcg != 'SEM MAPEAMENTO NO PCG'
      ORDER BY pcg
    `);return s.NextResponse.json({ok:!0,unidadesAlterdata:e.map(e=>e.unidade),unidadesMapeamento:a.map(e=>e.unidade),pcgsMapeamento:t.map(e=>e.pcg),totalAlterdata:e.length,totalMapeamento:a.length,totalPcgs:t.length})}catch(e){return s.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let l=new d.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/debug/unidades-alterdata/route",pathname:"/api/debug/unidades-alterdata",filename:"route",bundlePath:"app/api/debug/unidades-alterdata/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/debug/unidades-alterdata/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:g,staticGenerationAsyncStorage:c,serverHooks:R}=l,E="/api/debug/unidades-alterdata/route";function m(){return(0,n.patchFetch)({serverHooks:R,staticGenerationAsyncStorage:c})}},27191:(e,a,t)=>{t.d(a,{Z:()=>d});var r=t(53524);let d=globalThis.prisma??new r.PrismaClient({log:["error"]})},87916:(e,a,t)=>{e.exports=t(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var t=e=>a(a.s=e),r=a.X(0,[2035,4389],()=>t(64409));module.exports=r})();